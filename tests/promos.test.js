// Codes promo : creation reservee au proprietaire, calcul serveur, usage
// atomique, expiration, limitation de debit de la verification.
import assert from 'node:assert/strict';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { createClient } from '@libsql/client';
import { DEMO, createApprovedEvent, isoIn, registerAndLogin, startServer } from './_helpers.js';

let srv;
let db;
let organizer;
let admin;

async function createPromo(eventId, body, session = organizer) {
  return srv.api('/api/organizer/promos', { method: 'POST', token: session.token, body: { event_id: eventId, ...body } });
}

before(async () => {
  srv = await startServer();
  db = createClient({ url: `file:${path.join(srv.dir, 'test.db')}` });
  organizer = await srv.login(DEMO.organizer.email, DEMO.organizer.password);
  admin = await srv.login(DEMO.admin.email, DEMO.admin.password);
});

after(async () => {
  db?.close();
  await srv?.stop();
});

describe('gestion des codes promo', () => {
  it('reservee a l\'organisateur de l\'evenement (IDOR)', async () => {
    const eventId = await createApprovedEvent(srv, { session: organizer, admin, body: { capacity: 50 } });
    const other = await registerAndLogin(srv, 'organisateur');
    const client = await registerAndLogin(srv);
    assert.equal((await createPromo(eventId, { code: 'VOL10', kind: 'percent', value: 10 }, other)).status, 404);
    assert.equal((await createPromo(eventId, { code: 'VOL10', kind: 'percent', value: 10 }, client)).status, 403);
    assert.equal((await srv.api('/api/organizer/promos', { method: 'POST', body: { event_id: eventId, code: 'X10', kind: 'percent', value: 10 } })).status, 401);
    const created = await createPromo(eventId, { code: 'owner10', kind: 'percent', value: 10 });
    assert.equal(created.status, 201, created.text);
    assert.equal(created.json.code, 'OWNER10');
    assert.equal((await srv.api(`/api/organizer/promos/${created.json.id}`, { method: 'PATCH', token: other.token, body: { active: false } })).status, 404);
    assert.ok(!(await srv.api('/api/organizer/promos', { token: other.token })).json.promos.some((promo) => promo.id === created.json.id));
    assert.ok((await srv.api('/api/organizer/promos', { token: organizer.token })).json.promos.some((promo) => promo.id === created.json.id));
    assert.equal((await createPromo(eventId, { code: 'OWNER10', kind: 'fixed', value: 500 })).status, 409, 'code unique par evenement');
  });

  it('valide le code, le type, la valeur et l\'expiration', async () => {
    const eventId = await createApprovedEvent(srv, { session: organizer, admin, body: { capacity: 50 } });
    const bad = [
      { code: 'A', kind: 'percent', value: 10 },
      { code: 'ESPACE 10', kind: 'percent', value: 10 },
      { code: '<X>', kind: 'percent', value: 10 },
      { code: 'OK10', kind: 'gratuit', value: 10 },
      { code: 'OK10', kind: 'percent', value: 0 },
      { code: 'OK10', kind: 'percent', value: 101 },
      { code: 'OK10', kind: 'fixed', value: 50 },
      { code: 'OK10', kind: 'percent', value: 10, max_uses: -1 },
      { code: 'OK10', kind: 'percent', value: 10, expires_at: isoIn(-1) },
      { code: 'OK10', kind: 'percent', value: 10, expires_at: 'demain' }
    ];
    for (const body of bad) {
      assert.equal((await createPromo(eventId, body)).status, 422, JSON.stringify(body));
    }
  });
});

