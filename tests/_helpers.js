// Outils communs aux tests d'integration : base SQLite locale temporaire
// (migrate + seed), serveur reel demarre dans un processus fils, client HTTP.
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const INHERITED_BLOCKLIST = [
  'NODE_ENV', 'APP_SECRET', 'TRUST_PROXY', 'APP_ORIGIN', 'CSP_REPORT_ONLY', 'PORT',
  'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'SEED_ALLOW_PRODUCTION',
  'SEED_ADMIN_PASSWORD', 'SEED_ORGANIZER_PASSWORD', 'SEED_CLIENT_PASSWORD', 'NODE_OPTIONS'
];

export function cleanEnv(extra = {}) {
  const env = { ...process.env };
  for (const key of INHERITED_BLOCKLIST) delete env[key];
  return { ...env, NODE_ENV: 'test', ...extra };
}

// Repertoire de travail isole : aucun fichier .env du depot n'est charge.
export function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'festiconnect-test-'));
}

export function runScript(script, { cwd, env }) {
  return spawnSync(process.execPath, [path.join(root, script)], { cwd, env, encoding: 'utf8' });
}

export function prepareDatabase({ seed = true } = {}) {
  const dir = tempDir();
  const env = cleanEnv({ TURSO_DATABASE_URL: `file:${path.join(dir, 'test.db')}` });
  for (const script of seed ? ['src/db/migrate.js', 'src/db/seed.js'] : ['src/db/migrate.js']) {
    const result = runScript(script, { cwd: dir, env });
    if (result.status !== 0) throw new Error(`${script} a echoue:\n${result.stderr}`);
  }
  return { dir, env };
}

export function randomIp() {
  const bytes = crypto.randomBytes(3);
  return `10.${bytes[0]}.${bytes[1]}.${bytes[2]}`;
}

export async function startServer({ env: extraEnv = {}, seed = true } = {}) {
  const { dir, env } = prepareDatabase({ seed });
  const child = spawn(process.execPath, [path.join(root, 'server.js')], {
    cwd: dir,
    env: { ...env, PORT: '0', TRUST_PROXY: '1', ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });

  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Le serveur ne demarre pas:\n${output}`)), 10000);
    const onData = () => {
      const match = /http:\/\/localhost:(\d+)/.exec(output);
      if (match) {
        clearTimeout(timer);
        resolve(Number(match[1]));
      }
    };
    child.stdout.on('data', onData);
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Le serveur s'est arrete (code ${code}):\n${output}`));
    });
  });
  const base = `http://localhost:${port}`;

  async function api(pathname, { method = 'GET', body, token, cookie, ip, headers = {} } = {}) {
    const finalHeaders = { 'x-forwarded-for': ip || randomIp(), ...headers };
    let payload;
    if (body !== undefined) {
      payload = typeof body === 'string' ? body : JSON.stringify(body);
      if (!Object.keys(finalHeaders).some((key) => key.toLowerCase() === 'content-type')) {
        finalHeaders['content-type'] = 'application/json';
      }
    }
    if (token) finalHeaders.authorization = `Bearer ${token}`;
    if (cookie) finalHeaders.cookie = cookie;
    const response = await fetch(base + pathname, { method, headers: finalHeaders, body: payload, redirect: 'manual' });
    const text = await response.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    return { status: response.status, headers: response.headers, json, text };
  }

  async function login(email, password, { ip, headers } = {}) {
    const response = await api('/api/auth/login', { method: 'POST', body: { email, password }, ip, headers });
    const setCookie = response.headers.get('set-cookie') || '';
    const cookieValue = /fc_session=([^;]*)/.exec(setCookie)?.[1];
    return { ...response, token: response.json?.token, setCookie, cookie: cookieValue ? `fc_session=${cookieValue}` : '' };
  }

  async function stop() {
    if (child.exitCode !== null) return;
    await new Promise((resolve) => {
      child.once('exit', resolve);
      child.kill('SIGTERM');
    });
  }

  return { base, api, login, stop, child, logs: () => output, dir };
}

let uniqueCounter = 0;
export function uniqueEmail(prefix = 'user') {
  uniqueCounter += 1;
  return `${prefix}.${Date.now()}.${uniqueCounter}.${crypto.randomBytes(2).toString('hex')}@test.festiconnect.ci`;
}

// Cree un compte (client ou organisateur) et renvoie sa session.
export async function registerAndLogin(srv, role = 'client') {
  const email = uniqueEmail(role);
  const password = 'Festival2026!';
  const created = await srv.api('/api/auth/register', { method: 'POST', body: { name: `Test ${role}`, email, password, role } });
  if (created.status !== 201) throw new Error(`inscription: ${created.status} ${created.text}`);
  const session = await srv.login(email, password);
  if (session.status !== 200) throw new Error(`login: ${session.status} ${session.text}`);
  return { ...session, id: created.json.id, email, password };
}

// Date AAAA-MM-JJTHH:MM (heure d'Abidjan = UTC) decalee de `days` jours.
export function isoIn(days, time = '20:00') {
  return `${new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)}T${time}`;
}

// Cree puis valide un evenement ; `session` = organisateur (demo par defaut).
export async function createApprovedEvent(srv, { session, admin, body = {} } = {}) {
  const organizer = session || await srv.login(DEMO.organizer.email, DEMO.organizer.password);
  const created = await srv.api('/api/events', {
    method: 'POST',
    token: organizer.token,
    body: { title: `Concert test ${crypto.randomBytes(3).toString('hex')}`, category: 'Concert', city: 'Abidjan', starts_at: isoIn(30), price_xof: 1000, capacity: 5, ...body }
  });
  if (created.status !== 201) throw new Error(`creation: ${created.status} ${created.text}`);
  const adminSession = admin || await srv.login(DEMO.admin.email, DEMO.admin.password);
  const approved = await srv.api(`/api/events/${created.json.id}/status`, { method: 'PATCH', token: adminSession.token, body: { status: 'approved' } });
  if (approved.status !== 200) throw new Error(`validation: ${approved.status} ${approved.text}`);
  return created.json.id;
}

export const DEMO = {
  admin: { email: 'admin@festiconnect.ci', password: 'Admin123!' },
  organizer: { email: 'organisateur@festiconnect.ci', password: 'Orga123!' },
  client: { email: 'client@festiconnect.ci', password: 'Client123!' }
};
