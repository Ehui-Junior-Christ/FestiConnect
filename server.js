import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './src/config/env.js';
import { getDb } from './src/db/client.js';
import { buildInsert, insertByExistingColumns, tableColumns } from './src/db/schema.js';
import { AppError, errorResponse, notFound } from './src/shared/errors.js';
import { parseBody, sendJson, serveStatic } from './src/shared/http.js';
import { dummyVerify, hashPassword, needsRehash, passwordPolicyError, verifyPassword } from './src/shared/passwords.js';
import { RateLimiter, enforce, tooManyRequests } from './src/shared/rateLimit.js';
import { applySecurityHeaders, assertSameOrigin, getClientIp, isSecureRequest } from './src/shared/security.js';
import {
  clearSessionCookie,
  createSession,
  findSessionUser,
  hasBearer,
  hasCookieSession,
  purgeExpiredSessions,
  revokeAllSessions,
  revokeRequestSessions,
  sessionCookie
} from './src/shared/sessions.js';
import * as v from './src/shared/validation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'public');
const db = getDb();

const PAYMENT_METHODS = ['Wave', 'Orange Money', 'Moov Money'];
const EVENT_STATUSES = ['approved', 'pending', 'rejected'];
const SELF_SERVICE_ROLES = ['client', 'organisateur'];
const MAX_TICKETS_PER_PURCHASE = 10;
const MAX_ORDER_LINES = 50;
const MAX_QUANTITY_PER_PRODUCT = 50;

const MINUTE = 60 * 1000;
const limiters = {
  api: new RateLimiter({ windowMs: MINUTE, max: 300 }),
  loginIp: new RateLimiter({ windowMs: 15 * MINUTE, max: 30 }),
  loginAccountIp: new RateLimiter({ windowMs: 15 * MINUTE, max: 5 }),
  loginAccount: new RateLimiter({ windowMs: 15 * MINUTE, max: 20 }),
  registerIp: new RateLimiter({ windowMs: 60 * MINUTE, max: 10 }),
  purchaseUser: new RateLimiter({ windowMs: 10 * MINUTE, max: 30 }),
  eventCreateUser: new RateLimiter({ windowMs: 60 * MINUTE, max: 20 }),
  logoutAllUser: new RateLimiter({ windowMs: 15 * MINUTE, max: 10 })
};

