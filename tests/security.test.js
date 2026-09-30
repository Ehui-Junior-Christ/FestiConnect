import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { createClient } from '@libsql/client';
import { DEMO, startServer } from './_helpers.js';

const EXPECTED_CSP = "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'";

let srv;
let db;
let counter = 0;

function uniqueEmail(prefix = 'user') {
  counter += 1;
  return `${prefix}.${Date.now()}.${counter}@test.festiconnect.ci`;
}

async function registerAndLogin(role = 'client') {
  const email = uniqueEmail(role);
  const password = 'Festival2026!';
  const created = await srv.api('/api/auth/register', { method: 'POST', body: { name: `Test ${role}`, email, password, role } });
  assert.equal(created.status, 201, created.text);
  const session = await srv.login(email, password);
  assert.equal(session.status, 200, session.text);
  return { ...session, id: created.json.id, email, password };
}

function rawRequest(pathname, { method = 'GET', headers = {}, body } = {}) {
  const { port } = new URL(srv.base);
  return new Promise((resolve, reject) => {
    const req = http.request({ host: 'localhost', port, path: pathname, method, headers }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function createApprovedEvent({ capacity = 5, price = 1000 } = {}) {
  const organizer = await srv.login(DEMO.organizer.email, DEMO.organizer.password);
  const created = await srv.api('/api/events', {
    method: 'POST',
    token: organizer.token,
    body: { title: `Concert test ${counter++}`, category: 'Concert', city: 'Abidjan', starts_at: '2027-01-10T20:00', price_xof: String(price), capacity: String(capacity) }
  });
  assert.equal(created.status, 201, created.text);
  const admin = await srv.login(DEMO.admin.email, DEMO.admin.password);
  const approved = await srv.api(`/api/events/${created.json.id}/status`, { method: 'PATCH', token: admin.token, body: { status: 'approved' } });
  assert.equal(approved.status, 200, approved.text);
  return created.json.id;
}

before(async () => {
  srv = await startServer();
  db = createClient({ url: `file:${path.join(srv.dir, 'test.db')}` });
});

after(async () => {
  db?.close();
  await srv?.stop();
});

describe('en-tetes de securite', () => {
  it('sont presents sur les pages et sur l\'API', async () => {
    for (const pathname of ['/', '/api/health', '/assets/css/styles.css', '/inexistant.html', '/api/inconnu']) {
      const response = await srv.api(pathname);
      const h = response.headers;
      assert.equal(h.get('content-security-policy'), EXPECTED_CSP, pathname);
      assert.equal(h.get('x-content-type-options'), 'nosniff', pathname);
      assert.equal(h.get('x-frame-options'), 'DENY', pathname);
      assert.equal(h.get('referrer-policy'), 'strict-origin-when-cross-origin', pathname);
      assert.match(h.get('permissions-policy'), /camera=\(\)/, pathname);
      assert.equal(h.get('cross-origin-opener-policy'), 'same-origin', pathname);
      assert.equal(h.get('x-powered-by'), null, pathname);
      assert.equal(h.get('strict-transport-security'), null, 'pas de HSTS hors production');
    }
    assert.equal((await srv.api('/api/health')).headers.get('cache-control'), 'no-store');
  });
});

describe('fichiers statiques', () => {
  it('sert les fichiers avec le bon Content-Type', async () => {
    const cases = { '/': 'text/html; charset=utf-8', '/assets/css/styles.css': 'text/css; charset=utf-8', '/assets/js/api.js': 'text/javascript; charset=utf-8', '/assets/img/event-default.svg': 'image/svg+xml' };
    for (const [pathname, type] of Object.entries(cases)) {
      const response = await srv.api(pathname);
      assert.equal(response.status, 200, pathname);
      assert.equal(response.headers.get('content-type'), type, pathname);
    }
    const head = await rawRequest('/index.html', { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(head.body, '');
  });

  it('bloque le path traversal et les fichiers caches', async () => {
    for (const pathname of ['/../server.js', '/..%2fserver.js', '/%2e%2e/%2e%2e/etc/passwd', '/assets/..%2f..%2fpackage.json', '/.env', '/.git/config', '/assets/%00.js', '/%E0%A4%A', '/..%5cserver.js']) {
      const response = await rawRequest(pathname);
      assert.equal(response.status, 404, pathname);
      assert.doesNotMatch(response.body, /@libsql|createServer|root:/, pathname);
    }
  });

  it('un dossier ne fait plus planter le serveur (EISDIR)', async () => {
    for (const pathname of ['/assets/', '/assets', '/assets/img/']) {
      assert.equal((await srv.api(pathname)).status, 404, pathname);
    }
    assert.equal((await srv.api('/api/health')).status, 200);
  });

  it('refuse les methodes non GET/HEAD', async () => {
    const response = await srv.api('/index.html', { method: 'POST', body: {} });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('allow'), 'GET, HEAD');
  });
});

describe('robustesse des requetes', () => {
  it('refuse un corps > 100 Ko (413) sans tomber', async () => {
    const response = await srv.api('/api/auth/register', { method: 'POST', body: JSON.stringify({ name: 'x'.repeat(200 * 1024) }) });
    assert.equal(response.status, 413);
    assert.equal(response.json.error.code, 'PAYLOAD_TOO_LARGE');
    const chunked = await rawRequest('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'transfer-encoding': 'chunked' },
      body: `{"email":"${'a'.repeat(150 * 1024)}"}`
    });
    assert.equal(chunked.status, 413);
    assert.equal((await srv.api('/api/health')).status, 200);
  });

  it('JSON invalide => 400, corps non objet => 400, mauvais Content-Type => 415', async () => {
    const invalid = await srv.api('/api/auth/login', { method: 'POST', body: '{"email":' });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.json.error.code, 'INVALID_JSON');
    const array = await srv.api('/api/auth/login', { method: 'POST', body: '[1,2]' });
    assert.equal(array.status, 400);
    const form = await srv.api('/api/auth/login', { method: 'POST', body: 'email=a&password=b', headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    assert.equal(form.status, 415);
  });

  it('methode non autorisee => 405 + Allow, route inconnue => 404', async () => {
    const response = await srv.api('/api/events', { method: 'DELETE' });
    assert.equal(response.status, 405);
    assert.match(response.headers.get('allow'), /GET/);
    assert.match(response.headers.get('allow'), /POST/);
    assert.equal((await srv.api('/api/nope')).status, 404);
  });

  it('les erreurs ne divulguent ni pile ni SQL', async () => {
    const response = await srv.api("/api/events/evt'%20or%201=1--");
    assert.equal(response.status, 404);
    const search = await srv.api(`/api/events?q=${encodeURIComponent("' union select * from users --")}`);
    assert.equal(search.status, 200);
    assert.deepEqual(search.json.events, []);
    assert.doesNotMatch(search.text, /password/);
  });
});

describe('authentification et sessions', () => {
  it('inscription : impossible de s\'attribuer le role admin', async () => {
    const response = await srv.api('/api/auth/register', { method: 'POST', body: { name: 'Pirate', email: uniqueEmail('admin'), password: 'Festival2026!', role: 'admin' } });
    assert.equal(response.status, 422);
    const users = await db.execute({ sql: "select count(*) as n from users where role = 'admin'", args: [] });
    assert.equal(Number(users.rows[0].n), 1);
  });

  it('inscription : politique de mot de passe et validation des champs', async () => {
    const weak = await srv.api('/api/auth/register', { method: 'POST', body: { name: 'Awa', email: uniqueEmail(), password: '1234' } });
    assert.equal(weak.status, 422);
    assert.equal(weak.json.error.code, 'WEAK_PASSWORD');
    const xss = await srv.api('/api/auth/register', { method: 'POST', body: { name: '<img src=x onerror=alert(1)>', email: uniqueEmail(), password: 'Festival2026!' } });
    assert.equal(xss.status, 422);
    const objectName = await srv.api('/api/auth/register', { method: 'POST', body: { name: { $gt: '' }, email: uniqueEmail(), password: 'Festival2026!' } });
    assert.equal(objectName.status, 422);
    const phone = await srv.api('/api/auth/register', { method: 'POST', body: { name: 'Awa', email: uniqueEmail(), password: 'Festival2026!', phone: 'pas un numero' } });
    assert.equal(phone.status, 422);
  });

  it('mot de passe stocke en scrypt, jeton de session stocke en HMAC', async () => {
    const user = await registerAndLogin();
    const row = await db.execute({ sql: 'select password_hash from users where email = ?', args: [user.email] });
    assert.match(row.rows[0].password_hash, /^scrypt\$32768\$8\$3\$/);
    const sessions = await db.execute({ sql: 'select token_hash from sessions where user_id = ?', args: [user.id] });
    const sha = crypto.createHash('sha256').update(user.token).digest('hex');
    for (const session of sessions.rows) {
      assert.notEqual(session.token_hash, user.token);
      assert.notEqual(session.token_hash, sha);
    }
  });

  it('login : message identique pour email inconnu et mauvais mot de passe', async () => {
    const unknown = await srv.api('/api/auth/login', { method: 'POST', body: { email: uniqueEmail('inconnu'), password: 'Festival2026!' } });
    const wrong = await srv.api('/api/auth/login', { method: 'POST', body: { email: DEMO.client.email, password: 'Mauvais2026!' } });
    assert.equal(unknown.status, 401);
    assert.equal(wrong.status, 401);
    assert.deepEqual(unknown.json, wrong.json);
  });

  it('cookie de session : HttpOnly, SameSite=Strict, Path=/, Secure derriere HTTPS', async () => {
    const plain = await srv.login(DEMO.client.email, DEMO.client.password);
    assert.match(plain.setCookie, /^fc_session=[0-9a-f]{64}; HttpOnly; SameSite=Strict; Path=\/; Max-Age=1209600$/);
    const https = await srv.login(DEMO.client.email, DEMO.client.password, { headers: { 'x-forwarded-proto': 'https' } });
    assert.match(https.setCookie, /; Secure$/);
  });

  it('logout invalide la session cote serveur (Bearer et cookie)', async () => {
    const user = await registerAndLogin();
    assert.equal((await srv.api('/api/me', { token: user.token })).json.user.email, user.email);
    assert.equal((await srv.api('/api/me', { cookie: user.cookie })).json.user.email, user.email);
    const out = await srv.api('/api/auth/logout', { method: 'POST', token: user.token, body: {} });
    assert.equal(out.status, 200);
    assert.match(out.headers.get('set-cookie'), /fc_session=; .*Max-Age=0/);
    assert.equal((await srv.api('/api/me', { token: user.token })).json.user, null);
    assert.equal((await srv.api('/api/client/tickets', { token: user.token })).status, 401);
  });

  it('logout-all revoque toutes les sessions de l\'utilisateur', async () => {
    const user = await registerAndLogin();
    const second = await srv.login(user.email, user.password);
    const response = await srv.api('/api/auth/logout-all', { method: 'POST', token: second.token, body: {} });
    assert.equal(response.status, 200);
    assert.equal((await srv.api('/api/me', { token: user.token })).json.user, null);
    assert.equal((await srv.api('/api/me', { token: second.token })).json.user, null);
    assert.equal((await srv.api('/api/auth/logout-all', { method: 'POST', body: {} })).status, 401);
  });

  it('rotation : un nouveau login revoque la session presentee', async () => {
    const user = await registerAndLogin();
    const again = await srv.login(user.email, user.password, { headers: { authorization: `Bearer ${user.token}` } });
    assert.equal(again.status, 200);
    assert.notEqual(again.token, user.token);
    assert.equal((await srv.api('/api/me', { token: user.token })).json.user, null);
    assert.equal((await srv.api('/api/me', { token: again.token })).json.user.email, user.email);
  });

  it('session expiree refusee', async () => {
    const user = await registerAndLogin();
    await db.execute({ sql: "update sessions set expires_at = datetime('now', '-1 minute') where user_id = ?", args: [user.id] });
    assert.equal((await srv.api('/api/client/summary', { token: user.token })).status, 401);
  });

  it('les anciens hash sont migres vers les nouveaux parametres au login', async () => {
    const email = uniqueEmail('legacy');
    const salt = crypto.randomBytes(16).toString('hex');
    const legacyHash = crypto.scryptSync('Ancien2025!', salt, 64).toString('hex');
    await db.execute({
      sql: "insert into users (id, name, email, password_hash, password_salt, role) values (?, 'Legacy', ?, ?, ?, 'client')",
      args: [`usr_legacy_${counter++}`, email, legacyHash, salt]
    });
    const session = await srv.login(email, 'Ancien2025!');
    assert.equal(session.status, 200);
    const row = await db.execute({ sql: 'select password_hash from users where email = ?', args: [email] });
    assert.match(row.rows[0].password_hash, /^scrypt\$32768\$/);
    assert.equal((await srv.login(email, 'Ancien2025!')).status, 200);
  });
});

describe('limitation de debit (brute force)', () => {
  it('bloque le login apres 5 echecs (compte + IP), meme avec le bon mot de passe', async () => {
    const user = await registerAndLogin();
    const ip = '203.0.113.50';
    for (let i = 0; i < 5; i += 1) {
      assert.equal((await srv.login(user.email, 'Mauvais2026!', { ip })).status, 401);
    }
    const blocked = await srv.login(user.email, user.password, { ip });
    assert.equal(blocked.status, 429);
    assert.equal(blocked.json.error.code, 'RATE_LIMITED');
    assert.ok(Number(blocked.headers.get('retry-after')) > 0);
    // L'utilisateur legitime depuis une autre IP n'est pas bloque.
    assert.equal((await srv.login(user.email, user.password, { ip: '203.0.113.51' })).status, 200);
  });

  it('les entrees X-Forwarded-For ajoutees par le client ne contournent pas la limite', async () => {
    const user = await registerAndLogin();
    for (let i = 0; i < 5; i += 1) {
      const spoofed = { 'x-forwarded-for': `198.51.100.${i}, 203.0.113.60` };
      assert.equal((await srv.api('/api/auth/login', { method: 'POST', body: { email: user.email, password: 'Mauvais2026!' }, headers: spoofed })).status, 401);
    }
    const blocked = await srv.api('/api/auth/login', { method: 'POST', body: { email: user.email, password: user.password }, headers: { 'x-forwarded-for': '192.0.2.99, 203.0.113.60' } });
    assert.equal(blocked.status, 429);
  });

  it('limite les inscriptions par IP', async () => {
    const ip = '203.0.113.70';
    const statuses = [];
    for (let i = 0; i < 11; i += 1) {
      statuses.push((await srv.api('/api/auth/register', { method: 'POST', ip, body: { name: 'Flood', email: uniqueEmail('flood'), password: 'Festival2026!' } })).status);
    }
    assert.deepEqual(statuses.slice(0, 10), Array(10).fill(201));
    assert.equal(statuses[10], 429);
  });
});

describe('CSRF', () => {
  it('refuse une requete mutante venant d\'une autre origine', async () => {
    const user = await registerAndLogin();
    const evil = await srv.api('/api/auth/logout-all', { method: 'POST', cookie: user.cookie, body: {}, headers: { origin: 'https://evil.example' } });
    assert.equal(evil.status, 403);
    assert.equal(evil.json.error.code, 'CSRF_REJECTED');
    const nullOrigin = await srv.api('/api/auth/login', { method: 'POST', body: { email: user.email, password: user.password }, headers: { origin: 'null' } });
    assert.equal(nullOrigin.status, 403);
    const referer = await srv.api('/api/orders', { method: 'POST', cookie: user.cookie, body: { items: [{ product_id: 'prd_kente_cap' }] }, headers: { referer: 'https://evil.example/page' } });
    assert.equal(referer.status, 403);
    const site = await srv.api('/api/auth/logout', { method: 'POST', cookie: user.cookie, body: {}, headers: { 'sec-fetch-site': 'cross-site' } });
    assert.equal(site.status, 403);
    assert.equal((await srv.api('/api/me', { cookie: user.cookie })).json.user.email, user.email);
  });

  it('refuse une requete mutante authentifiee par cookie sans Origin ni Referer', async () => {
    const user = await registerAndLogin();
    const response = await srv.api('/api/auth/logout-all', { method: 'POST', cookie: user.cookie, body: {} });
    assert.equal(response.status, 403);
  });

  it('accepte la meme origine (cookie) et les appels Bearer', async () => {
    const user = await registerAndLogin();
    const { host } = new URL(srv.base);
    const sameOrigin = await srv.api('/api/tickets', { method: 'POST', cookie: user.cookie, body: { event_id: 'evt_mode_sahel' }, headers: { origin: `http://${host}` } });
    assert.equal(sameOrigin.status, 201, sameOrigin.text);
    const bearer = await srv.api('/api/tickets', { method: 'POST', token: user.token, body: { event_id: 'evt_mode_sahel' } });
    assert.equal(bearer.status, 201, bearer.text);
  });
});

describe('autorisations (roles et IDOR)', () => {
  it('anonyme => 401 sur les espaces prives', async () => {
    for (const pathname of ['/api/client/summary', '/api/client/tickets', '/api/organizer/summary', '/api/organizer/events', '/api/organizer/tickets', '/api/admin/summary', '/api/admin/events']) {
      assert.equal((await srv.api(pathname)).status, 401, pathname);
    }
    assert.equal((await srv.api('/api/tickets', { method: 'POST', body: { event_id: 'evt_mode_sahel' } })).status, 401);
  });

  it('client => 403 sur organisateur/admin', async () => {
    const client = await srv.login(DEMO.client.email, DEMO.client.password);
    for (const pathname of ['/api/organizer/summary', '/api/organizer/events', '/api/organizer/tickets', '/api/admin/summary', '/api/admin/events']) {
      assert.equal((await srv.api(pathname, { token: client.token })).status, 403, pathname);
    }
    assert.equal((await srv.api('/api/events/evt_pending_yakro/status', { method: 'PATCH', token: client.token, body: { status: 'approved' } })).status, 403);
    assert.equal((await srv.api('/api/events', { method: 'POST', token: client.token, body: { title: 'x', category: 'y', city: 'z', starts_at: '2027-01-01T10:00' } })).status, 403);
  });

  it('organisateur => 403 sur admin et sur l\'achat', async () => {
    const organizer = await srv.login(DEMO.organizer.email, DEMO.organizer.password);
    assert.equal((await srv.api('/api/admin/summary', { token: organizer.token })).status, 403);
    assert.equal((await srv.api('/api/events/evt_pending_yakro/status', { method: 'PATCH', token: organizer.token, body: { status: 'approved' } })).status, 403);
    assert.equal((await srv.api('/api/tickets', { method: 'POST', token: organizer.token, body: { event_id: 'evt_mode_sahel' } })).status, 403);
  });

  it('un organisateur ne voit que ses evenements et ses ventes', async () => {
    const other = await registerAndLogin('organisateur');
    assert.deepEqual((await srv.api('/api/organizer/events', { token: other.token })).json.events, []);
    assert.deepEqual((await srv.api('/api/organizer/tickets', { token: other.token })).json.tickets, []);
    const summary = await srv.api('/api/organizer/summary?organizer_id=usr_orga_demo', { token: other.token });
    assert.equal(Number(summary.json.summary.events), 0, 'organizer_id ignore pour un non-admin');
  });

  it('un client ne voit que ses billets', async () => {
    const other = await registerAndLogin('client');
    const tickets = await srv.api('/api/client/tickets', { token: other.token });
    assert.deepEqual(tickets.json.tickets, []);
    assert.equal(Number((await srv.api('/api/client/summary', { token: other.token })).json.summary.tickets), 0);
  });

  it('les evenements non valides ne sont pas publics', async () => {
    const list = await srv.api('/api/events?status=pending');
    assert.ok(list.json.events.length > 0);
    assert.ok(list.json.events.every((event) => event.status === 'approved'));
    assert.equal((await srv.api('/api/events/evt_pending_yakro')).status, 404);
    const other = await registerAndLogin('organisateur');
    assert.equal((await srv.api('/api/events/evt_pending_yakro', { token: other.token })).status, 404);
    const owner = await srv.login(DEMO.organizer.email, DEMO.organizer.password);
    assert.equal((await srv.api('/api/events/evt_pending_yakro', { token: owner.token })).status, 200);
    const admin = await srv.login(DEMO.admin.email, DEMO.admin.password);
    assert.equal((await srv.api('/api/events/evt_pending_yakro', { token: admin.token })).status, 200);
    const pending = await srv.api('/api/admin/events?status=pending', { token: admin.token });
    assert.ok(pending.json.events.every((event) => event.status === 'pending'));
    assert.equal((await srv.api('/api/admin/events?status=hack', { token: admin.token })).status, 422);
  });

  it('admin : statut en whitelist, evenement inexistant => 404', async () => {
    const admin = await srv.login(DEMO.admin.email, DEMO.admin.password);
    assert.equal((await srv.api('/api/events/evt_pending_yakro/status', { method: 'PATCH', token: admin.token, body: { status: 'published' } })).status, 422);
    assert.equal((await srv.api('/api/events/evt_inexistant/status', { method: 'PATCH', token: admin.token, body: { status: 'approved' } })).status, 404);
  });
});

describe('validation metier et prix', () => {
  it('creation d\'evenement : champs valides', async () => {
    const organizer = await srv.login(DEMO.organizer.email, DEMO.organizer.password);
    const base = { title: 'Festival test', category: 'Concert', city: 'Abidjan', starts_at: '2027-02-01T20:00' };
    const bad = [
      { title: '<script>alert(1)</script>' },
      { starts_at: 'demain soir' },
      { price_xof: '-5' },
      { price_xof: 'gratuit' },
      { capacity: '0' },
      { capacity: '1e9' },
      { cover_url: 'javascript:alert(1)' },
      { cover_url: '/assets/img/x.svg" onerror="alert(1)' },
      { ends_at: '2027-01-01T20:00' },
      { description: 'x'.repeat(6000) }
    ];
    for (const patch of bad) {
      const response = await srv.api('/api/events', { method: 'POST', token: organizer.token, body: { ...base, ...patch } });
      assert.equal(response.status, 422, JSON.stringify(patch));
    }
    const ok = await srv.api('/api/events', { method: 'POST', token: organizer.token, body: { ...base, price_xof: '', capacity: '', status: 'approved', organizer_id: 'usr_admin_demo' } });
    assert.equal(ok.status, 201);
    const row = await db.execute({ sql: 'select status, organizer_id, capacity from events where id = ?', args: [ok.json.id] });
    assert.equal(row.rows[0].status, 'pending', 'le statut envoye par le client est ignore');
    assert.equal(row.rows[0].organizer_id, 'usr_orga_demo', "l'organisateur envoye par le client est ignore");
  });

  it('billets : quantite bornee, prix calcule cote serveur, paiement en whitelist', async () => {
    const client = await registerAndLogin();
    for (const quantity of ['abc', 0, -3, 1.5, 11, '1e2']) {
      const response = await srv.api('/api/tickets', { method: 'POST', token: client.token, body: { event_id: 'evt_mode_sahel', quantity } });
      assert.equal(response.status, 422, `quantity=${quantity}`);
    }
    assert.equal((await srv.api('/api/tickets', { method: 'POST', token: client.token, body: { event_id: 'evt_mode_sahel', payment_method: 'Cheque' } })).status, 422);
    assert.equal((await srv.api('/api/tickets', { method: 'POST', token: client.token, body: {} })).status, 422);
    assert.equal((await srv.api('/api/tickets', { method: 'POST', token: client.token, body: { event_id: 'evt_pending_yakro' } })).status, 404);
    const response = await srv.api('/api/tickets', { method: 'POST', token: client.token, body: { event_id: 'evt_mode_sahel', quantity: '2', price_xof: 1, amount_xof: 1 } });
    assert.equal(response.status, 201);
    assert.equal(response.json.amount_xof, 16000);
  });

  it('commandes : prix du serveur, quantites bornees, produits existants', async () => {
    const client = await registerAndLogin();
    const order = await srv.api('/api/orders', {
      method: 'POST',
      token: client.token,
      body: { items: [{ product_id: 'prd_kente_cap', quantity: 2, price_xof: 1 }, { product_id: 'prd_kente_cap', quantity: '1' }], total_xof: 3, payment_method: 'Wave' }
    });
    assert.equal(order.status, 201, order.text);
    assert.equal(order.json.total_xof, 36000);
    const items = await db.execute({ sql: 'select quantity, unit_price_xof from order_items where order_id = ?', args: [order.json.id] });
    assert.equal(items.rows.length, 1);
    assert.equal(Number(items.rows[0].quantity), 3);
    assert.equal(Number(items.rows[0].unit_price_xof), 12000);
    const cases = [
      { items: [] },
      { items: 'prd_kente_cap' },
      { items: [{ product_id: 'prd_kente_cap', quantity: 0 }] },
      { items: [{ product_id: 'prd_kente_cap', quantity: 'NaN' }] },
      { items: [{ product_id: 'prd_kente_cap', quantity: 51 }] },
      { items: [{ product_id: { $ne: null } }] },
      { items: Array.from({ length: 51 }, () => ({ product_id: 'prd_kente_cap' })) },
      { items: [{ product_id: 'prd_kente_cap' }], payment_method: 'Bitcoin' },
      { items: [{ product_id: 'prd_kente_cap' }], delivery_address: '<script>' }
    ];
    for (const body of cases) {
      assert.equal((await srv.api('/api/orders', { method: 'POST', token: client.token, body })).status, 422, JSON.stringify(body).slice(0, 80));
    }
    assert.equal((await srv.api('/api/orders', { method: 'POST', token: client.token, body: { items: [{ product_id: 'prd_inconnu' }] } })).status, 404);
  });
});

describe('pas de survente (capacite et stock atomiques)', () => {
  it('capacite d\'un evenement respectee sous achats concurrents', async () => {
    const eventId = await createApprovedEvent({ capacity: 5, price: 1000 });
    const buyers = await Promise.all([registerAndLogin(), registerAndLogin(), registerAndLogin()]);
    const attempts = Array.from({ length: 12 }, (_, i) => srv.api('/api/tickets', {
      method: 'POST', token: buyers[i % buyers.length].token, body: { event_id: eventId, quantity: 1 }
    }));
    const statuses = (await Promise.all(attempts)).map((response) => response.status);
    assert.equal(statuses.filter((status) => status === 201).length, 5, statuses.join(','));
    assert.ok(statuses.filter((status) => status !== 201).every((status) => status === 409), statuses.join(','));
    const row = await db.execute({ sql: 'select tickets_sold from events where id = ?', args: [eventId] });
    assert.equal(Number(row.rows[0].tickets_sold), 5);
    const count = await db.execute({ sql: 'select coalesce(sum(quantity), 0) as n from tickets where event_id = ?', args: [eventId] });
    assert.equal(Number(count.rows[0].n), 5);
    const tooMany = await srv.api('/api/tickets', { method: 'POST', token: buyers[0].token, body: { event_id: eventId, quantity: 1 } });
    assert.equal(tooMany.json.error.code, 'SOLD_OUT');
  });

  it('stock produit respecte, avec compensation si une ligne echoue', async () => {
    await db.execute({ sql: "update products set stock = 3 where id = 'prd_affiche_abissa'", args: [] });
    await db.execute({ sql: "update products set stock = 100 where id = 'prd_baule_tote'", args: [] });
    const buyers = await Promise.all([registerAndLogin(), registerAndLogin()]);
    const attempts = Array.from({ length: 6 }, (_, i) => srv.api('/api/orders', {
      method: 'POST', token: buyers[i % 2].token, body: { items: [{ product_id: 'prd_affiche_abissa', quantity: 1 }] }
    }));
    const statuses = (await Promise.all(attempts)).map((response) => response.status);
    assert.equal(statuses.filter((status) => status === 201).length, 3, statuses.join(','));
    const stock = await db.execute({ sql: "select stock from products where id = 'prd_affiche_abissa'", args: [] });
    assert.equal(Number(stock.rows[0].stock), 0);

    const mixed = await srv.api('/api/orders', {
      method: 'POST', token: buyers[0].token,
      body: { items: [{ product_id: 'prd_baule_tote', quantity: 2 }, { product_id: 'prd_affiche_abissa', quantity: 1 }] }
    });
    assert.equal(mixed.status, 409);
    assert.equal(mixed.json.error.code, 'OUT_OF_STOCK');
    const tote = await db.execute({ sql: "select stock from products where id = 'prd_baule_tote'", args: [] });
    assert.equal(Number(tote.rows[0].stock), 100, 'le stock deja reserve est restitue');
  });
});

describe('stabilite', () => {
  it('aucune erreur interne ni exception non geree pendant la suite', async () => {
    assert.equal((await srv.api('/api/health')).status, 200);
    assert.doesNotMatch(srv.logs(), /\[erreur\]|uncaughtException|unhandledRejection/, srv.logs());
  });
});
