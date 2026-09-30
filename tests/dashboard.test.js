// Tableau de bord organisateur : ventes par jour, remplissage, export CSV
// (injection de formules), duplication.
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { DEMO, createApprovedEvent, isoIn, registerAndLogin, startServer } from './_helpers.js';

process.env.NODE_ENV = 'test';
process.env.TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL || 'file::memory:';
const { csvCell, toCsv } = await import('../src/features/organizerStats.js');

let srv;
let organizer;
let admin;

before(async () => {
  srv = await startServer();
  organizer = await srv.login(DEMO.organizer.email, DEMO.organizer.password);
  admin = await srv.login(DEMO.admin.email, DEMO.admin.password);
});

after(async () => {
  await srv?.stop();
});

describe('CSV', () => {
  it('neutralise les formules et echappe les guillemets', () => {
    assert.equal(csvCell('=HYPERLINK("http://x")'), '"\'=HYPERLINK(""http://x"")"');
    assert.equal(csvCell('+225 07 00 00 00 00'), '"\'+225 07 00 00 00 00"');
    assert.equal(csvCell('-2+3'), '"\'-2+3"');
    assert.equal(csvCell('@SUM(A1)'), '"\'@SUM(A1)"');
    assert.equal(csvCell('\tcmd'), '"\'\tcmd"');
    assert.equal(csvCell('Koné; "Awa"'), '"Koné; ""Awa"""');
    assert.equal(csvCell(15000), '"15000"');
    assert.ok(toCsv([['a', 'b']]).startsWith('﻿"a";"b"\r\n'));
  });
});

describe('statistiques', () => {
  it('ventes par jour sur la periode, jours sans vente a zero', async () => {
    const eventId = await createApprovedEvent(srv, { session: organizer, admin, body: { capacity: 30, price_xof: 2500 } });
    const buyer = await registerAndLogin(srv);
    await srv.api('/api/tickets', { method: 'POST', token: buyer.token, body: { event_id: eventId, quantity: 3 } });
    const stats = await srv.api(`/api/organizer/stats?days=7&event_id=${eventId}`, { token: organizer.token });
    assert.equal(stats.status, 200, stats.text);
    assert.equal(stats.json.sales.length, 7);
    const today = new Date().toISOString().slice(0, 10);
    assert.deepEqual(stats.json.sales.at(-1), { day: today, tickets: 3, revenue: 7500 });
    assert.ok(stats.json.sales.slice(0, -1).every((item) => item.tickets === 0));
    assert.deepEqual(stats.json.totals, { tickets: 3, revenue: 7500 });
    assert.deepEqual(stats.json.fill[0].categories, [{ name: 'Tarif unique', capacity: 30, sold: 3 }]);
    const all = await srv.api('/api/organizer/stats', { token: organizer.token });
    assert.equal(all.json.sales.length, 30);
    assert.ok(all.json.totals.tickets > 3, 'historique du seed');
    const abissa = all.json.fill.find((item) => item.event_id === 'evt_abissa_2026');
    assert.deepEqual(abissa.categories.map((item) => item.name), ['Early bird', 'Standard', 'VIP']);
  });

  it('isolation et validation', async () => {
    const other = await registerAndLogin(srv, 'organisateur');
    assert.equal((await srv.api('/api/organizer/stats?event_id=evt_abissa_2026', { token: other.token })).status, 404);
    const mine = await srv.api('/api/organizer/stats', { token: other.token });
    assert.equal(mine.json.totals.tickets, 0);
    assert.deepEqual(mine.json.fill, []);
    assert.equal((await srv.api('/api/organizer/stats?days=365', { token: organizer.token })).status, 422);
    const client = await registerAndLogin(srv);
    assert.equal((await srv.api('/api/organizer/stats', { token: client.token })).status, 403);
  });

  it('remplissage reel dans le resume (plus de valeur fixe)', async () => {
    const summary = await srv.api('/api/organizer/summary', { token: organizer.token });
    assert.equal(summary.json.summary.conversion, undefined);
    assert.ok(Number.isInteger(summary.json.summary.fill_rate));
  });
});