function randomId(prefix) {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 18)}`;
}

function isEmailConstraintError(error) {
  return String(error?.message || '').includes('UNIQUE constraint failed: users.email');
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, city: user.city, phone: user.phone };
}

async function requireUser(req, roles = []) {
  const user = await findSessionUser(db, req);
  if (!user) throw new AppError(401, 'AUTH_REQUIRED', 'Connexion requise.');
  if (roles.length && !roles.includes(user.role)) {
    throw new AppError(403, 'FORBIDDEN', 'Acces refuse pour ce role.');
  }
  return user;
}

async function insertUserRecord(user) {
  const columns = await tableColumns(db, 'users');
  const now = new Date().toISOString();
  const record = {
    id: user.id,
    name: user.name,
    email: user.email,
    password_hash: user.password_hash,
    password_salt: user.password_salt,
    role: user.role,
    phone: user.phone || '',
    city: user.city || 'Abidjan',
    balance: 0,
    createdAt: now,
    created_at: now
  };
  if (columns.has('password')) record.password = user.password_hash;
  await insertByExistingColumns(db, 'users', record);
}

async function upgradePasswordHash(userId, password) {
  const columns = await tableColumns(db, 'users');
  const next = await hashPassword(password);
  const sets = ['password_hash = ?', 'password_salt = ?'];
  const args = [next.hash, next.salt];
  if (columns.has('password')) {
    sets.push('password = ?');
    args.push(next.hash);
  }
  args.push(userId);
  await db.execute({ sql: `update users set ${sets.join(', ')} where id = ?`, args });
}

async function countOrdersForUser(userId) {
  const columns = await tableColumns(db, 'orders');
  const userColumn = columns.has('user_id') ? 'user_id' : 'userId';
  const orders = await db.execute({ sql: `select count(*) as count from orders where ${userColumn} = ?`, args: [userId] });
  return orders.rows[0].count;
}

// Reservation atomique de places : l'UPDATE conditionnel ne passe que s'il
// reste assez de capacite (capacite <= 0 = historique "illimite").
async function reserveEventSeats(eventId, quantity) {
  const columns = await tableColumns(db, 'events');
  const sets = ['tickets_sold = tickets_sold + ?'];
  const args = [quantity];
  if (columns.has('ticketsSold')) {
    sets.push('ticketsSold = coalesce(ticketsSold, 0) + ?');
    args.push(quantity);
  }
  args.push(eventId, quantity);
  const result = await db.execute({
    sql: `update events set ${sets.join(', ')}
          where id = ? and status = 'approved'
            and (coalesce(capacity, 0) <= 0 or coalesce(tickets_sold, 0) + ? <= capacity)`,
    args
  });
  return result.rowsAffected === 1;
}

async function releaseEventSeats(eventId, quantity) {
  const columns = await tableColumns(db, 'events');
  const sets = ['tickets_sold = max(coalesce(tickets_sold, 0) - ?, 0)'];
  const args = [quantity];
  if (columns.has('ticketsSold')) {
    sets.push('ticketsSold = max(coalesce(ticketsSold, 0) - ?, 0)');
    args.push(quantity);
  }
  args.push(eventId);
  await db.execute({ sql: `update events set ${sets.join(', ')} where id = ?`, args });
}

async function reserveStock(productId, quantity) {
  const result = await db.execute({
    sql: 'update products set stock = stock - ? where id = ? and stock >= ?',
    args: [quantity, productId, quantity]
  });
  return result.rowsAffected === 1;
}

async function releaseStock(productId, quantity) {
  await db.execute({ sql: 'update products set stock = stock + ? where id = ?', args: [quantity, productId] });
}

async function safely(label, action) {
  try {
    await action();
  } catch (error) {
    console.error(`[compensation] ${label}`, error);
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const routes = [];

function route(method, pattern, handler) {
  routes.push({ method, pattern, handler });
}

function matchRoute(pattern, pathname) {
  if (typeof pattern === 'string') return pattern === pathname ? [] : null;
  const match = pattern.exec(pathname);
  return match ? match.slice(1) : null;
}

function pathId(value) {
  // Un identifiant mal forme equivaut a une ressource introuvable.
  let decoded;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  return v.isValidId(decoded) ? decoded : null;
}

function searchParam(url, name, max) {
  const value = (url.searchParams.get(name) || '').trim();
  if (value.length > max) throw new AppError(422, 'VALIDATION_ERROR', `Parametre ${name} trop long (max ${max}).`);
  return value;
}

route('GET', '/api/health', ({ res }) => sendJson(res, 200, { status: 'ok', service: 'FestiConnect' }));

route('POST', '/api/auth/register', async ({ req, res, ip }) => {
  enforce(limiters.registerIp, ip);
  const body = await parseBody(req);
  if (!body.name || !body.email || !body.password) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Nom, email et mot de passe sont obligatoires.');
  }
  const name = v.text(body.name, { label: 'Nom', min: 2, max: 80, required: true });
  const email = v.email(body.email);
  const role = v.oneOf(body.role, SELF_SERVICE_ROLES, { label: 'Role', fallback: 'client' });
  const phone = v.phone(body.phone);
  const city = v.text(body.city, { label: 'Ville', max: 60, fallback: 'Abidjan' });
  const policyError = passwordPolicyError(body.password, { email, name });
  if (policyError) throw new AppError(422, 'WEAK_PASSWORD', policyError);

  const existing = await db.execute({ sql: 'select id from users where email = ?', args: [email] });
  if (existing.rows[0]) {
    throw new AppError(409, 'EMAIL_ALREADY_EXISTS', 'Un compte existe deja avec cet email.');
  }
  const password = await hashPassword(body.password);
  const id = randomId('usr');
  try {
    await insertUserRecord({ id, name, email, password_hash: password.hash, password_salt: password.salt, role, phone, city });
  } catch (error) {
    if (isEmailConstraintError(error)) {
      throw new AppError(409, 'EMAIL_ALREADY_EXISTS', 'Un compte existe deja avec cet email.');
    }
    throw error;
  }
  return sendJson(res, 201, { id, name, email, role });
});

route('POST', '/api/auth/login', async ({ req, res, ip }) => {
  enforce(limiters.loginIp, ip);
  const body = await parseBody(req);
  const email = v.normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  const badCredentials = new AppError(401, 'BAD_CREDENTIALS', 'Email ou mot de passe incorrect.');
  if (!email || !password || email.length > 254 || password.length > 1024) {
    await dummyVerify(password);
    throw badCredentials;
  }

  const accountKey = email;
  const accountIpKey = `${email}|${ip}`;
  for (const [limiter, key] of [[limiters.loginAccountIp, accountIpKey], [limiters.loginAccount, accountKey]]) {
    const state = limiter.check(key);
    if (state.limited) throw tooManyRequests(state.retryAfterMs);
  }

  const found = await db.execute({
    sql: 'select id, name, email, role, city, phone, password_hash, password_salt from users where email = ?',
    args: [email]
  });
  const user = found.rows[0];
  const ok = user
    ? await verifyPassword(password, user.password_salt, user.password_hash)
    : await dummyVerify(password);
  if (!ok) {
    limiters.loginAccountIp.hit(accountIpKey);
    limiters.loginAccount.hit(accountKey);
    throw badCredentials;
  }
  limiters.loginAccountIp.reset(accountIpKey);

  if (needsRehash(user.password_hash)) {
    await safely('rehash mot de passe', () => upgradePasswordHash(user.id, password));
  }
  // Rotation : toute session presentee avec la requete de login est revoquee.
  await revokeRequestSessions(db, req);
  const token = await createSession(db, user.id);
  res.setHeader('Set-Cookie', sessionCookie(token, { secure: config.isProduction || isSecureRequest(req) }));
  return sendJson(res, 200, { token, user: publicUser(user) });
});

route('POST', '/api/auth/logout', async ({ req, res }) => {
  await revokeRequestSessions(db, req);
  res.setHeader('Set-Cookie', clearSessionCookie({ secure: config.isProduction || isSecureRequest(req) }));
  return sendJson(res, 200, { ok: true });
});

route('POST', '/api/auth/logout-all', async ({ req, res }) => {
  const user = await requireUser(req);
  enforce(limiters.logoutAllUser, user.id);
  await revokeAllSessions(db, user.id);
  res.setHeader('Set-Cookie', clearSessionCookie({ secure: config.isProduction || isSecureRequest(req) }));
  return sendJson(res, 200, { ok: true });
});

route('GET', '/api/me', async ({ req, res }) => sendJson(res, 200, { user: await findSessionUser(db, req) }));

route('GET', '/api/events', async ({ res, url }) => {
  const q = searchParam(url, 'q', 100);
  const category = searchParam(url, 'category', 40);
  const city = searchParam(url, 'city', 60);
  const like = `%${q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
  // Le catalogue public n'expose que les evenements valides (le parametre
  // `status` n'est plus pris en compte : voir /api/admin/events).
  const result = await db.execute({
    sql: `select events.*, users.name as organizer_name
          from events join users on users.id = events.organizer_id
          where events.status = 'approved'
            and (events.title like ? escape '\\' or events.description like ? escape '\\' or events.city like ? escape '\\')
            and (? = '' or events.category = ?)
            and (? = '' or events.city = ?)
          order by datetime(events.starts_at) asc
          limit 500`,
    args: [like, like, like, category, category, city, city]
  });
  return sendJson(res, 200, { events: result.rows });
});

