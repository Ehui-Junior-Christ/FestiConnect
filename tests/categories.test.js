// Categories de billets (Standard, VIP, Early bird) et edition d'evenement.
import assert from 'node:assert/strict';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { createClient } from '@libsql/client';
import { DEMO, createApprovedEvent, isoIn, registerAndLogin, startServer } from './_helpers.js';

let srv;
let db;
let organizer;
let admin;

const CATEGORIES = [
  { name: 'Early bird', price_xof: 3000, capacity: 3 },
  { name: 'Standard', price_xof: 5000, capacity: 10 },
  { name: 'VIP', price_xof: 12000, capacity: 2 }
];

function eventBody(extra = {}) {
  return { title: `Festival ${Math.random().toString(36).slice(2, 7)}`, category: 'Concert', city: 'Abidjan', starts_at: isoIn(20), ...extra };
}

async function editBody(eventId, patch) {
  const { event } = (await srv.api(`/api/events/${eventId}`, { token: organizer.token })).json;
  return {
    title: event.title, category: event.category, city: event.city, location: event.location,
    starts_at: event.starts_at, ends_at: event.ends_at, price_xof: event.price_xof, capacity: event.capacity,
    description: event.description,
    categories: event.categories.map(({ id, name, price_xof: price, capacity }) => ({ id, name, price_xof: price, capacity })),
    ...patch(event)
  };
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

describe('creation avec categories', () => {
  it('stocke les categories, jauge = somme, prix d\'appel = minimum', async () => {
    const eventId = await createApprovedEvent(srv, { session: organizer, admin, body: { ...eventBody(), categories: CATEGORIES, price_xof: 99, capacity: 1 } });
    const { event } = (await srv.api(`/api/events/${eventId}`)).json;
    assert.deepEqual(event.categories.map((item) => [item.name, item.price_xof, item.capacity, item.sold]), [['Early bird', 3000, 3, 0], ['Standard', 5000, 10, 0], ['VIP', 12000, 2, 0]]);
    assert.equal(Number(event.capacity), 15);
    assert.equal(Number(event.price_xof), 3000);
    const list = (await srv.api('/api/events')).json.events.find((item) => item.id === eventId);
    assert.equal(Number(list.categories_count), 3);
    assert.equal(Number(list.min_available_price_xof), 3000);
  });

  it('valide strictement les categories', async () => {
    const bad = [
      'VIP',
      Array.from({ length: 9 }, (_, i) => ({ name: `Cat ${i}`, price_xof: 1000, capacity: 5 })),
      [{ name: 'VIP', price_xof: 1000, capacity: 5 }, { name: 'vip', price_xof: 2000, capacity: 5 }],
      [{ price_xof: 1000, capacity: 5 }],
      [{ name: 'VIP', price_xof: 1000, capacity: 0 }],
      [{ name: 'VIP', price_xof: -1, capacity: 5 }],
      [{ name: 'VIP', price_xof: '1e3', capacity: 5 }],
      [{ name: '<b>VIP</b>', price_xof: 1000, capacity: 5 }],
      [{ id: 'cat_abissa_vip', name: 'VIP', price_xof: 1000, capacity: 5 }],
      [null]
    ];
    for (const categories of bad) {
      const response = await srv.api('/api/events', { method: 'POST', token: organizer.token, body: eventBody({ categories }) });
      assert.equal(response.status, 422, JSON.stringify(categories).slice(0, 80));
    }
  });
});

describe('achat par categorie', () => {
  it('categorie obligatoire, appartenant a l\'evenement, prix calcule cote serveur', async () => {
    const eventId = await createApprovedEvent(srv, { session: organizer, admin, body: { ...eventBody(), categories: CATEGORIES } });
    const { event } = (await srv.api(`/api/events/${eventId}`)).json;
    const vip = event.categories.find((item) => item.name === 'VIP');
    const client = await registerAndLogin(srv);
    const missing = await srv.api('/api/tickets', { method: 'POST', token: client.token, body: { event_id: eventId } });
    assert.equal(missing.status, 422);
    const foreign = await srv.api('/api/tickets', { method: 'POST', token: client.token, body: { event_id: eventId, category_id: 'cat_abissa_vip' } });
    assert.equal(foreign.status, 404);
    assert.equal(foreign.json.error.code, 'CATEGORY_NOT_FOUND');
    const bought = await srv.api('/api/tickets', { method: 'POST', token: client.token, body: { event_id: eventId, category_id: vip.id, quantity: 2, price_xof: 1, amount_xof: 1 } });
    assert.equal(bought.status, 201, bought.text);
    assert.equal(bought.json.amount_xof, 24000);
    assert.equal(bought.json.category_name, 'VIP');
    const ticket = (await db.execute({ sql: 'select category_id, category_name, amount_xof from tickets where id = ?', args: [bought.json.id] })).rows[0];
    assert.deepEqual([ticket.category_id, ticket.category_name, Number(ticket.amount_xof)], [vip.id, 'VIP', 24000]);
    const soldOut = await srv.api('/api/tickets', { method: 'POST', token: client.token, body: { event_id: eventId, category_id: vip.id } });
    assert.equal(soldOut.status, 409);
    assert.equal(soldOut.json.error.code, 'SOLD_OUT');
    assert.match(soldOut.json.error.message, /« VIP »/);
  });

  it('evenement sans categorie : tarif unique implicite (retrocompatible)', async () => {
    const client = await registerAndLogin(srv);
    const ok = await srv.api('/api/tickets', { method: 'POST', token: client.token, body: { event_id: 'evt_mode_sahel', quantity: 2 } });
    assert.equal(ok.status, 201);
    assert.equal(ok.json.amount_xof, 16000);
    const withCategory = await srv.api('/api/tickets', { method: 'POST', token: client.token, body: { event_id: 'evt_mode_sahel', category_id: 'cat_abissa_std' } });
    assert.equal(withCategory.status, 404);
  });

  it('jauge d\'une categorie respectee sous achats concurrents', async () => {
    const eventId = await createApprovedEvent(srv, { session: organizer, admin, body: { ...eventBody(), categories: CATEGORIES } });
    const { event } = (await srv.api(`/api/events/${eventId}`)).json;
    const early = event.categories.find((item) => item.name === 'Early bird');
    const buyers = await Promise.all([registerAndLogin(srv), registerAndLogin(srv), registerAndLogin(srv)]);
    const attempts = Array.from({ length: 12 }, (_, i) => srv.api('/api/tickets', {
      method: 'POST', token: buyers[i % 3].token, body: { event_id: eventId, category_id: early.id }
    }));
    const statuses = (await Promise.all(attempts)).map((response) => response.status);
    assert.equal(statuses.filter((status) => status === 201).length, 3, statuses.join(','));
    assert.ok(statuses.filter((status) => status !== 201).every((status) => status === 409), statuses.join(','));
    const rows = await db.execute({ sql: 'select name, sold from ticket_categories where event_id = ? order by position', args: [eventId] });
    assert.deepEqual(rows.rows.map((row) => [row.name, Number(row.sold)]), [['Early bird', 3], ['Standard', 0], ['VIP', 0]]);
    const total = await db.execute({ sql: 'select tickets_sold from events where id = ?', args: [eventId] });
    assert.equal(Number(total.rows[0].tickets_sold), 3);
    const standard = event.categories.find((item) => item.name === 'Standard');
    assert.equal((await srv.api('/api/tickets', { method: 'POST', token: buyers[0].token, body: { event_id: eventId, category_id: standard.id } })).status, 201);
  });
});

describe('edition d\'evenement', () => {
  it('reservee a son organisateur ou a un admin', async () => {
    const eventId = await createApprovedEvent(srv, { session: organizer, admin, body: eventBody() });
    const body = await editBody(eventId, () => ({ title: 'Titre piraté' }));
    const other = await registerAndLogin(srv, 'organisateur');
    assert.equal((await srv.api(`/api/events/${eventId}`, { method: 'PATCH', token: other.token, body })).status, 404);
    const client = await registerAndLogin(srv);
    assert.equal((await srv.api(`/api/events/${eventId}`, { method: 'PATCH', token: client.token, body })).status, 403);
    assert.equal((await srv.api(`/api/events/${eventId}`, { method: 'PATCH', body })).status, 401);
    const title = (await db.execute({ sql: 'select title from events where id = ?', args: [eventId] })).rows[0].title;
    assert.notEqual(title, 'Titre piraté');
    const byAdmin = await srv.api(`/api/events/${eventId}`, { method: 'PATCH', token: admin.token, body: { ...body, title: 'Titre corrigé' } });
    assert.equal(byAdmin.status, 200, byAdmin.text);
  });

  it('refuse une jauge sous les ventes et la suppression d\'une categorie vendue', async () => {
    const eventId = await createApprovedEvent(srv, { session: organizer, admin, body: { ...eventBody(), categories: CATEGORIES } });
    const { event } = (await srv.api(`/api/events/${eventId}`)).json;
    const standard = event.categories.find((item) => item.name === 'Standard');
    const client = await registerAndLogin(srv);
    await srv.api('/api/tickets', { method: 'POST', token: client.token, body: { event_id: eventId, category_id: standard.id, quantity: 4 } });

    const shrink = await editBody(eventId, (current) => ({ categories: current.categories.map((item) => ({ ...item, capacity: item.name === 'Standard' ? 3 : item.capacity })) }));
    const shrunk = await srv.api(`/api/events/${eventId}`, { method: 'PATCH', token: organizer.token, body: shrink });
    assert.equal(shrunk.status, 409);
    assert.equal(shrunk.json.error.code, 'CAPACITY_CONFLICT');

    const drop = await editBody(eventId, (current) => ({ categories: current.categories.filter((item) => item.name !== 'Standard') }));
    assert.equal((await srv.api(`/api/events/${eventId}`, { method: 'PATCH', token: organizer.token, body: drop })).status, 409);

    const grow = await editBody(eventId, (current) => ({
      categories: [...current.categories.filter((item) => item.name !== 'VIP').map((item) => ({ ...item, capacity: item.name === 'Standard' ? 50 : item.capacity })), { name: 'Carré or', price_xof: 25000, capacity: 5 }]
    }));
    const grown = await srv.api(`/api/events/${eventId}`, { method: 'PATCH', token: organizer.token, body: grow });
    assert.equal(grown.status, 200, grown.text);
    assert.deepEqual(grown.json.event.categories.map((item) => [item.name, item.capacity, item.sold]), [['Early bird', 3, 0], ['Standard', 50, 4], ['Carré or', 5, 0]]);
    assert.equal(Number(grown.json.event.capacity), 58);
    assert.equal(Number(grown.json.event.tickets_sold), 4);
  });

  it('tarif unique vers categories : la premiere categorie reprend les ventes', async () => {
    const eventId = await createApprovedEvent(srv, { session: organizer, admin, body: { ...eventBody(), capacity: 20, price_xof: 2000 } });
    const client = await registerAndLogin(srv);
    await srv.api('/api/tickets', { method: 'POST', token: client.token, body: { event_id: eventId, quantity: 5 } });
    const tooSmall = await editBody(eventId, () => ({ categories: [{ name: 'Standard', price_xof: 2000, capacity: 4 }] }));
    assert.equal((await srv.api(`/api/events/${eventId}`, { method: 'PATCH', token: organizer.token, body: tooSmall })).status, 409);
    const lowCapacity = await editBody(eventId, () => ({ capacity: 4, categories: [] }));
    assert.equal((await srv.api(`/api/events/${eventId}`, { method: 'PATCH', token: organizer.token, body: lowCapacity })).status, 409);
    const body = await editBody(eventId, () => ({ categories: [{ name: 'Standard', price_xof: 2000, capacity: 20 }, { name: 'VIP', price_xof: 6000, capacity: 5 }] }));
    const converted = await srv.api(`/api/events/${eventId}`, { method: 'PATCH', token: organizer.token, body });
    assert.equal(converted.status, 200, converted.text);
    assert.deepEqual(converted.json.event.categories.map((item) => [item.name, item.sold]), [['Standard', 5], ['VIP', 0]]);
    assert.equal(Number(converted.json.event.tickets_sold), 5);
  });

  it('changement d\'horaire : les detenteurs de billets sont prevenus', async () => {
    const eventId = await createApprovedEvent(srv, { session: organizer, admin, body: eventBody({ capacity: 20 }) });
    const holder = await registerAndLogin(srv);
    await srv.api('/api/tickets', { method: 'POST', token: holder.token, body: { event_id: eventId } });
    const body = await editBody(eventId, () => ({ starts_at: isoIn(25, '21:30'), ends_at: '' }));
    assert.equal((await srv.api(`/api/events/${eventId}`, { method: 'PATCH', token: organizer.token, body })).status, 200);
    const list = (await srv.api('/api/notifications', { token: holder.token })).json.notifications;
    const changed = list.find((item) => item.type === 'event_changed');
    assert.ok(changed, JSON.stringify(list));
    assert.match(changed.body, /Nouvel horaire : le .* à 21h30\./);
    const past = await editBody(eventId, () => ({ starts_at: isoIn(-1) }));
    assert.equal((await srv.api(`/api/events/${eventId}`, { method: 'PATCH', token: organizer.token, body: past })).status, 422);
  });
});
