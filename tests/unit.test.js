import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import { describe, it } from 'node:test';

process.env.NODE_ENV = 'test';
const { hashPassword, verifyPassword, needsRehash, passwordPolicyError, dummyVerify } = await import('../src/shared/passwords.js');
const { RateLimiter } = await import('../src/shared/rateLimit.js');
const v = await import('../src/shared/validation.js');
const { getClientIp, isSecureRequest, assertSameOrigin, CONTENT_SECURITY_POLICY } = await import('../src/shared/security.js');
const { resolveStaticPath, parseCookies } = await import('../src/shared/http.js');
const { assertTable, assertIdentifier, buildInsert, clearSchemaCache } = await import('../src/db/schema.js');
const { hashSessionToken, sessionCookie, clearSessionCookie, requestTokens } = await import('../src/shared/sessions.js');
const { AppError, errorResponse } = await import('../src/shared/errors.js');
const { isPlaceholder } = await import('../src/config/env.js');

function fakeReq({ method = 'GET', headers = {}, remote = '203.0.113.9', encrypted = false } = {}) {
  return { method, headers, socket: { remoteAddress: remote, encrypted } };
}

describe('passwords', () => {
  it('hache avec scrypt aux parametres courants et un sel aleatoire', async () => {
    const a = await hashPassword('Festival2026!');
    const b = await hashPassword('Festival2026!');
    assert.match(a.hash, /^scrypt\$32768\$8\$3\$[0-9a-f]{128}$/);
    assert.notEqual(a.salt, b.salt);
    assert.notEqual(a.hash, b.hash);
    assert.equal(await verifyPassword('Festival2026!', a.salt, a.hash), true);
    assert.equal(await verifyPassword('festival2026!', a.salt, a.hash), false);
    assert.equal(needsRehash(a.hash), false);
  });

  it('verifie les anciens hash (scryptSync par defaut) et demande un rehash', async () => {
    const salt = crypto.randomBytes(16).toString('hex');
    const legacy = crypto.scryptSync('Client123!', salt, 64).toString('hex');
    assert.equal(await verifyPassword('Client123!', salt, legacy), true);
    assert.equal(await verifyPassword('Client1234', salt, legacy), false);
    assert.equal(needsRehash(legacy), true);
  });

  it('refuse les hash malformes, les entrees vides ou demesurees', async () => {
    const { salt, hash } = await hashPassword('Festival2026!');
    assert.equal(await verifyPassword('Festival2026!', salt, 'scrypt$3$8$1$abcd'), false);
    assert.equal(await verifyPassword('Festival2026!', salt, 'pas-un-hash'), false);
    assert.equal(await verifyPassword('Festival2026!', salt, null), false);
    assert.equal(await verifyPassword('', salt, hash), false);
    assert.equal(await verifyPassword({}, salt, hash), false);
    assert.equal(await verifyPassword('a'.repeat(5000), salt, hash), false);
    assert.equal(await dummyVerify('nimporte'), false);
  });

  it('applique la politique de mot de passe', () => {
    assert.equal(passwordPolicyError('Client123!'), null);
    assert.match(passwordPolicyError('Ab1'), /au moins 8/);
    assert.match(passwordPolicyError('abcdefgh'), /lettre et un chiffre/);
    assert.match(passwordPolicyError('12345678'), /lettre et un chiffre/);
    assert.match(passwordPolicyError('password123'), /trop courant/);
    assert.match(passwordPolicyError(`A1${'x'.repeat(200)}`), /dépasser 128/);
    assert.match(passwordPolicyError('awa.kone2026', { email: 'awa.kone@example.ci' }), /adresse email/);
    assert.match(passwordPolicyError(undefined), /obligatoire/);
  });
});