route('GET', /^\/api\/events\/([^/]+)$/, async ({ req, res, params }) => {
  const eventId = pathId(params[0]);
  if (!eventId) return notFound(res);
  const result = await db.execute({
    sql: `select events.*, users.name as organizer_name
          from events join users on users.id = events.organizer_id
          where events.id = ?`,
    args: [eventId]
  });
  const event = result.rows[0];
  if (!event) return notFound(res);
  if (event.status !== 'approved') {
    // Evenement non publie : visible uniquement par son organisateur ou un admin.
    const user = await findSessionUser(db, req);
    if (!user || (user.role !== 'admin' && user.id !== event.organizer_id)) return notFound(res);
  }
  return sendJson(res, 200, { event });
});

route('POST', '/api/events', async ({ req, res }) => {
  const user = await requireUser(req, ['organisateur', 'admin']);
  enforce(limiters.eventCreateUser, user.id);
  const body = await parseBody(req);
  if (!body.title || !body.category || !body.city || !body.starts_at) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Titre, categorie, ville et date sont obligatoires.');
  }
  const title = v.text(body.title, { label: 'Titre', min: 3, max: 120, required: true });
  const category = v.text(body.category, { label: 'Categorie', min: 2, max: 40, required: true });
  const city = v.text(body.city, { label: 'Ville', min: 2, max: 60, required: true });
  const location = v.text(body.location, { label: 'Lieu', max: 120, fallback: city });
  const startsAt = v.dateTime(body.starts_at, { label: 'Date de debut', required: true });
  const endsAt = v.dateTime(body.ends_at, { label: 'Date de fin' }) || startsAt;
  if (Date.parse(endsAt) < Date.parse(startsAt)) {
    throw new AppError(422, 'VALIDATION_ERROR', 'La date de fin doit etre posterieure a la date de debut.');
  }
  const price = v.integer(body.price_xof, { label: 'Prix', min: 0, max: 10_000_000, fallback: 0 });
  const capacity = v.integer(body.capacity, { label: 'Capacite', min: 1, max: 200_000, fallback: 100 });
  const cover = v.imageUrl(body.cover_url, { label: 'Image', fallback: '/assets/img/event-default.svg' });
  const description = v.text(body.description, { label: 'Description', max: 5000, multiline: true });

  const id = randomId('evt');
  await insertByExistingColumns(db, 'events', {
    id,
    organizer_id: user.id,
    organizerId: user.id,
    title,
    category,
    city,
    location,
    starts_at: startsAt,
    ends_at: endsAt,
    date: startsAt,
    price_xof: price,
    price,
    capacity,
    ticketsCapacity: capacity,
    tickets_sold: 0,
    ticketsSold: 0,
    status: user.role === 'admin' ? 'approved' : 'pending',
    cover_url: cover,
    image: cover,
    description,
    created_at: new Date().toISOString()
  });
  return sendJson(res, 201, { id });
});

