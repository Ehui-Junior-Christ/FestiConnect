import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from './src/db/client.js';
import { AppError, errorResponse, notFound } from './src/shared/errors.js';
import { hashPassword, verifyPassword } from './src/shared/passwords.js';
import { parseBody, parseCookies, sendJson, serveFile } from './src/shared/http.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'public');
const db = getDb();
const port = Number(process.env.PORT || 3000);

function randomId(prefix) {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 18)}`;
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isEmailConstraintError(error) {
  return String(error?.message || '').includes('UNIQUE constraint failed: users.email');
}

async function tableColumns(table) {
  const info = await db.execute(`pragma table_info(${table})`);
  return new Set(info.rows.map((row) => row.name));
}

async function insertUserRecord(user) {
  const columns = await tableColumns('users');
  const record = {
    id: user.id,
    name: user.name,
    email: user.email.toLowerCase(),
    password_hash: user.password_hash,
    password_salt: user.password_salt,
    role: user.role,
    phone: user.phone || '',
    city: user.city || 'Abidjan',
    balance: 0,
    createdAt: new Date().toISOString(),
    created_at: new Date().toISOString()
  };
  if (columns.has('password')) record.password = user.password_hash;
  const entries = Object.entries(record).filter(([key]) => columns.has(key));
  await db.execute({
    sql: `insert into users (${entries.map(([key]) => key).join(', ')}) values (${entries.map(() => '?').join(', ')})`,
    args: entries.map(([, value]) => value)
  });
}

async function insertByExistingColumns(table, record) {
  const info = await db.execute(`pragma table_info(${table})`);
  const columns = new Map(info.rows.map((row) => [row.name, row]));
  const entries = Object.entries(record).filter(([key, value]) => {
    const column = columns.get(key);
    if (!column) return false;
    if (key === 'id' && String(column.type).toUpperCase().includes('INT') && typeof value === 'string') return false;
    return true;
  });
  await db.execute({
    sql: `insert into ${table} (${entries.map(([key]) => key).join(', ')}) values (${entries.map(() => '?').join(', ')})`,
    args: entries.map(([, value]) => value)
  });
}

async function countOrdersForUser(userId) {
  const columns = await tableColumns('orders');
  const userColumn = columns.has('user_id') ? 'user_id' : 'userId';
  const orders = await db.execute({ sql: `select count(*) as count from orders where ${userColumn} = ?`, args: [userId] });
  return orders.rows[0].count;
}

async function incrementEventSales(eventId, quantity) {
  const columns = await tableColumns('events');
  const sets = [];
  const args = [];
  if (columns.has('tickets_sold')) {
    sets.push('tickets_sold = tickets_sold + ?');
    args.push(quantity);
  }
  if (columns.has('ticketsSold')) {
    sets.push('ticketsSold = ticketsSold + ?');
    args.push(quantity);
  }
  if (!sets.length) return;
  args.push(eventId);
  await db.execute({ sql: `update events set ${sets.join(', ')} where id = ?`, args });
}

async function getUserFromRequest(req) {
  const auth = req.headers.authorization || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const cookieToken = parseCookies(req).fc_session || '';
  const token = bearer || cookieToken;
  if (!token) return null;

  const result = await db.execute({
    sql: `select users.id, users.name, users.email, users.role, users.phone, users.city
          from sessions
          join users on users.id = sessions.user_id
          where sessions.token_hash = ? and sessions.expires_at > datetime('now')`,
    args: [tokenHash(token)]
  });
  return result.rows[0] || null;
}

async function requireUser(req, roles = []) {
  const user = await getUserFromRequest(req);
  if (!user) throw new AppError(401, 'AUTH_REQUIRED', 'Connexion requise.');
  if (roles.length && !roles.includes(user.role)) {
    throw new AppError(403, 'FORBIDDEN', 'Acces refuse pour ce role.');
  }
  return user;
}

async function routeApi(req, res, url) {
  const method = req.method || 'GET';
  const pathname = url.pathname;

  if (method === 'GET' && pathname === '/api/health') {
    return sendJson(res, 200, { status: 'ok', service: 'FestiConnect' });
  }

  if (method === 'POST' && pathname === '/api/auth/register') {
    const body = await parseBody(req);
    const email = normalizeEmail(body.email);
    const role = ['client', 'organisateur'].includes(body.role) ? body.role : 'client';
    if (!body.name || !email || !body.password) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Nom, email et mot de passe sont obligatoires.');
    }
    if (!email.includes('@')) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Adresse email invalide.');
    }
    const existing = await db.execute({ sql: 'select id from users where email = ?', args: [email] });
    if (existing.rows[0]) {
      throw new AppError(409, 'EMAIL_ALREADY_EXISTS', 'Un compte existe deja avec cet email.');
    }
    const password = hashPassword(body.password);
    const id = randomId('usr');
    try {
      await insertUserRecord({
        id,
        name: body.name,
        email,
        password_hash: password.hash,
        password_salt: password.salt,
        role,
        phone: body.phone,
        city: body.city
      });
    } catch (error) {
      if (isEmailConstraintError(error)) {
        throw new AppError(409, 'EMAIL_ALREADY_EXISTS', 'Un compte existe deja avec cet email.');
      }
      throw error;
    }
    return sendJson(res, 201, { id, name: body.name, email, role });
  }

  if (method === 'POST' && pathname === '/api/auth/login') {
    const body = await parseBody(req);
    const found = await db.execute({ sql: 'select * from users where email = ?', args: [normalizeEmail(body.email)] });
    const user = found.rows[0];
    if (!user || !verifyPassword(body.password || '', user.password_salt, user.password_hash)) {
      throw new AppError(401, 'BAD_CREDENTIALS', 'Email ou mot de passe incorrect.');
    }
    const token = crypto.randomBytes(32).toString('hex');
    await db.execute({
      sql: `insert into sessions (id, user_id, token_hash, expires_at) values (?, ?, ?, datetime('now', '+14 days'))`,
      args: [randomId('ses'), user.id, tokenHash(token)]
    });
    res.setHeader('Set-Cookie', `fc_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=1209600`);
    return sendJson(res, 200, {
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, city: user.city, phone: user.phone }
    });
  }

  if (method === 'POST' && pathname === '/api/auth/logout') {
    const token = (req.headers.authorization || '').replace('Bearer ', '') || parseCookies(req).fc_session || '';
    if (token) await db.execute({ sql: 'delete from sessions where token_hash = ?', args: [tokenHash(token)] });
    res.setHeader('Set-Cookie', 'fc_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
    return sendJson(res, 200, { ok: true });
  }

  if (method === 'GET' && pathname === '/api/me') {
    return sendJson(res, 200, { user: await getUserFromRequest(req) });
  }

  if (method === 'GET' && pathname === '/api/events') {
    const q = `%${url.searchParams.get('q') || ''}%`;
    const category = url.searchParams.get('category') || '';
    const city = url.searchParams.get('city') || '';
    const status = url.searchParams.get('status') || 'approved';
    const result = await db.execute({
      sql: `select events.*, users.name as organizer_name
            from events join users on users.id = events.organizer_id
            where events.status = ?
              and (events.title like ? or events.description like ? or events.city like ?)
              and (? = '' or events.category = ?)
              and (? = '' or events.city = ?)
            order by datetime(events.starts_at) asc`,
      args: [status, q, q, q, category, category, city, city]
    });
    return sendJson(res, 200, { events: result.rows });
  }

  const eventMatch = pathname.match(/^\/api\/events\/([^/]+)$/);
  if (method === 'GET' && eventMatch) {
    const result = await db.execute({
      sql: `select events.*, users.name as organizer_name
            from events join users on users.id = events.organizer_id
            where events.id = ?`,
      args: [eventMatch[1]]
    });
    if (!result.rows[0]) return notFound(res);
    return sendJson(res, 200, { event: result.rows[0] });
  }

  if (method === 'POST' && pathname === '/api/events') {
    const user = await requireUser(req, ['organisateur', 'admin']);
    const body = await parseBody(req);
    if (!body.title || !body.category || !body.city || !body.starts_at) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Titre, categorie, ville et date sont obligatoires.');
    }
    const id = randomId('evt');
    const startsAt = body.starts_at;
    const price = Number(body.price_xof || 0);
    const capacity = Number(body.capacity || 100);
    await insertByExistingColumns('events', {
      id,
      organizer_id: user.id,
      organizerId: user.id,
      title: body.title,
      category: body.category,
      city: body.city,
      location: body.location || body.city,
      starts_at: startsAt,
      ends_at: body.ends_at || startsAt,
      date: startsAt,
      price_xof: price,
      price,
      capacity,
      ticketsCapacity: capacity,
      tickets_sold: 0,
      ticketsSold: 0,
      status: user.role === 'admin' ? 'approved' : 'pending',
      cover_url: body.cover_url || '/assets/img/event-default.svg',
      image: body.cover_url || '/assets/img/event-default.svg',
      description: body.description || '',
      created_at: new Date().toISOString()
    });
    return sendJson(res, 201, { id });
  }

  const statusMatch = pathname.match(/^\/api\/events\/([^/]+)\/status$/);
  if (method === 'PATCH' && statusMatch) {
    await requireUser(req, ['admin']);
    const body = await parseBody(req);
    if (!['approved', 'pending', 'rejected'].includes(body.status)) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Statut invalide.');
    }
    await db.execute({ sql: 'update events set status = ? where id = ?', args: [body.status, statusMatch[1]] });
    return sendJson(res, 200, { ok: true });
  }

  if (method === 'POST' && pathname === '/api/tickets') {
    const user = await requireUser(req, ['client', 'admin']);
    const body = await parseBody(req);
    const event = await db.execute({ sql: 'select * from events where id = ? and status = ?', args: [body.event_id, 'approved'] });
    const row = event.rows[0];
    if (!row) throw new AppError(404, 'EVENT_NOT_FOUND', 'Evenement introuvable.');
    const quantity = Math.max(1, Number(body.quantity || 1));
    const amount = quantity * Number(row.price_xof || 0);
    const id = randomId('tkt');
    const code = `FC-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
    await insertByExistingColumns('tickets', {
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
      payment_method: body.payment_method || 'Wave',
      created_at: new Date().toISOString(),
      createdAt: new Date().toISOString()
    });
    await incrementEventSales(row.id, quantity);
    return sendJson(res, 201, { id, amount_xof: amount });
  }

  if (method === 'GET' && pathname === '/api/products') {
    const products = await db.execute({ sql: 'select * from products order by created_at desc', args: [] });
    return sendJson(res, 200, { products: products.rows });
  }

  const productMatch = pathname.match(/^\/api\/products\/([^/]+)$/);
  if (method === 'GET' && productMatch) {
    const product = await db.execute({ sql: 'select * from products where id = ?', args: [productMatch[1]] });
    if (!product.rows[0]) return notFound(res);
    return sendJson(res, 200, { product: product.rows[0] });
  }

  if (method === 'POST' && pathname === '/api/orders') {
    const user = await requireUser(req, ['client', 'admin']);
    const body = await parseBody(req);
    if (!Array.isArray(body.items) || !body.items.length) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Le panier est vide.');
    }
    let total = 0;
    const items = [];
    for (const item of body.items) {
      const product = await db.execute({ sql: 'select * from products where id = ?', args: [item.product_id] });
      if (!product.rows[0]) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Produit introuvable.');
      const quantity = Math.max(1, Number(item.quantity || 1));
      total += Number(product.rows[0].price_xof) * quantity;
      items.push({ product: product.rows[0], quantity });
    }
    const orderId = randomId('ord');
    const paymentMethod = body.payment_method || 'Orange Money';
    await insertByExistingColumns('orders', {
      id: orderId,
      user_id: user.id,
      userId: user.id,
      total_xof: total,
      total,
      status: 'paid',
      payment_method: paymentMethod,
      paymentMethod,
      delivery_city: body.delivery_city || user.city,
      addressCity: body.delivery_city || user.city,
      delivery_address: body.delivery_address || '',
      addressDetails: body.delivery_address || '',
      addressName: user.name,
      date: new Date().toISOString(),
      created_at: new Date().toISOString()
    });
    for (const item of items) {
      await insertByExistingColumns('order_items', {
        id: randomId('oit'),
        order_id: orderId,
        orderId,
        product_id: item.product.id,
        productId: item.product.id,
        title: item.product.name || item.product.title,
        quantity: item.quantity,
        unit_price_xof: item.product.price_xof || item.product.price,
        price: item.product.price_xof || item.product.price
      });
    }
    return sendJson(res, 201, { id: orderId, total_xof: total, status: 'paid' });
  }

  if (method === 'GET' && pathname === '/api/client/summary') {
    const user = await requireUser(req, ['client', 'admin']);
    const tickets = await db.execute({ sql: 'select count(*) as count, coalesce(sum(amount_xof), 0) as spent from tickets where user_id = ?', args: [user.id] });
    const orders = await countOrdersForUser(user.id);
    return sendJson(res, 200, { summary: { tickets: tickets.rows[0].count, spent: tickets.rows[0].spent, orders, points: Number(tickets.rows[0].count) * 120 } });
  }

  if (method === 'GET' && pathname === '/api/client/tickets') {
    const user = await requireUser(req, ['client', 'admin']);
    const tickets = await db.execute({
      sql: `select tickets.*, events.title, events.city, events.location, events.starts_at
            from tickets join events on events.id = tickets.event_id
            where tickets.user_id = ?
            order by datetime(tickets.created_at) desc`,
      args: [user.id]
    });
    return sendJson(res, 200, { tickets: tickets.rows });
  }

  if (method === 'GET' && pathname === '/api/organizer/summary') {
    const user = await requireUser(req, ['organisateur', 'admin']);
    const orgId = user.role === 'admin' && url.searchParams.get('organizer_id') ? url.searchParams.get('organizer_id') : user.id;
    const events = await db.execute({ sql: 'select count(*) as count, coalesce(sum(tickets_sold), 0) as sold from events where organizer_id = ?', args: [orgId] });
    const revenue = await db.execute({
      sql: `select coalesce(sum(tickets.amount_xof), 0) as revenue
            from tickets join events on events.id = tickets.event_id
            where events.organizer_id = ?`,
      args: [orgId]
    });
    return sendJson(res, 200, { summary: { events: events.rows[0].count, sold: events.rows[0].sold, revenue: revenue.rows[0].revenue, conversion: 68 } });
  }

  if (method === 'GET' && pathname === '/api/organizer/events') {
    const user = await requireUser(req, ['organisateur', 'admin']);
    const result = await db.execute({
      sql: `select * from events where organizer_id = ? order by datetime(created_at) desc`,
      args: [user.id]
    });
    return sendJson(res, 200, { events: result.rows });
  }

  if (method === 'GET' && pathname === '/api/organizer/tickets') {
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
  }

  if (method === 'GET' && pathname === '/api/admin/summary') {
    await requireUser(req, ['admin']);
    const users = await db.execute({ sql: 'select count(*) as count from users', args: [] });
    const events = await db.execute({ sql: 'select count(*) as count from events', args: [] });
    const pending = await db.execute({ sql: `select count(*) as count from events where status = 'pending'`, args: [] });
    const revenue = await db.execute({ sql: 'select coalesce(sum(amount_xof), 0) as total from tickets', args: [] });
    return sendJson(res, 200, { summary: { users: users.rows[0].count, events: events.rows[0].count, pending: pending.rows[0].count, volume: revenue.rows[0].total } });
  }

  if (method === 'GET' && pathname === '/api/admin/events') {
    await requireUser(req, ['admin']);
    const status = url.searchParams.get('status') || '';
    const result = await db.execute({
      sql: `select events.*, users.name as organizer_name
            from events join users on users.id = events.organizer_id
            where (? = '' or events.status = ?)
            order by datetime(events.created_at) desc`,
      args: [status, status]
    });
    return sendJson(res, 200, { events: result.rows });
  }

  return notFound(res);
}

async function routeStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const filePath = path.normalize(path.join(publicDir, pathname));
  if (!filePath.startsWith(publicDir)) return notFound(res);
  try {
    await fs.access(filePath);
    return serveFile(res, filePath);
  } catch {
    return serveFile(res, path.join(publicDir, 'index.html'));
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) return await routeApi(req, res, url);
    return await routeStatic(req, res, url);
  } catch (error) {
    return errorResponse(res, error);
  }
});

server.listen(port, () => {
  console.log(`FestiConnect lance sur http://localhost:${port}`);
});
