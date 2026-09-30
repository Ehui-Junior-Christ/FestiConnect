// Controle d'entree : check-in atomique, unique, limite aux evenements de
// l'organisateur, refus des billets annules.
import assert from 'node:assert/strict';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { createClient } from '@libsql/client';
import { DEMO, createApprovedEvent, registerAndLogin, startServer } from './_helpers.js';

let srv;
let db;
let organizer;

async function buyTicket(eventId, quantity = 1) {
  const client = await registerAndLogin(srv);
  const bought = await srv.api('/api/tickets', { method: 'POST', token: client.token, body: { event_id: eventId, quantity } });
  assert.equal(bought.status, 201, bought.text);
  const row = (await db.execute({ sql: 'select code from tickets where id = ?', args: [bought.json.id] })).rows[0];
  return { id: bought.json.id, code: row.code, client };
}

function checkin(code, session = organizer) {
  return srv.api('/api/organizer/checkin', { method: 'POST', token: session.token, body: { code } });
}

before(async () => {
  srv = await startServer();
  db = createClient({ url: `file:${path.join(srv.dir, 'test.db')}` });
  organizer = await srv.login(DEMO.organizer.email, DEMO.organizer.password);
});

after(async () => {
  db?.close();
  await srv?.stop();
});

describe('check-in', () => {
  it('marque le billet utilise avec horodatage, puis refuse un second passage', async () => {
    const eventId = await createApprovedEvent(srv, { session: organizer, body: { capacity: 20 } });
    const ticket = await buyTicket(eventId, 3);
    const first = await checkin(ticket.code.toLowerCase());
    assert.equal(first.status, 200, first.text);
    assert.equal(first.json.ticket.quantity, 3);
    assert.equal(first.json.ticket.client_name, 'Test client');
    const row = (await db.execute({ sql: 'select checked_in_at, checked_in_by from tickets where id = ?', args: [ticket.id] })).rows[0];
    assert.ok(Date.parse(row.checked_in_at) > Date.now() - 60000);
    assert.equal(row.checked_in_by, 'usr_orga_demo');
    const second = await checkin(ticket.code);
    assert.equal(second.status, 409);
    assert.equal(second.json.error.code, 'ALREADY_CHECKED_IN');
    assert.match(second.json.error.message, /^Scanné le .* à \d{2}h\d{2} : Test client, /);
    const client = (await srv.api('/api/client/tickets', { token: ticket.client.token })).json.tickets[0];
    assert.ok(client.checked_in_at, 'le client voit son billet utilise');
  });

  it('un seul passage sous scans concurrents', async () => {
    const eventId = await createApprovedEvent(srv, { session: organizer, body: { capacity: 20 } });
    const ticket = await buyTicket(eventId);
    const statuses = (await Promise.all(Array.from({ length: 8 }, () => checkin(ticket.code)))).map((response) => response.status);
    assert.equal(statuses.filter((status) => status === 200).length, 1, statuses.join(','));
    assert.ok(statuses.filter((status) => status !== 200).every((status) => status === 409), statuses.join(','));
  });

  it('refuse le billet d\'un evenement d\'un autre organisateur sans le reveler', async () => {
    const eventId = await createApprovedEvent(srv, { session: organizer, body: { capacity: 20 } });
    const ticket = await buyTicket(eventId);
    const other = await registerAndLogin(srv, 'organisateur');
    const response = await checkin(ticket.code, other);
    assert.equal(response.status, 404);
    assert.equal(response.json.error.code, 'TICKET_NOT_FOUND');
    assert.deepEqual(response.json, (await checkin('FC-INEXISTANT01', other)).json, 'meme reponse qu\'un code inconnu');
    const row = (await db.execute({ sql: 'select checked_in_at from tickets where id = ?', args: [ticket.id] })).rows[0];
    assert.equal(row.checked_in_at, '', 'le billet reste valable');
    const admin = await srv.login(DEMO.admin.email, DEMO.admin.password);
    assert.equal((await checkin(ticket.code, admin)).status, 200, 'un admin peut controler');
  });

  it('refuse un billet annule', async () => {
    const eventId = await createApprovedEvent(srv, { session: organizer, body: { capacity: 20 } });
    const ticket = await buyTicket(eventId);
    await db.execute({ sql: "update tickets set status = 'cancelled' where id = ?", args: [ticket.id] });
    const response = await checkin(ticket.code);
    assert.equal(response.status, 409);
    assert.equal(response.json.error.code, 'TICKET_CANCELLED');
  });

  it('roles, validation du code et compteurs', async () => {
    const client = await registerAndLogin(srv);
    assert.equal((await checkin('FC-DEMO-2026', client)).status, 403);
    assert.equal((await srv.api('/api/organizer/checkin', { method: 'POST', body: { code: 'FC-DEMO-2026' } })).status, 401);
    for (const code of ['', 'DEMO-2026', 'FC-<script>', 12, 'FC-' + 'A'.repeat(60)]) {
      assert.equal((await checkin(code)).status, 422, String(code));
    }
    const summary = await srv.api('/api/organizer/checkin/summary', { token: organizer.token });
    assert.equal(summary.status, 200);
    const abissa = summary.json.events.find((event) => event.id === 'evt_abissa_2026');
    assert.equal(abissa.sold, 2);
    assert.equal(abissa.checked_in, 0);
    assert.equal((await checkin('FC-DEMO-2026')).status, 200);
    const after = (await srv.api('/api/organizer/checkin/summary', { token: organizer.token })).json.events.find((event) => event.id === 'evt_abissa_2026');
    assert.equal(after.checked_in, 2);
  });
});