describe('export CSV des participants', () => {
  it('reserve au proprietaire, formules neutralisees', async () => {
    const eventId = await createApprovedEvent(srv, { session: organizer, admin, body: { capacity: 10 } });
    const email = `formule.${Date.now()}@test.festiconnect.ci`;
    await srv.api('/api/auth/register', { method: 'POST', body: { name: '=cmd|calc', email, password: 'Festival2026!', phone: '+225 07 11 22 33 44' } });
    const buyer = await srv.login(email, 'Festival2026!');
    await srv.api('/api/tickets', { method: 'POST', token: buyer.token, body: { event_id: eventId, quantity: 2 } });

    const response = await srv.api(`/api/organizer/events/${eventId}/attendees.csv`, { token: organizer.token });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'text/csv; charset=utf-8');
    assert.match(response.headers.get('content-disposition'), /^attachment; filename="participants-concert-test-[a-z0-9]+\.csv"$/);
    const lines = response.text.replace(/^﻿/, '').trim().split('\r\n');
    assert.equal(lines.length, 2);
    assert.match(lines[0], /^"Code billet";"Nom";"Email"/);
    assert.match(lines[1], /;"'=cmd\|calc";/);
    assert.match(lines[1], /;"'\+225 07 11 22 33 44";/);
    assert.match(lines[1], /;"Tarif unique";"2";"2000";/);

    const other = await registerAndLogin(srv, 'organisateur');
    assert.equal((await srv.api(`/api/organizer/events/${eventId}/attendees.csv`, { token: other.token })).status, 404);
    assert.equal((await srv.api(`/api/organizer/events/${eventId}/attendees.csv`, { token: buyer.token })).status, 403);
    assert.equal((await srv.api(`/api/organizer/events/${eventId}/attendees.csv`)).status, 401);
    assert.equal((await srv.api(`/api/organizer/events/${eventId}/attendees.csv`, { token: admin.token })).status, 200);
  });
});

describe('duplication', () => {
  it('copie contenu et categories, ventes a zero, en validation', async () => {
    const response = await srv.api('/api/organizer/events/evt_abissa_2026/duplicate', { method: 'POST', token: organizer.token, body: {} });
    assert.equal(response.status, 201, response.text);
    const { event } = (await srv.api(`/api/events/${response.json.id}`, { token: organizer.token })).json;
    assert.equal(event.title, 'Festival Abissa Experience (copie)');
    assert.equal(event.status, 'pending');
    assert.equal(Number(event.tickets_sold), 0);
    assert.deepEqual(event.categories.map((item) => [item.name, item.price_xof, item.capacity, item.sold]), [['Early bird', 7500, 200, 0], ['Standard', 15000, 800, 0], ['VIP', 35000, 200, 0]]);
    assert.equal((await srv.api(`/api/events/${response.json.id}`)).status, 404, 'non publie');
  });

  it('decale une date passee dans le futur, meme heure et meme jour de semaine', async () => {
    const response = await srv.api('/api/organizer/events/evt_zouglou_past/duplicate', { method: 'POST', token: organizer.token, body: {} });
    assert.equal(response.status, 201);
    const start = Date.parse(`${response.json.starts_at}:00Z`);
    assert.ok(start > Date.now());
    const original = (await srv.api('/api/events/evt_zouglou_past')).json.event.starts_at;
    assert.equal(response.json.starts_at.slice(11), original.slice(11));
    assert.equal(new Date(start).getUTCDay(), new Date(`${original}:00Z`).getUTCDay());
  });

  it('reserve au proprietaire', async () => {
    const other = await registerAndLogin(srv, 'organisateur');
    assert.equal((await srv.api('/api/organizer/events/evt_abissa_2026/duplicate', { method: 'POST', token: other.token, body: {} })).status, 404);
    const client = await registerAndLogin(srv);
    assert.equal((await srv.api('/api/organizer/events/evt_abissa_2026/duplicate', { method: 'POST', token: client.token, body: {} })).status, 403);
    const eventId = await createApprovedEvent(srv, { session: other, admin, body: { starts_at: isoIn(8) } });
    assert.equal((await srv.api(`/api/organizer/events/${eventId}/duplicate`, { method: 'POST', token: other.token, body: {} })).status, 201);
  });
});