describe('rate limiter', () => {
  it('bloque au-dela du maximum puis se reinitialise apres la fenetre', () => {
    let now = 0;
    const limiter = new RateLimiter({ windowMs: 1000, max: 3, now: () => now });
    assert.equal(limiter.hit('a').limited, false);
    assert.equal(limiter.hit('a').limited, false);
    assert.equal(limiter.hit('a').limited, false);
    const blocked = limiter.hit('a');
    assert.equal(blocked.limited, true);
    assert.equal(blocked.retryAfterMs, 1000);
    assert.equal(limiter.check('a').limited, true);
    assert.equal(limiter.check('b').limited, false);
    now = 1001;
    assert.equal(limiter.check('a').limited, false);
    assert.equal(limiter.hit('a').limited, false);
    limiter.reset('a');
    assert.equal(limiter.store.has('a'), false);
    limiter.stop();
  });

  it('borne le nombre de cles en memoire', () => {
    const limiter = new RateLimiter({ windowMs: 60000, max: 1, maxKeys: 100 });
    for (let i = 0; i < 1000; i += 1) limiter.hit(`ip-${i}`);
    assert.ok(limiter.store.size <= 100);
    limiter.stop();
  });
});

describe('validation', () => {
  it('texte : longueur, caracteres de controle, balises', () => {
    assert.equal(v.text('  Abissa  ', { label: 'Titre', max: 10 }), 'Abissa');
    assert.throws(() => v.text('<script>alert(1)</script>', { label: 'Titre' }), /< ou >/);
    assert.throws(() => v.text('a\u0000b', { label: 'Titre' }), /non autorisés/);
    assert.throws(() => v.text('ligne\nligne', { label: 'Titre' }), /non autorisés/);
    assert.equal(v.text('ligne\nligne', { label: 'Description', multiline: true }), 'ligne\nligne');
    assert.throws(() => v.text('x'.repeat(11), { label: 'Titre', max: 10 }), /dépasser 10/);
    assert.throws(() => v.text({ a: 1 }, { label: 'Titre' }), /invalide/);
    assert.throws(() => v.text('', { label: 'Titre', required: true }), /obligatoire/);
    assert.equal(v.text(undefined, { label: 'Ville', fallback: 'Abidjan' }), 'Abidjan');
  });

  it('entiers bornes, pas de NaN, flottants ni notation exponentielle', () => {
    const opts = { label: 'Quantite', min: 1, max: 10 };
    assert.equal(v.integer('3', opts), 3);
    assert.equal(v.integer(3, opts), 3);
    assert.equal(v.integer('', { ...opts, fallback: 1 }), 1);
    for (const bad of ['abc', '1.5', 1.5, '1e3', 0, -1, 11, '0x10', NaN, Infinity, [], {}, true]) {
      assert.throws(() => v.integer(bad, opts), AppError, `valeur ${String(bad)}`);
    }
  });

  it('email, telephone, date, identifiant, whitelist', () => {
    assert.equal(v.email('  Awa@Example.CI '), 'awa@example.ci');
    for (const bad of ['pas-un-email', 'a@b', 'a..b@example.ci', 'a b@example.ci', `${'a'.repeat(65)}@example.ci`, 42]) {
      assert.throws(() => v.email(bad), /invalide|obligatoire/);
    }
    assert.equal(v.phone('+225 07 00 00 00 01'), '+225 07 00 00 00 01');
    assert.equal(v.phone(''), '');
    assert.throws(() => v.phone('appelle-moi'), /invalide/);
    assert.equal(v.dateTime('2026-10-01T20:00', { label: 'Date' }), '2026-10-01T20:00');
    assert.throws(() => v.dateTime('demain', { label: 'Date' }), /invalide/);
    assert.throws(() => v.dateTime('1900-01-01T00:00', { label: 'Date' }), /invalide/);
    assert.throws(() => v.dateTime('2026-13-01T00:00', { label: 'Date' }), /invalide/);
    assert.equal(v.isValidId('evt_abissa_2026'), true);
    assert.equal(v.isValidId("x' or '1'='1"), false);
    assert.throws(() => v.id('../etc', { label: 'Produit' }), /invalide/);
    assert.equal(v.oneOf(undefined, ['a'], { label: 'Role', fallback: 'a' }), 'a');
    assert.throws(() => v.oneOf('admin', ['client', 'organisateur'], { label: 'Role' }), /invalide/);
  });

  it("URL d'image : chemins locaux ou https uniquement", () => {
    const opts = { label: 'Image', fallback: '/assets/img/event-default.svg' };
    assert.equal(v.imageUrl('', opts), '/assets/img/event-default.svg');
    assert.equal(v.imageUrl('/assets/img/event-mode.svg', opts), '/assets/img/event-mode.svg');
    assert.equal(v.imageUrl('https://cdn.example.com/a/b.png', opts), 'https://cdn.example.com/a/b.png');
    for (const bad of ['javascript:alert(1)', 'http://example.com/a.png', '/assets/img/x.svg" onerror="alert(1)', '//evil.com/a.png', 'data:image/svg+xml,<svg>']) {
      assert.throws(() => v.imageUrl(bad, opts), /invalide/);
    }
  });
});

