import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dbPath = path.join(root, 'register-test.db');
const port = 3299;
const env = {
  ...process.env,
  PORT: String(port),
  TURSO_DATABASE_URL: `file:${dbPath}`,
  TURSO_AUTH_TOKEN: 'dev'
};

for (const suffix of ['', '-shm', '-wal']) {
  try {
    fs.unlinkSync(`${dbPath}${suffix}`);
  } catch {
    // Ignore missing temp files.
  }
}

const migrate = spawnSync('node', ['src/db/migrate.js'], { cwd: root, env, stdio: 'inherit' });
if (migrate.status !== 0) process.exit(migrate.status || 1);

const server = spawn('node', ['server.js'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`http://localhost:${port}/api/health`);
      if (response.ok) return;
    } catch {
      await wait(150);
    }
  }
  throw new Error('Le serveur de test ne demarre pas.');
}

try {
  await waitForServer();
  const payload = {
    name: 'Client Test',
    email: '  Duplicate-Test@FestiConnect.ci  ',
    password: 'Client123!',
    role: 'client',
    city: 'Abidjan'
  };

  const first = await fetch(`http://localhost:${port}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (first.status !== 201) {
    throw new Error(`Premiere inscription attendue 201, recue ${first.status}`);
  }

  const second = await fetch(`http://localhost:${port}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await second.json();
  if (second.status !== 409 || body.error?.code !== 'EMAIL_ALREADY_EXISTS') {
    throw new Error(`Doublon attendu 409 EMAIL_ALREADY_EXISTS, recu ${second.status}`);
  }

  const invalid = await fetch(`http://localhost:${port}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Email Invalide', email: 'pas-un-email', password: 'Client123!' })
  });
  if (invalid.status !== 422) {
    throw new Error(`Email invalide attendu 422, recu ${invalid.status}`);
  }

  console.log('register.test.js passed');
} finally {
  server.kill();
}
