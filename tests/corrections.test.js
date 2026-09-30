// Corrections transverses : dates du seed, billetterie fermee apres le debut,
// messages d'erreur accentues cote serveur.
import assert from 'node:assert/strict';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { createClient } from '@libsql/client';
import { DEMO, isoIn, registerAndLogin, startServer } from './_helpers.js';

let srv;
let db;

before(async () => {
  srv = await startServer();
  db = createClient({ url: `file:${path.join(srv.dir, 'test.db')}` });
});

after(async () => {
  db?.close();
  await srv?.stop();
});

describe('seed de demonstration', () => {
  it('les evenements publics sont a venir, un evenement passe existe pour les avis', async () => {
    const list = await srv.api('/api/events');
    assert.equal(list.status, 200);
    assert.ok(list.json.events.length >= 3);
    for (const event of list.json.events) {
      assert.ok(Date.parse(`${event.ends_at}:00Z`) > Date.now(), `${event.id} doit etre a venir`);
    }
    assert.ok(!list.json.events.some((event) => event.id === 'evt_zouglou_past'), 'un evenement termine sort du catalogue');
    const past = await srv.api('/api/events/evt_zouglou_past');
    assert.equal(past.status, 200, 'la fiche passee reste accessible');
    assert.ok(Date.parse(`${past.json.event.starts_at}:00Z`) < Date.now());
  });

  it('les textes du seed sont accentues', async () => {
    const event = await srv.api('/api/events/evt_abissa_2026');
    assert.match(event.json.event.description, /célébration/);
    const mode = await srv.api('/api/events/evt_mode_sahel');
    assert.equal(mode.json.event.city, 'Bouaké');
  });
});

describe('billetterie fermee une fois l\'evenement commence', () => {
  it('refuse l\'achat pour un evenement termine (409 EVENT_STARTED)', async () => {
    const client = await srv.login(DEMO.client.email, DEMO.client.password);
    const response = await srv.api('/api/tickets', { method: 'POST', token: client.token, body: { event_id: 'evt_zouglou_past', quantity: 1 } });
    assert.equal(response.status, 409);
    assert.equal(response.json.error.code, 'EVENT_STARTED');
    assert.match(response.json.error.message, /déjà commencé/);
  });

  it('refuse l\'achat pour un evenement en cours, sans toucher aux places', async () => {
    const client = await registerAndLogin(srv);
    await db.execute({ sql: "update events set starts_at = ?, ends_at = ? where id = 'evt_mode_sahel'", args: [isoIn(-1, '10:00'), isoIn(1, '10:00')] });
    const before = await db.execute("select tickets_sold from events where id = 'evt_mode_sahel'");
    const response = await srv.api('/api/tickets', { method: 'POST', token: client.token, body: { event_id: 'evt_mode_sahel' } });
    assert.equal(response.status, 409);
    assert.equal(response.json.error.code, 'EVENT_STARTED');
    const afterRow = await db.execute("select tickets_sold from events where id = 'evt_mode_sahel'");
    assert.equal(Number(afterRow.rows[0].tickets_sold), Number(before.rows[0].tickets_sold));
    await db.execute({ sql: "update events set starts_at = ?, ends_at = ? where id = 'evt_mode_sahel'", args: [isoIn(16, '10:00'), isoIn(16, '20:00')] });
    assert.equal((await srv.api('/api/tickets', { method: 'POST', token: client.token, body: { event_id: 'evt_mode_sahel' } })).status, 201);
  });

  it('refuse la creation d\'un evenement dans le passe', async () => {
    const organizer = await srv.login(DEMO.organizer.email, DEMO.organizer.password);
    const response = await srv.api('/api/events', { method: 'POST', token: organizer.token, body: { title: 'Soirée passée', category: 'Concert', city: 'Abidjan', starts_at: isoIn(-2) } });
    assert.equal(response.status, 422);
    assert.match(response.json.error.message, /futur/);
  });
});

describe('messages d\'erreur en francais correct', () => {
  it('les messages serveur portent les accents', async () => {
    const organizer = await srv.login(DEMO.organizer.email, DEMO.organizer.password);
    const long = await srv.api('/api/events', { method: 'POST', token: organizer.token, body: { title: 'x'.repeat(200), category: 'Concert', city: 'Abidjan', starts_at: isoIn(5) } });
    assert.match(long.json.error.message, /dépasser 120 caractères/);
    const role = await srv.api('/api/admin/summary', { token: organizer.token });
    assert.equal(role.json.error.message, 'Accès refusé pour ce rôle.');
    const method = await srv.api('/api/events', { method: 'DELETE' });
    assert.equal(method.json.error.message, 'Méthode HTTP non autorisée.');
    const client = await registerAndLogin(srv);
    const quantity = await srv.api('/api/tickets', { method: 'POST', token: client.token, body: { event_id: 'evt_mode_sahel', quantity: 50 } });
    assert.match(quantity.json.error.message, /^Quantité doit être un nombre entier/);
  });
});