describe('securite HTTP', () => {
  it('IP cliente : X-Forwarded-For ignore sans proxy de confiance, lu depuis la droite sinon', () => {
    const req = fakeReq({ headers: { 'x-forwarded-for': '6.6.6.6, 198.51.100.7' }, remote: '::ffff:10.0.0.2' });
    assert.equal(getClientIp(req, 0), '10.0.0.2');
    assert.equal(getClientIp(req, 1), '198.51.100.7');
    assert.equal(getClientIp(req, 2), '6.6.6.6');
    assert.equal(getClientIp(fakeReq({ headers: { 'x-forwarded-for': 'pas-une-ip' }, remote: '10.0.0.3' }), 1), '10.0.0.3');
  });

  it('requete securisee : X-Forwarded-Proto seulement derriere un proxy de confiance', () => {
    const req = fakeReq({ headers: { 'x-forwarded-proto': 'https' } });
    assert.equal(isSecureRequest(req, 0), false);
    assert.equal(isSecureRequest(req, 1), true);
    assert.equal(isSecureRequest(fakeReq({ encrypted: true }), 0), true);
  });

  it('CSRF : origine verifiee sur les methodes mutantes', () => {
    const base = { host: 'festiconnect.ci' };
    const ok = (headers, opts) => assert.doesNotThrow(() => assertSameOrigin(fakeReq({ method: 'POST', headers: { ...base, ...headers } }), opts));
    const ko = (headers, opts) => assert.throws(() => assertSameOrigin(fakeReq({ method: 'POST', headers: { ...base, ...headers } }), opts), /Origine/);
    ok({ origin: 'https://festiconnect.ci' });
    ok({ referer: 'https://festiconnect.ci/admin.html' });
    ko({ origin: 'https://evil.example' });
    ko({ origin: 'null' });
    ko({ origin: 'https://festiconnect.ci.evil.example' });
    ko({ referer: 'https://evil.example/festiconnect.ci' });
    ko({ 'sec-fetch-site': 'cross-site' });
    ko({}, { hasCookieSession: true, hasBearer: false });
    ok({}, { hasCookieSession: true, hasBearer: true });
    ok({}, { hasCookieSession: false });
    assert.doesNotThrow(() => assertSameOrigin(fakeReq({ method: 'GET', headers: { ...base, origin: 'https://evil.example' } })));
  });

  it('CSP conforme a la cible', () => {
    assert.equal(CONTENT_SECURITY_POLICY, "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'");
  });

  it('fichiers statiques : traversal, dotfiles, octets nuls refuses', () => {
    const rootDir = path.resolve('/srv/app/public');
    assert.equal(resolveStaticPath(rootDir, '/'), path.join(rootDir, 'index.html'));
    assert.equal(resolveStaticPath(rootDir, '/assets/css/styles.css'), path.join(rootDir, 'assets/css/styles.css'));
    for (const bad of ['/../server.js', '/..%2fserver.js', '/%2e%2e/%2e%2e/etc/passwd', '/.env', '/assets/.secret', '/a%00.html', '/%E0%A4%A', '/..\\server.js', '/assets/..%5c..%5cserver.js']) {
      assert.equal(resolveStaticPath(rootDir, bad), null, bad);
    }
    // Un dossier voisin au prefixe identique ("public-old") ne doit pas etre atteignable.
    assert.equal(resolveStaticPath(rootDir, '/..%2fpublic-old/x.html'), null);
  });

  it('cookies : parsing robuste', () => {
    const cookies = parseCookies({ headers: { cookie: 'a=1; fc_session=%E0%A4%A; b; =x; c=%20ok' } });
    assert.equal(cookies.a, '1');
    assert.equal(cookies.fc_session, undefined);
    assert.equal(cookies.c, ' ok');
    assert.equal(Object.getPrototypeOf(cookies), null);
  });
});

