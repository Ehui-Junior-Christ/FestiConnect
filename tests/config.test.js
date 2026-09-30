import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { after, describe, it } from 'node:test';
import { cleanEnv, root, runScript, tempDir } from './_helpers.js';

const STRONG_SECRET = 'k3y-de-test-tres-longue-et-aleatoire-0123456789abcdef';
const clientModule = pathToFileURL(path.join(root, 'src/db/client.js')).href;

// Charge la config + le client libSQL dans un processus isole (cwd sans .env).
function loadDb(env) {
  const script = `import(${JSON.stringify(clientModule)}).then((m) => { m.getDb(); console.log('DB_OK'); })`;
  return spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: tempDir(), env: cleanEnv(env), encoding: 'utf8' });
}

function output(result) {
  return `${result.stdout}\n${result.stderr}`;
}

describe('configuration et secrets', () => {
  it('accepte une base locale file: en developpement/test sans jeton', () => {
    const result = loadDb({ TURSO_DATABASE_URL: `file:${path.join(tempDir(), 'x.db')}` });
    assert.equal(result.status, 0, output(result));
    assert.match(result.stdout, /DB_OK/);
  });

  it('refuse une base locale file: en production', () => {
    const result = loadDb({ NODE_ENV: 'production', APP_SECRET: STRONG_SECRET, TURSO_DATABASE_URL: 'file:/tmp/prod.db' });
    assert.notEqual(result.status, 0);
    assert.match(output(result), /interdit en production/);
  });

  it('refuse de demarrer en production sans APP_SECRET, avec un placeholder ou un secret court', () => {
    const remote = { NODE_ENV: 'production', TURSO_DATABASE_URL: 'libsql://exemple.turso.io', TURSO_AUTH_TOKEN: 'jeton-de-test-valide' };
    for (const secret of [undefined, 'remplace-moi-par-une-cle-longue-et-aleatoire', 'trop-court']) {
      const env = { ...remote };
      if (secret) env.APP_SECRET = secret;
      const result = loadDb(env);
      assert.notEqual(result.status, 0, `APP_SECRET=${secret}`);
      assert.match(output(result), /APP_SECRET/);
    }
  });

  it('refuse un jeton Turso placeholder sans jamais afficher sa valeur', () => {
    const result = loadDb({
      NODE_ENV: 'production',
      APP_SECRET: STRONG_SECRET,
      TURSO_DATABASE_URL: 'libsql://exemple.turso.io',
      TURSO_AUTH_TOKEN: 'colle-ton-token-VALEURSECRETE'
    });
    assert.notEqual(result.status, 0);
    assert.match(output(result), /TURSO_AUTH_TOKEN/);
    assert.doesNotMatch(output(result), /VALEURSECRETE/);
  });

  it('refuse un schema d\'URL non chiffre en production', () => {
    const result = loadDb({ NODE_ENV: 'production', APP_SECRET: STRONG_SECRET, TURSO_DATABASE_URL: 'http://db.exemple.ci', TURSO_AUTH_TOKEN: 'jeton-de-test-valide' });
    assert.notEqual(result.status, 0);
    assert.match(output(result), /libsql:\/\//);
  });

  it('le seed de demonstration est refuse en production', () => {
    const result = runScript('src/db/seed.js', {
      cwd: tempDir(),
      env: cleanEnv({ NODE_ENV: 'production', APP_SECRET: STRONG_SECRET, TURSO_DATABASE_URL: 'libsql://exemple.turso.io', TURSO_AUTH_TOKEN: 'jeton-de-test-valide' })
    });
    assert.notEqual(result.status, 0);
    assert.match(output(result), /SEED_ALLOW_PRODUCTION/);
  });

  describe('serveur en mode production', () => {
    let child;
    let logs = '';
    after(() => child?.kill('SIGTERM'));

    it('envoie HSTS et ne divulgue pas les secrets dans les logs', async () => {
      child = spawn(process.execPath, [path.join(root, 'server.js')], {
        cwd: tempDir(),
        env: cleanEnv({
          NODE_ENV: 'production',
          PORT: '0',
          APP_SECRET: STRONG_SECRET,
          TURSO_DATABASE_URL: 'libsql://127.0.0.1:9',
          TURSO_AUTH_TOKEN: 'jeton-de-test-SECRET-XYZ'
        }),
        stdio: ['ignore', 'pipe', 'pipe']
      });
      child.stdout.on('data', (chunk) => { logs += chunk; });
      child.stderr.on('data', (chunk) => { logs += chunk; });
      const port = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(logs)), 10000);
        child.stdout.on('data', () => {
          const match = /localhost:(\d+)/.exec(logs);
          if (match) {
            clearTimeout(timer);
            resolve(match[1]);
          }
        });
      });
      const response = await fetch(`http://localhost:${port}/api/health`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('strict-transport-security'), 'max-age=31536000; includeSubDomains');
      const page = await fetch(`http://localhost:${port}/`);
      assert.equal(page.headers.get('strict-transport-security'), 'max-age=31536000; includeSubDomains');
      // Laisse le temps a la verification (en echec) des comptes de demo de journaliser.
      await new Promise((resolve) => setTimeout(resolve, 500));
      assert.doesNotMatch(logs, /SECRET-XYZ/);
      assert.doesNotMatch(logs, new RegExp(STRONG_SECRET));
    });
  });
});
