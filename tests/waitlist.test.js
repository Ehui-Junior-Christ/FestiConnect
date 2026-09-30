// Liste d'attente et annulation de billet par l'organisateur.
import assert from 'node:assert/strict';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { createClient } from '@libsql/client';
import { DEMO, createApprovedEvent, registerAndLogin, startServer } from './_helpers.js';

let srv;
let db;
let organizer;
let admin;

async function eventBodyFor(eventId) {
  const { event } = (await srv.api(`/api/events/${eventId}`, { token: organizer.token })).json;
  return {
    title: event.title, category: event.category, city: event.city, location: event.location,
    starts_at: event.starts_at, ends_at: event.ends_at, price_xof: event.price_xof, capacity: event.capacity,
    description: event.description,
    categories: event.categories.map(({ id, name, price_xof: price, capacity }) => ({ id, name, price_xof: price, capacity }))
  };
}

async function waitlistNotifications(session) {
  const list = await srv.api('/api/notifications', { token: session.token });
  return list.json.notifications.filter((item) => item.type === 'waitlist');
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

describe('liste d\'attente', () => {
  it('seulement si complet ; inscription idempotente ; retrait', async () => {
    const eventId = await createApprovedEvent(srv, { session: organizer, admin, body: { capacity: 2 } });
    const fan = await registerAndLogin(srv);
    const early = await srv.api(`/api/events/${eventId}/waitlist`, { method: 'POST', token: fan.token, body: {} });
    assert.equal(early.status, 409);
    assert.equal(early.json.error.code, 'NOT_SOLD_OUT');
    const buyer = await registerAndLogin(srv);
    assert.equal((await srv.api('/api/tickets', { method: 'POST', token: buyer.token, body: { event_id: eventId, quantity: 2 } })).status, 201);
    for (let i = 0; i < 2; i += 1) {
      const joined = await srv.api(`/api/events/${eventId}/waitlist`, { method: 'POST', token: fan.token, body: {} });
      assert.equal(joined.status, 201, joined.text);
      assert.equal(joined.json.position, 1);
    }
    const rows = await db.execute({ sql: 'select count(*) as n from waitlist where event_id = ?', args: [eventId] });
    assert.equal(Number(rows.rows[0].n), 1);
    assert.equal((await srv.api(`/api/events/${eventId}/waitlist`, { token: fan.token })).json.entries.length, 1);
    assert.equal((await srv.api('/api/waitlist', { token: fan.token })).json.entries[0].event_id, eventId);
    assert.equal((await srv.api(`/api/events/${eventId}/waitlist`, { method: 'DELETE', token: fan.token })).status, 200);
    assert.equal((await srv.api(`/api/events/${eventId}/waitlist`, { token: fan.token })).json.entries.length, 0);
  });

  it('acces : connexion, role client, evenement publie, categorie valide', async () => {
    assert.equal((await srv.api('/api/events/evt_abissa_2026/waitlist', { method: 'POST', body: { category_id: 'cat_abissa_early' } })).status, 401);
    const orga = await registerAndLogin(srv, 'organisateur');
    assert.equal((await srv.api('/api/events/evt_abissa_2026/waitlist', { method: 'POST', token: orga.token, body: { category_id: 'cat_abissa_early' } })).status, 403);
    const fan = await registerAndLogin(srv);
    assert.equal((await srv.api('/api/events/evt_pending_yakro/waitlist', { method: 'POST', token: fan.token, body: {} })).status, 404);
    assert.equal((await srv.api('/api/events/evt_abissa_2026/waitlist', { method: 'POST', token: fan.token, body: {} })).status, 422, 'categorie obligatoire');
    assert.equal((await srv.api('/api/events/evt_abissa_2026/waitlist', { method: 'POST', token: fan.token, body: { category_id: 'cat_maquis_vip' } })).status, 404);
    assert.equal((await srv.api('/api/events/evt_abissa_2026/waitlist', { method: 'POST', token: fan.token, body: { category_id: 'cat_abissa_std' } })).status, 409, 'categorie non complete');
    assert.equal((await srv.api('/api/events/evt_abissa_2026/waitlist', { method: 'POST', token: fan.token, body: { category_id: 'cat_abissa_early' } })).status, 201);
    assert.equal((await srv.api('/api/events/evt_zouglou_past/waitlist', { method: 'POST', token: fan.token, body: {} })).status, 409);
  });

  it('hausse de jauge : les inscrits de la categorie sont prevenus, une seule fois', async () => {
    const eventId = await createApprovedEvent(srv, { session: organizer, admin, body: { categories: [{ name: 'Early bird', price_xof: 1000, capacity: 1 }, { name: 'VIP', price_xof: 5000, capacity: 1 }] } });
    const { event } = (await srv.api(`/api/events/${eventId}`)).json;
    const [early, vip] = event.categories;
    const buyer = await registerAndLogin(srv);
    for (const category of [early, vip]) {
      await srv.api('/api/tickets', { method: 'POST', token: buyer.token, body: { event_id: eventId, category_id: category.id } });
    }
    const earlyFan = await registerAndLogin(srv);
    const vipFan = await registerAndLogin(srv);
    await srv.api(`/api/events/${eventId}/waitlist`, { method: 'POST', token: earlyFan.token, body: { category_id: early.id } });
    await srv.api(`/api/events/${eventId}/waitlist`, { method: 'POST', token: vipFan.token, body: { category_id: vip.id } });

    const body = await eventBodyFor(eventId);
    body.categories = body.categories.map((item) => (item.id === early.id ? { ...item, capacity: 3 } : item));
    assert.equal((await srv.api(`/api/events/${eventId}`, { method: 'PATCH', token: organizer.token, body })).status, 200);
    const notified = await waitlistNotifications(earlyFan);
    assert.equal(notified.length, 1);
    assert.match(notified[0].body, /^2 places sont disponibles \(Early bird\)/);
    assert.equal((await waitlistNotifications(vipFan)).length, 0, 'la categorie VIP est toujours complete');
    await srv.api(`/api/events/${eventId}`, { method: 'PATCH', token: organizer.token, body: { ...body, description: 'Programme mis à jour' } });
    assert.equal((await waitlistNotifications(earlyFan)).length, 1, 'pas de seconde alerte sans nouvelle place');
  });
});

describe('annulation d\'un billet par l\'organisateur', () => {
  it('libere les places, previent le client et la liste d\'attente, une seule fois', async () => {
    const eventId = await createApprovedEvent(srv, { session: organizer, admin, body: { capacity: 2 } });
    const buyer = await registerAndLogin(srv);
    const bought = await srv.api('/api/tickets', { method: 'POST', token: buyer.token, body: { event_id: eventId, quantity: 2 } });
    const fan = await registerAndLogin(srv);
    await srv.api(`/api/events/${eventId}/waitlist`, { method: 'POST', token: fan.token, body: {} });

    const other = await registerAndLogin(srv, 'organisateur');
    assert.equal((await srv.api(`/api/organizer/tickets/${bought.json.id}/cancel`, { method: 'POST', token: other.token, body: {} })).status, 404, 'IDOR');
    assert.equal((await srv.api(`/api/organizer/tickets/${bought.json.id}/cancel`, { method: 'POST', token: buyer.token, body: {} })).status, 403);

    const results = await Promise.all([1, 2, 3].map(() => srv.api(`/api/organizer/tickets/${bought.json.id}/cancel`, { method: 'POST', token: organizer.token, body: {} })));
    assert.deepEqual(results.map((response) => response.status).sort(), [200, 409, 409]);
    const row = (await db.execute({ sql: 'select tickets_sold from events where id = ?', args: [eventId] })).rows[0];
    assert.equal(Number(row.tickets_sold), 0, 'places liberees une seule fois');
    const ticket = (await srv.api('/api/client/tickets', { token: buyer.token })).json.tickets[0];
    assert.equal(ticket.status, 'cancelled');
    const clientNotifs = (await srv.api('/api/notifications', { token: buyer.token })).json.notifications;
    assert.ok(clientNotifs.some((item) => item.type === 'ticket_cancelled'));
    assert.equal((await waitlistNotifications(fan)).length, 1);
    const checkin = await srv.api('/api/organizer/checkin', { method: 'POST', token: organizer.token, body: { code: (await db.execute({ sql: 'select code from tickets where id = ?', args: [bought.json.id] })).rows[0].code } });
    assert.equal(checkin.json.error.code, 'TICKET_CANCELLED');
    const summary = await srv.api('/api/client/summary', { token: buyer.token });
    assert.equal(Number(summary.json.summary.spent), 0, 'un billet annule ne compte plus');
  });

  it('refuse d\'annuler un billet deja scanne', async () => {
    const eventId = await createApprovedEvent(srv, { session: organizer, admin, body: { capacity: 5 } });
    const buyer = await registerAndLogin(srv);
    const bought = await srv.api('/api/tickets', { method: 'POST', token: buyer.token, body: { event_id: eventId } });
    const code = (await db.execute({ sql: 'select code from tickets where id = ?', args: [bought.json.id] })).rows[0].code;
    await srv.api('/api/organizer/checkin', { method: 'POST', token: organizer.token, body: { code } });
    const response = await srv.api(`/api/organizer/tickets/${bought.json.id}/cancel`, { method: 'POST', token: organizer.token, body: {} });
    assert.equal(response.status, 409);
    assert.match(response.json.error.message, /déjà été scanné/);
  });
});
