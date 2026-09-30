// Retraits Mobile Money : solde, commission, validation du numero, concurrence,
// traitement par l'administration.
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { DEMO, createApprovedEvent, registerAndLogin, startServer } from './_helpers.js';

process.env.NODE_ENV = 'test';
const v = await import('../src/shared/validation.js');

let srv;
let admin;

// Organisateur neuf avec `revenue` FCFA de billets payes.
async function organizerWithRevenue(server, revenue, adminSession) {
  const organizer = await registerAndLogin(server, 'organisateur');
  const eventId = await createApprovedEvent(server, { session: organizer, admin: adminSession, body: { price_xof: revenue, capacity: 10 } });
  const buyer = await registerAndLogin(server);
  const bought = await server.api('/api/tickets', { method: 'POST', token: buyer.token, body: { event_id: eventId } });
  assert.equal(bought.status, 201, bought.text);
  return organizer;
}

function requestWithdrawal(session, body, server = srv) {
  return server.api('/api/organizer/withdrawals', { method: 'POST', token: session.token, body: { method: 'Wave', phone: '07 07 07 07 07', ...body } });
}

before(async () => {
  srv = await startServer();
  admin = await srv.login(DEMO.admin.email, DEMO.admin.password);
});

after(async () => {
  await srv?.stop();
});

describe('numero Mobile Money ivoirien', () => {
  it('accepte +225 et 10 chiffres (01, 05, 07), normalise', () => {
    assert.equal(v.ivorianMobile('0707070707'), '+225 07 07 07 07 07');
    assert.equal(v.ivorianMobile('+225 05 12 34 56 78'), '+225 05 12 34 56 78');
    assert.equal(v.ivorianMobile('00225-01.02.03.04.05'), '+225 01 02 03 04 05');
    for (const bad of ['', '07070707', '+225 0707070707 0', '+33 6 12 34 56 78', '27 22 00 00 00', '+2250907070707', 'abc', 707070707]) {
      assert.throws(() => v.ivorianMobile(bad), /Mobile Money/, String(bad));
    }
  });
});

describe('demande de retrait', () => {
  it('limitee au solde disponible, historique et solde a jour', async () => {
    const organizer = await organizerWithRevenue(srv, 50000, admin);
    const wallet = await srv.api('/api/organizer/wallet', { token: organizer.token });
    assert.equal(wallet.json.balance.available, 50000);
    assert.equal(wallet.json.balance.commission, 0, 'commission 0 % par defaut');
    const tooMuch = await requestWithdrawal(organizer, { amount_xof: 50001 });
    assert.equal(tooMuch.status, 409);
    assert.equal(tooMuch.json.error.code, 'INSUFFICIENT_BALANCE');
    const ok = await requestWithdrawal(organizer, { amount_xof: 30000, method: 'Orange Money' });
    assert.equal(ok.status, 201, ok.text);
    assert.equal(ok.json.balance.available, 20000);
    assert.equal(ok.json.balance.pending, 30000);
    const history = (await srv.api('/api/organizer/wallet', { token: organizer.token })).json.withdrawals;
    assert.equal(history.length, 1);
    assert.deepEqual([history[0].amount_xof, history[0].method, history[0].phone, history[0].status], [30000, 'Orange Money', '+225 07 07 07 07 07', 'pending']);
    assert.equal((await requestWithdrawal(organizer, { amount_xof: 20001 })).status, 409);
  });

  it('validation des champs et roles', async () => {
    const organizer = await organizerWithRevenue(srv, 20000, admin);
    for (const body of [{ amount_xof: 999 }, { amount_xof: '5e3' }, { amount_xof: 5000, method: 'Paypal' }, { amount_xof: 5000, phone: '+33 612345678' }, { amount_xof: 5000, phone: '' }]) {
      assert.equal((await requestWithdrawal(organizer, body)).status, 422, JSON.stringify(body));
    }
    const client = await registerAndLogin(srv);
    assert.equal((await requestWithdrawal(client, { amount_xof: 5000 })).status, 403);
    assert.equal((await srv.api('/api/organizer/wallet', { token: client.token })).status, 403);
    assert.equal((await srv.api('/api/organizer/withdrawals', { method: 'POST', body: { amount_xof: 5000 } })).status, 401);
  });

  it('demandes simultanees : jamais au-dela du solde', async () => {
    const organizer = await organizerWithRevenue(srv, 10000, admin);
    const attempts = await Promise.all(Array.from({ length: 6 }, () => requestWithdrawal(organizer, { amount_xof: 4000 })));
    const statuses = attempts.map((response) => response.status);
    assert.equal(statuses.filter((status) => status === 201).length, 2, statuses.join(','));
    const wallet = (await srv.api('/api/organizer/wallet', { token: organizer.token })).json.balance;
    assert.equal(wallet.pending, 8000);
    assert.equal(wallet.available, 2000);
  });
});

