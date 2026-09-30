import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './src/config/env.js';
import { NOT_STARTED_SQL, db, eventTimeMs, limiters, randomId, requireUser, safely } from './src/app/context.js';
import { matchRoute, pathId, route, routes, searchParam } from './src/app/router.js';
import { buildInsert, insertByExistingColumns, tableColumns } from './src/db/schema.js';
import './src/features/notifications.js';
import { PAYMENT_METHODS } from './src/features/events.js';
import './src/features/promos.js';
import './src/features/checkin.js';
import { AppError, errorResponse, notFound } from './src/shared/errors.js';
import { parseBody, sendJson, serveStatic } from './src/shared/http.js';
import { dummyVerify, hashPassword, needsRehash, passwordPolicyError, verifyPassword } from './src/shared/passwords.js';
import { enforce, tooManyRequests } from './src/shared/rateLimit.js';
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

const EVENT_STATUSES = ['approved', 'pending', 'rejected'];
const SELF_SERVICE_ROLES = ['client', 'organisateur'];
const MAX_ORDER_LINES = 50;
const MAX_QUANTITY_PER_PRODUCT = 50;

const MINUTE = 60 * 1000;

function isEmailConstraintError(error) {
  return String(error?.message || '').includes('UNIQUE constraint failed: users.email');
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, city: user.city, phone: user.phone };
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

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

route('GET', '/api/health', ({ res }) => sendJson(res, 200, { status: 'ok', service: 'FestiConnect' }));

route('POST', '/api/auth/register', async ({ req, res, ip }) => {
  enforce(limiters.registerIp, ip);
  const body = await parseBody(req);
  if (!body.name || !body.email || !body.password) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Nom, email et mot de passe sont obligatoires.');
  }
  const name = v.text(body.name, { label: 'Nom', min: 2, max: 80, required: true });
  const email = v.email(body.email);
  const role = v.oneOf(body.role, SELF_SERVICE_ROLES, { label: 'Rôle', fallback: 'client' });
  const phone = v.phone(body.phone);
  const city = v.text(body.city, { label: 'Ville', max: 60, fallback: 'Abidjan' });
  const policyError = passwordPolicyError(body.password, { email, name });
  if (policyError) throw new AppError(422, 'WEAK_PASSWORD', policyError);

  const existing = await db.execute({ sql: 'select id from users where email = ?', args: [email] });
  if (existing.rows[0]) {
    throw new AppError(409, 'EMAIL_ALREADY_EXISTS', 'Un compte existe déjà avec cet email.');
  }
  const password = await hashPassword(body.password);
  const id = randomId('usr');
  try {
    await insertUserRecord({ id, name, email, password_hash: password.hash, password_salt: password.salt, role, phone, city });
  } catch (error) {
    if (isEmailConstraintError(error)) {
      throw new AppError(409, 'EMAIL_ALREADY_EXISTS', 'Un compte existe déjà avec cet email.');
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
    const quantity = v.integer(item.quantity, { label: 'Quantité', min: 1, max: MAX_QUANTITY_PER_PRODUCT, fallback: 1 });
    wanted.set(productId, (wanted.get(productId) || 0) + quantity);
  }
  const paymentMethod = v.oneOf(body.payment_method, PAYMENT_METHODS, { label: 'Moyen de paiement', fallback: 'Orange Money' });
  const deliveryCity = v.text(body.delivery_city, { label: 'Ville de livraison', max: 60, fallback: user.city || '' });
  const deliveryAddress = v.text(body.delivery_address, { label: 'Adresse', max: 300, multiline: true });

  let total = 0;
  const items = [];
  for (const [productId, quantity] of wanted) {
    if (quantity > MAX_QUANTITY_PER_PRODUCT) {
      throw new AppError(422, 'VALIDATION_ERROR', `Quantité maximale par produit : ${MAX_QUANTITY_PER_PRODUCT}.`);
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
    sql: `select tickets.*, events.title, events.city, events.location, events.starts_at, events.ends_at
          from tickets join events on events.id = tickets.event_id
          where tickets.user_id = ?
          order by datetime(coalesce(nullif(events.ends_at, ''), events.starts_at)) < datetime('now'), datetime(events.starts_at) asc`,
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
    throw new AppError(405, 'METHOD_NOT_ALLOWED', 'Méthode HTTP non autorisée.', { Allow: [...allowed].join(', ') });
  }
  return notFound(res);
}

async function routeStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    throw new AppError(405, 'METHOD_NOT_ALLOWED', 'Méthode HTTP non autorisée.', { Allow: 'GET, HEAD' });
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