describe('application a l\'achat', () => {
  it('remise calculee cote serveur (pourcentage et montant fixe)', async () => {
    const eventId = await createApprovedEvent(srv, { session: organizer, admin, body: { capacity: 50, price_xof: 5000 } });
    await createPromo(eventId, { code: 'MOINS15', kind: 'percent', value: 15 });
    await createPromo(eventId, { code: 'CADEAU', kind: 'fixed', value: 20000 });
    const client = await registerAndLogin(srv);
    const check = await srv.api('/api/promos/check', { method: 'POST', token: client.token, body: { event_id: eventId, code: 'moins15', quantity: 3 } });
    assert.equal(check.status, 200, check.text);
    assert.equal(check.json.valid, true);
    assert.deepEqual([check.json.subtotal_xof, check.json.discount_xof, check.json.total_xof], [15000, 2250, 12750]);
    const bought = await srv.api('/api/tickets', { method: 'POST', token: client.token, body: { event_id: eventId, quantity: 3, promo_code: 'MOINS15', discount_xof: 15000, amount_xof: 1 } });
    assert.equal(bought.status, 201, bought.text);
    assert.equal(bought.json.amount_xof, 12750);
    const row = (await db.execute({ sql: 'select promo_code, discount_xof, amount_xof from tickets where id = ?', args: [bought.json.id] })).rows[0];
    assert.deepEqual([row.promo_code, Number(row.discount_xof), Number(row.amount_xof)], ['MOINS15', 2250, 12750]);
    const capped = await srv.api('/api/tickets', { method: 'POST', token: client.token, body: { event_id: eventId, quantity: 2, promo_code: 'CADEAU' } });
    assert.equal(capped.json.amount_xof, 0, 'la remise fixe ne rend jamais le total negatif');
  });

  it('code d\'un autre evenement, desactive ou expire : refuse sans consommer de place', async () => {
    const eventId = await createApprovedEvent(srv, { session: organizer, admin, body: { capacity: 50 } });
    const created = await createPromo(eventId, { code: 'ETEINT', kind: 'percent', value: 50 });
    await srv.api(`/api/organizer/promos/${created.json.id}`, { method: 'PATCH', token: organizer.token, body: { active: false } });
    const client = await registerAndLogin(srv);
    const cases = [['BASSAM10', 'PROMO_INVALID'], ['ETEINT', 'PROMO_INVALID'], ['INCONNU', 'PROMO_INVALID']];
    for (const [code, expected] of cases) {
      const response = await srv.api('/api/tickets', { method: 'POST', token: client.token, body: { event_id: eventId, promo_code: code } });
      assert.equal(response.json.error.code, expected, code);
    }
    const expired = await srv.api('/api/promos/check', { method: 'POST', token: client.token, body: { event_id: 'evt_zouglou_past', code: 'ZOUGLOU500' } });
    assert.equal(expired.status, 200);
    assert.equal(expired.json.valid, false);
    assert.equal(expired.json.error.code, 'PROMO_EXPIRED');
    assert.equal(expired.json.discount_xof, undefined);
    const sold = await db.execute({ sql: 'select tickets_sold from events where id = ?', args: [eventId] });
    assert.equal(Number(sold.rows[0].tickets_sold), 0);
  });

  it('nombre d\'utilisations respecte sous achats concurrents, places restituees', async () => {
    const eventId = await createApprovedEvent(srv, { session: organizer, admin, body: { capacity: 50 } });
    const created = await createPromo(eventId, { code: 'TROIS', kind: 'percent', value: 20, max_uses: 3 });
    const buyers = await Promise.all([registerAndLogin(srv), registerAndLogin(srv), registerAndLogin(srv)]);
    const attempts = Array.from({ length: 10 }, (_, i) => srv.api('/api/tickets', {
      method: 'POST', token: buyers[i % 3].token, body: { event_id: eventId, promo_code: 'TROIS' }
    }));
    const statuses = (await Promise.all(attempts)).map((response) => response.status);
    assert.equal(statuses.filter((status) => status === 201).length, 3, statuses.join(','));
    assert.ok(statuses.filter((status) => status !== 201).every((status) => status === 409), statuses.join(','));
    const promo = (await db.execute({ sql: 'select used from promo_codes where id = ?', args: [created.json.id] })).rows[0];
    assert.equal(Number(promo.used), 3);
    const event = (await db.execute({ sql: 'select tickets_sold from events where id = ?', args: [eventId] })).rows[0];
    assert.equal(Number(event.tickets_sold), 3, 'les places des achats refuses sont restituees');
  });

  it('verification : connexion requise et limitation de debit', async () => {
    assert.equal((await srv.api('/api/promos/check', { method: 'POST', body: { event_id: 'evt_abissa_2026', code: 'BASSAM10' } })).status, 401);
    const client = await registerAndLogin(srv);
    const statuses = [];
    for (let i = 0; i < 22; i += 1) {
      statuses.push((await srv.api('/api/promos/check', { method: 'POST', token: client.token, body: { event_id: 'evt_abissa_2026', code: `ESSAI${i}` } })).status);
    }
    assert.ok(statuses.slice(0, 20).every((status) => status === 200), statuses.join(','));
    assert.equal(statuses[21], 429);
  });

  it('code de demonstration BASSAM10 sur une categorie', async () => {
    const client = await registerAndLogin(srv);
    const bought = await srv.api('/api/tickets', { method: 'POST', token: client.token, body: { event_id: 'evt_abissa_2026', category_id: 'cat_abissa_vip', quantity: 2, promo_code: 'bassam10' } });
    assert.equal(bought.status, 201, bought.text);
    assert.equal(bought.json.amount_xof, 63000);
  });
});