describe('traitement par l\'administration', () => {
  it('validation / refus, une seule fois, notification a l\'organisateur', async () => {
    const organizer = await organizerWithRevenue(srv, 40000, admin);
    const first = await requestWithdrawal(organizer, { amount_xof: 10000 });
    const second = await requestWithdrawal(organizer, { amount_xof: 15000 });
    const client = await registerAndLogin(srv);
    assert.equal((await srv.api(`/api/admin/withdrawals/${first.json.id}`, { method: 'PATCH', token: organizer.token, body: { status: 'approved' } })).status, 403);
    assert.equal((await srv.api('/api/admin/withdrawals', { token: client.token })).status, 403);
    assert.equal((await srv.api(`/api/admin/withdrawals/${first.json.id}`, { method: 'PATCH', token: admin.token, body: { status: 'paid' } })).status, 422);
    assert.equal((await srv.api(`/api/admin/withdrawals/${second.json.id}`, { method: 'PATCH', token: admin.token, body: { status: 'rejected' } })).status, 422, 'motif obligatoire');

    const decisions = await Promise.all([1, 2].map(() => srv.api(`/api/admin/withdrawals/${first.json.id}`, { method: 'PATCH', token: admin.token, body: { status: 'approved' } })));
    assert.deepEqual(decisions.map((response) => response.status).sort(), [200, 409]);
    const refused = await srv.api(`/api/admin/withdrawals/${second.json.id}`, { method: 'PATCH', token: admin.token, body: { status: 'rejected', note: 'Numéro Wave au nom d\'un tiers.' } });
    assert.equal(refused.status, 200);
    const wallet = (await srv.api('/api/organizer/wallet', { token: organizer.token })).json.balance;
    assert.deepEqual([wallet.paid_out, wallet.pending, wallet.available], [10000, 0, 30000], 'le montant refuse redevient disponible');
    const notifications = (await srv.api('/api/notifications', { token: organizer.token })).json.notifications.filter((item) => item.type === 'withdrawal');
    assert.equal(notifications.length, 2);
    assert.ok(notifications.some((item) => /^Retrait de 10 000 FCFA envoyé$/.test(item.title)));
    assert.ok(notifications.some((item) => /Numéro Wave au nom d'un tiers/.test(item.body)));
    const list = await srv.api('/api/admin/withdrawals?status=pending', { token: admin.token });
    assert.ok(list.json.withdrawals.every((item) => item.status === 'pending'));
    assert.equal((await srv.api('/api/admin/withdrawals?status=hack', { token: admin.token })).status, 422);
  });
});

describe('commission configurable', () => {
  it('PLATFORM_COMMISSION_PERCENT retire la commission du solde', async () => {
    const server = await startServer({ env: { PLATFORM_COMMISSION_PERCENT: '7.5' } });
    try {
      const adminSession = await server.login(DEMO.admin.email, DEMO.admin.password);
      const organizer = await organizerWithRevenue(server, 20000, adminSession);
      const wallet = (await server.api('/api/organizer/wallet', { token: organizer.token })).json.balance;
      assert.deepEqual([wallet.commission_percent, wallet.commission, wallet.available], [7.5, 1500, 18500]);
      assert.equal((await requestWithdrawal(organizer, { amount_xof: 18501 }, server)).status, 409);
      assert.equal((await requestWithdrawal(organizer, { amount_xof: 18500 }, server)).status, 201);
    } finally {
      await server.stop();
    }
  });

  it('une valeur invalide empeche le demarrage', async () => {
    await assert.rejects(() => startServer({ seed: false, env: { PLATFORM_COMMISSION_PERCENT: '80' } }), /PLATFORM_COMMISSION_PERCENT/);
  });
});