describe('schema (anti-injection sur les identifiants)', () => {
  it('whitelist des tables et validation des colonnes', () => {
    assert.equal(assertTable('users'), 'users');
    assert.throws(() => assertTable('users; drop table users'), /non autorisee/);
    assert.throws(() => assertTable('sqlite_master'), /non autorisee/);
    assert.throws(() => assertIdentifier('name) values (1); --'), /invalide/);
  });

  it("buildInsert n'utilise que les colonnes existantes et des parametres", async () => {
    clearSchemaCache();
    const fakeDb = {
      async execute(sql) {
        assert.equal(sql, 'pragma table_info(events)');
        return { rows: [{ name: 'id', type: 'TEXT' }, { name: 'title', type: 'TEXT' }] };
      }
    };
    const insert = await buildInsert(fakeDb, 'events', { id: 'evt_1', title: "x'); drop table users; --", 'evil) values (1); --': 1 });
    assert.equal(insert.sql, 'insert into events (id, title) values (?, ?)');
    assert.deepEqual(insert.args, ['evt_1', "x'); drop table users; --"]);
    await assert.rejects(() => buildInsert(fakeDb, 'secrets', { id: 1 }), /non autorisee/);
    clearSchemaCache();
  });
});

describe('sessions', () => {
  it('stocke un HMAC du jeton, jamais le jeton ni un simple SHA-256', () => {
    const token = 'a'.repeat(64);
    const stored = hashSessionToken(token);
    assert.match(stored, /^[0-9a-f]{64}$/);
    assert.notEqual(stored, token);
    assert.notEqual(stored, crypto.createHash('sha256').update(token).digest('hex'));
  });

  it('cookie HttpOnly, SameSite=Strict, Path=/, Secure si demande', () => {
    const plain = sessionCookie('b'.repeat(64), { secure: false });
    assert.match(plain, /HttpOnly/);
    assert.match(plain, /SameSite=Strict/);
    assert.match(plain, /Path=\//);
    assert.doesNotMatch(plain, /Secure/);
    assert.match(sessionCookie('b'.repeat(64), { secure: true }), /; Secure$/);
    assert.match(clearSessionCookie({ secure: true }), /Max-Age=0; Secure$/);
  });

  it("n'accepte que des jetons au bon format", () => {
    const good = 'c'.repeat(64);
    assert.deepEqual(requestTokens({ headers: { authorization: `Bearer ${good}` } }).map((t) => t.source), ['bearer']);
    assert.deepEqual(requestTokens({ headers: { authorization: 'Bearer undefined', cookie: `fc_session=${good}` } }).map((t) => t.source), ['cookie']);
    assert.deepEqual(requestTokens({ headers: { authorization: "Bearer ' or 1=1 --" } }), []);
  });
});

describe('erreurs', () => {
  function fakeRes() {
    return {
      headersSent: false, status: 0, headers: {}, body: '',
      setHeader(name, value) { this.headers[name] = value; },
      writeHead(status, headers) { this.status = status; Object.assign(this.headers, headers); },
      end(body) { this.body = body; }
    };
  }

  it('une erreur interne ne fuit ni message SQL ni pile', () => {
    const res = fakeRes();
    const original = console.error;
    console.error = () => {};
    try {
      errorResponse(res, new Error('SQLITE_ERROR: no such column: password_hash in select * from users'));
    } finally {
      console.error = original;
    }
    assert.equal(res.status, 500);
    assert.deepEqual(JSON.parse(res.body), { error: { code: 'INTERNAL_ERROR', message: 'Erreur interne du serveur.' } });
  });

  it('une AppError transmet code, message et en-tetes', () => {
    const res = fakeRes();
    errorResponse(res, new AppError(429, 'RATE_LIMITED', 'Trop', { 'Retry-After': '60' }));
    assert.equal(res.status, 429);
    assert.equal(res.headers['Retry-After'], '60');
  });
});

describe('config', () => {
  it('detecte les valeurs d\'exemple', () => {
    assert.equal(isPlaceholder('colle-ton-token-turso-ici'), true);
    assert.equal(isPlaceholder('remplace-moi-par-une-cle-longue-et-aleatoire'), true);
    assert.equal(isPlaceholder('eyJhbGciOiJFZERTQSJ9.reel'), false);
  });
});