route('PATCH', /^\/api\/events\/([^/]+)\/status$/, async ({ req, res, params }) => {
  await requireUser(req, ['admin']);
  const eventId = pathId(params[0]);
  if (!eventId) return notFound(res);
  const body = await parseBody(req);
  const status = v.oneOf(body.status, EVENT_STATUSES, { label: 'Statut' });
  const result = await db.execute({ sql: 'update events set status = ? where id = ?', args: [status, eventId] });
  if (!result.rowsAffected) return notFound(res);
  return sendJson(res, 200, { ok: true });
});

route('POST', '/api/tickets', async ({ req, res }) => {
  const user = await requireUser(req, ['client', 'admin']);
  enforce(limiters.purchaseUser, user.id);
  const body = await parseBody(req);
  const eventId = v.id(body.event_id, { label: 'Evenement' });
  const quantity = v.integer(body.quantity, { label: 'Quantite', min: 1, max: MAX_TICKETS_PER_PURCHASE, fallback: 1 });
  const paymentMethod = v.oneOf(body.payment_method, PAYMENT_METHODS, { label: 'Moyen de paiement', fallback: 'Wave' });

  const event = await db.execute({ sql: 'select * from events where id = ? and status = ?', args: [eventId, 'approved'] });
  const row = event.rows[0];
  if (!row) throw new AppError(404, 'EVENT_NOT_FOUND', 'Evenement introuvable.');
  // Prix toujours calcule cote serveur a partir de la base.
  const unitPrice = Number(row.price_xof ?? row.price ?? 0);
  if (!Number.isSafeInteger(unitPrice) || unitPrice < 0) throw new Error(`Prix invalide pour l'evenement ${row.id}`);
  const amount = quantity * unitPrice;

  if (!(await reserveEventSeats(row.id, quantity))) {
    throw new AppError(409, 'SOLD_OUT', 'Plus assez de places disponibles pour cet evenement.');
  }
  const id = randomId('tkt');
  const code = `FC-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
  const now = new Date().toISOString();
  try {
    await insertByExistingColumns(db, 'tickets', {
      id,
      event_id: row.id,
      eventId: row.id,
      eventTitle: row.title,
      eventDate: row.starts_at || row.date,
      eventLocation: row.location,
      eventImage: row.cover_url || row.image,
      user_id: user.id,
      userId: user.id,
      code,
      qrcode: code,
      quantity,
      amount_xof: amount,
      price: amount,
      status: 'paid',
      payment_method: paymentMethod,
      created_at: now,
      createdAt: now
    });
  } catch (error) {
    await safely('liberation places', () => releaseEventSeats(row.id, quantity));
    throw error;
  }
  return sendJson(res, 201, { id, amount_xof: amount });
});

route('GET', '/api/products', async ({ res }) => {
  const products = await db.execute({ sql: 'select * from products order by created_at desc limit 500', args: [] });
  return sendJson(res, 200, { products: products.rows });
});

route('GET', /^\/api\/products\/([^/]+)$/, async ({ res, params }) => {
  const productId = pathId(params[0]);
  if (!productId) return notFound(res);
  const product = await db.execute({ sql: 'select * from products where id = ?', args: [productId] });
  if (!product.rows[0]) return notFound(res);
  return sendJson(res, 200, { product: product.rows[0] });
});

route('POST', '/api/orders', async ({ req, res }) => {
  const user = await requireUser(req, ['client', 'admin']);
  enforce(limiters.purchaseUser, user.id);
  const body = await parseBody(req);
  if (!Array.isArray(body.items) || !body.items.length) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Le panier est vide.');
  }
  if (body.items.length > MAX_ORDER_LINES) {
    throw new AppError(422, 'VALIDATION_ERROR', `Le panier ne peut pas contenir plus de ${MAX_ORDER_LINES} lignes.`);
  }
  // Regroupement par produit ; seuls product_id et quantity sont lus (le prix
  // et le nom envoyes par le client sont ignores).
  const wanted = new Map();
  for (const item of body.items) {
    if (!item || typeof item !== 'object') throw new AppError(422, 'VALIDATION_ERROR', 'Article invalide.');
    const productId = v.id(item.product_id, { label: 'Produit' });
    const quantity = v.integer(item.quantity, { label: 'Quantite', min: 1, max: MAX_QUANTITY_PER_PRODUCT, fallback: 1 });
    wanted.set(productId, (wanted.get(productId) || 0) + quantity);
  }
  const paymentMethod = v.oneOf(body.payment_method, PAYMENT_METHODS, { label: 'Moyen de paiement', fallback: 'Orange Money' });
  const deliveryCity = v.text(body.delivery_city, { label: 'Ville de livraison', max: 60, fallback: user.city || '' });
  const deliveryAddress = v.text(body.delivery_address, { label: 'Adresse', max: 300, multiline: true });

  let total = 0;
  const items = [];
  for (const [productId, quantity] of wanted) {
    if (quantity > MAX_QUANTITY_PER_PRODUCT) {
      throw new AppError(422, 'VALIDATION_ERROR', `Quantite maximale par produit : ${MAX_QUANTITY_PER_PRODUCT}.`);
    }
    const product = await db.execute({ sql: 'select * from products where id = ?', args: [productId] });
    const row = product.rows[0];
    if (!row) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Produit introuvable.');
    const unitPrice = Number(row.price_xof ?? row.price ?? 0);
    if (!Number.isSafeInteger(unitPrice) || unitPrice < 0) throw new Error(`Prix invalide pour le produit ${row.id}`);
    total += unitPrice * quantity;
    items.push({ product: row, quantity, unitPrice });
  }

  // Reservation atomique du stock produit par produit, avec compensation.
  const reserved = [];
  try {
    for (const item of items) {
      if (!(await reserveStock(item.product.id, item.quantity))) {
        throw new AppError(409, 'OUT_OF_STOCK', `Stock insuffisant pour ${item.product.name || item.product.title || 'un produit'}.`);
      }
      reserved.push(item);
    }
    const orderId = randomId('ord');
    const now = new Date().toISOString();
    const statements = [await buildInsert(db, 'orders', {
      id: orderId,
      user_id: user.id,
      userId: user.id,
      total_xof: total,
      total,
      status: 'paid',
      payment_method: paymentMethod,
      paymentMethod,
      delivery_city: deliveryCity,
      addressCity: deliveryCity,
      delivery_address: deliveryAddress,
      addressDetails: deliveryAddress,
      addressName: user.name,
      date: now,
      created_at: now
    })];
    for (const item of items) {
      statements.push(await buildInsert(db, 'order_items', {
        id: randomId('oit'),
        order_id: orderId,
        orderId,
        product_id: item.product.id,
        productId: item.product.id,
        title: item.product.name || item.product.title,
        quantity: item.quantity,
        unit_price_xof: item.unitPrice,
        price: item.unitPrice
      }));
    }
    await db.batch(statements, 'write');
    return sendJson(res, 201, { id: orderId, total_xof: total, status: 'paid' });
  } catch (error) {
    for (const item of reserved) {
      await safely('liberation stock', () => releaseStock(item.product.id, item.quantity));
    }
    throw error;
  }
});

route('GET', '/api/client/summary', async ({ req, res }) => {
  const user = await requireUser(req, ['client', 'admin']);
  const tickets = await db.execute({ sql: 'select count(*) as count, coalesce(sum(amount_xof), 0) as spent from tickets where user_id = ?', args: [user.id] });
  const orders = await countOrdersForUser(user.id);
  return sendJson(res, 200, { summary: { tickets: tickets.rows[0].count, spent: tickets.rows[0].spent, orders, points: Number(tickets.rows[0].count) * 120 } });
});

route('GET', '/api/client/tickets', async ({ req, res }) => {
  const user = await requireUser(req, ['client', 'admin']);
  const tickets = await db.execute({
    sql: `select tickets.*, events.title, events.city, events.location, events.starts_at
          from tickets join events on events.id = tickets.event_id
          where tickets.user_id = ?
          order by datetime(tickets.created_at) desc`,
    args: [user.id]
  });
  return sendJson(res, 200, { tickets: tickets.rows });
});

route('GET', '/api/organizer/summary', async ({ req, res, url }) => {
  const user = await requireUser(req, ['organisateur', 'admin']);
  let orgId = user.id;
  const requested = url.searchParams.get('organizer_id');
  if (user.role === 'admin' && requested) {
    if (!v.isValidId(requested)) throw new AppError(422, 'VALIDATION_ERROR', 'Organisateur invalide.');
    orgId = requested;
  }
  const events = await db.execute({ sql: 'select count(*) as count, coalesce(sum(tickets_sold), 0) as sold from events where organizer_id = ?', args: [orgId] });
  const revenue = await db.execute({
    sql: `select coalesce(sum(tickets.amount_xof), 0) as revenue
          from tickets join events on events.id = tickets.event_id
          where events.organizer_id = ?`,
    args: [orgId]
  });
  return sendJson(res, 200, { summary: { events: events.rows[0].count, sold: events.rows[0].sold, revenue: revenue.rows[0].revenue, conversion: 68 } });
});

route('GET', '/api/organizer/events', async ({ req, res }) => {
  const user = await requireUser(req, ['organisateur', 'admin']);
  const result = await db.execute({
    sql: 'select * from events where organizer_id = ? order by datetime(created_at) desc',
    args: [user.id]
  });
  return sendJson(res, 200, { events: result.rows });
});

route('GET', '/api/organizer/tickets', async ({ req, res }) => {
  const user = await requireUser(req, ['organisateur', 'admin']);
  const result = await db.execute({
    sql: `select tickets.*, users.name as client_name, events.title
          from tickets
          join users on users.id = tickets.user_id
          join events on events.id = tickets.event_id
          where events.organizer_id = ?
          order by datetime(tickets.created_at) desc`,
    args: [user.id]
  });
  return sendJson(res, 200, { tickets: result.rows });
});

route('GET', '/api/admin/summary', async ({ req, res }) => {
  await requireUser(req, ['admin']);
  const users = await db.execute({ sql: 'select count(*) as count from users', args: [] });
  const events = await db.execute({ sql: 'select count(*) as count from events', args: [] });
  const pending = await db.execute({ sql: `select count(*) as count from events where status = 'pending'`, args: [] });
  const revenue = await db.execute({ sql: 'select coalesce(sum(amount_xof), 0) as total from tickets', args: [] });
  return sendJson(res, 200, { summary: { users: users.rows[0].count, events: events.rows[0].count, pending: pending.rows[0].count, volume: revenue.rows[0].total } });
});

route('GET', '/api/admin/events', async ({ req, res, url }) => {
  await requireUser(req, ['admin']);
  const status = v.oneOf(url.searchParams.get('status'), EVENT_STATUSES, { label: 'Statut', fallback: '' });
  const result = await db.execute({
    sql: `select events.*, users.name as organizer_name
          from events join users on users.id = events.organizer_id
          where (? = '' or events.status = ?)
          order by datetime(events.created_at) desc`,
    args: [status, status]
  });
  return sendJson(res, 200, { events: result.rows });
});

async function routeApi(req, res, url) {
  const ip = getClientIp(req);
  enforce(limiters.api, ip);
  assertSameOrigin(req, { hasCookieSession: hasCookieSession(req), hasBearer: hasBearer(req) });

  const allowed = new Set();
  for (const entry of routes) {
    const params = matchRoute(entry.pattern, url.pathname);
    if (!params) continue;
    if (entry.method === req.method) return entry.handler({ req, res, url, params, ip });
    allowed.add(entry.method);
  }
  if (allowed.size) {
    throw new AppError(405, 'METHOD_NOT_ALLOWED', 'Methode HTTP non autorisee.', { Allow: [...allowed].join(', ') });
  }
  return notFound(res);
}

async function routeStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    throw new AppError(405, 'METHOD_NOT_ALLOWED', 'Methode HTTP non autorisee.', { Allow: 'GET, HEAD' });
  }
  return serveStatic(req, res, publicDir, url.pathname);
}

export const server = http.createServer(async (req, res) => {
  const rawUrl = req.url || '/';
  const isApi = rawUrl.startsWith('/api/') || rawUrl === '/api';
  try {
    applySecurityHeaders(res, { api: isApi });
    if (!rawUrl.startsWith('/') || rawUrl.length > 4096) {
      throw new AppError(400, 'BAD_REQUEST', 'URL invalide.');
    }
    // Base fixe : l'en-tete Host n'influence jamais le routage.
    const url = new URL(rawUrl, 'http://localhost');
    if (isApi) return await routeApi(req, res, url);
    return await routeStatic(req, res, url);
  } catch (error) {
    return errorResponse(res, error, `${req.method} ${rawUrl.split('?')[0].slice(0, 200)}`);
  }
});

server.requestTimeout = 30_000;
server.headersTimeout = 15_000;
server.keepAliveTimeout = 5_000;
server.maxHeadersCount = 100;
server.maxRequestsPerSocket = 1000;

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[uncaughtException]', error);
  // Etat potentiellement incoherent : on s'arrete, la plateforme redemarre le service.
  process.exit(1);
});

// Arret gracieux (SIGTERM envoye par l'hebergeur lors d'un redeploiement ou d'une mise en veille).
let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[${signal}] arret gracieux en cours...`);
  setTimeout(() => {
    console.error('Arret force apres 10 s (connexions encore ouvertes).');
    process.exit(1);
  }, 10_000).unref();
  server.close(() => {
    try {
      db.close();
    } catch {
      // Client deja ferme : rien a faire.
    }
    process.exit(0);
  });
  server.closeIdleConnections();
}
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

