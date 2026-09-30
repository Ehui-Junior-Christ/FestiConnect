// Favoris : ajout / retrait, isolation par compte, synchronisation de la liste locale.
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { DEMO, registerAndLogin, startServer } from './_helpers.js';

let srv;

before(async () => {
  srv = await startServer();
});

after(async () => {
  await srv?.stop();
});

describe('favoris', () => {
  it('connexion requise', async () => {
    assert.equal((await srv.api('/api/favorites')).status, 401);
    assert.equal((await srv.api('/api/favorites/evt_abissa_2026', { method: 'PUT' })).status, 401);
    assert.equal((await srv.api('/api/favorites/sync', { method: 'POST', body: { event_ids: [] } })).status, 401);
  });

  it('garder puis retirer un evenement, idempotent, isole par compte', async () => {
    const user = await registerAndLogin(srv);
    const other = await registerAndLogin(srv);
    for (let i = 0; i < 2; i += 1) {
      const saved = await srv.api('/api/favorites/evt_maquis_night', { method: 'PUT', token: user.token });
      assert.equal(saved.status, 200, saved.text);
    }
    const list = await srv.api('/api/favorites', { token: user.token });
    assert.deepEqual(list.json.ids, ['evt_maquis_night']);
    assert.equal(list.json.events[0].title, 'Maquis Electronic Night');
    assert.deepEqual((await srv.api('/api/favorites', { token: other.token })).json.ids, []);
    await srv.api('/api/favorites/evt_maquis_night', { method: 'DELETE', token: other.token });
    assert.deepEqual((await srv.api('/api/favorites', { token: user.token })).json.ids, ['evt_maquis_night'], 'un autre compte ne retire rien');
    assert.equal((await srv.api('/api/favorites/evt_maquis_night', { method: 'DELETE', token: user.token })).status, 200);
    assert.deepEqual((await srv.api('/api/favorites', { token: user.token })).json.ids, []);
  });

  it('refuse les evenements non publies ou inexistants', async () => {
    const user = await registerAndLogin(srv);
    assert.equal((await srv.api('/api/favorites/evt_pending_yakro', { method: 'PUT', token: user.token })).status, 404);
    assert.equal((await srv.api('/api/favorites/evt_inconnu', { method: 'PUT', token: user.token })).status, 404);
    assert.equal((await srv.api('/api/favorites/%3Cscript%3E', { method: 'PUT', token: user.token })).status, 404);
  });

  it('synchronise la liste locale a la connexion en ignorant les identifiants invalides', async () => {
    const user = await registerAndLogin(srv);
    await srv.api('/api/favorites/evt_mode_sahel', { method: 'PUT', token: user.token });
    const synced = await srv.api('/api/favorites/sync', {
      method: 'POST', token: user.token,
      body: { event_ids: ['evt_abissa_2026', 'evt_abissa_2026', 'evt_pending_yakro', 'evt_inconnu', '<x>', 42, { id: 'evt_maquis_night' }] }
    });
    assert.equal(synced.status, 200, synced.text);
    assert.deepEqual([...synced.json.ids].sort(), ['evt_abissa_2026', 'evt_mode_sahel']);
    for (const body of [{ event_ids: 'evt_abissa_2026' }, { event_ids: Array.from({ length: 101 }, (_, i) => `evt_${i}`) }]) {
      assert.equal((await srv.api('/api/favorites/sync', { method: 'POST', token: user.token, body })).status, 422);
    }
  });

  it('protection CSRF sur l\'ajout par cookie', async () => {
    const user = await registerAndLogin(srv);
    const response = await srv.api('/api/favorites/evt_abissa_2026', { method: 'PUT', cookie: user.cookie, headers: { origin: 'https://evil.example' } });
    assert.equal(response.status, 403);
  });

  it('le client de demonstration a deux evenements gardes', async () => {
    const client = await srv.login(DEMO.client.email, DEMO.client.password);
    const list = await srv.api('/api/favorites', { token: client.token });
    assert.deepEqual([...list.json.ids].sort(), ['evt_abissa_2026', 'evt_mode_sahel']);
  });
});