const purgeTimer = setInterval(() => {
  purgeExpiredSessions(db).catch((error) => console.error('[sessions] purge impossible', error));
}, 60 * MINUTE);
purgeTimer.unref();

async function warnAboutDemoAccounts() {
  const demo = [
    ['admin@festiconnect.ci', 'Admin123!'],
    ['organisateur@festiconnect.ci', 'Orga123!'],
    ['client@festiconnect.ci', 'Client123!']
  ];
  for (const [email, password] of demo) {
    const found = await db.execute({ sql: 'select password_hash, password_salt from users where email = ?', args: [email] });
    const user = found.rows[0];
    if (user && await verifyPassword(password, user.password_salt, user.password_hash)) {
      console.warn(`[securite] ALERTE : le compte de demonstration ${email} utilise encore son mot de passe public. Change-le ou supprime-le immediatement.`);
    }
  }
}

server.listen(config.port, () => {
  console.log(`FestiConnect lance sur http://localhost:${server.address().port} (${config.nodeEnv})`);
  if (config.isProduction && !config.trustProxy) {
    console.warn('[config] TRUST_PROXY=0 : si l\'application est derriere un proxy (Render, Koyeb...), definis TRUST_PROXY=1, sinon tous les clients partagent la meme IP pour la limitation de debit.');
  }
  if (config.isProduction) {
    warnAboutDemoAccounts().catch((error) => console.error('[securite] verification des comptes de demo impossible', error?.message || error));
  } else if (process.env.RENDER || process.env.KOYEB_APP_NAME || process.env.KOYEB_SERVICE_NAME) {
    console.warn('[config] Plateforme d\'hebergement detectee mais NODE_ENV != production : cookies Secure et HSTS desactives.');
  }
});
