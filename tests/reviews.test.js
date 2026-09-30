// Avis apres l'evenement : eligibilite, unicite, moderation, moyenne.
import assert from 'node:assert/strict';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { createClient } from '@libsql/client';
import { DEMO, createApprovedEvent, isoIn, registerAndLogin, startServer } from './_helpers.js';

let srv;
let db;
let admin;

function review(eventId, session, body = { rating: 4, comment: 'Belle soirée.' }) {
  return srv.api(`/api/events/${eventId}/reviews`, { method: 'POST', token: session.token, body });
}

// Evenement termine avec un billet paye pour `holder`.
async function pastEventWithHolder() {
  const eventId = await createApprovedEvent(srv, { admin, body: { capacity: 20 } });
  const holder = await registerAndLogin(srv);
  assert.equal((await srv.api('/api/tickets', { method: 'POST', token: holder.token, body: { event_id: eventId } })).status, 201);
  await db.execute({ sql: 'update events set starts_at = ?, ends_at = ? where id = ?', args: [isoIn(-3, '20:00'), isoIn(-3, '23:00'), eventId] });
  return { eventId, holder };
}

before(async () => {
  srv = await startServer();
  db = createClient({ url: `file:${path.join(srv.dir, 'test.db')}` });
  admin = await srv.login(DEMO.admin.email, DEMO.admin.password);
});

after(async () => {
  db?.close();
  await srv?.stop();
});

describe('avis', () => {
  it('moyenne publique du seed, avis masque exclu, auteur abrege', async () => {
    const response = await srv.api('/api/events/evt_zouglou_past/reviews');
    assert.equal(response.status, 200);
    assert.equal(response.json.summary.count, 3);
    assert.equal(response.json.summary.average, 4.3);
    assert.deepEqual(response.json.reviews.map((item) => item.author).sort(), ['Awa K.', 'Fatou T.', 'Yao K.']);
    assert.ok(!response.text.includes('WhatsApp'), 'l\'avis masque n\'est pas public');
    assert.ok(!response.text.includes('@demo.festiconnect.ci'), 'pas d\'email');
    assert.equal(response.json.can_review, false);
    const event = (await srv.api('/api/events/evt_zouglou_past')).json.event;
    assert.deepEqual([Number(event.rating_avg), Number(event.rating_count)], [4.3, 3]);
  });

  it('le client de demonstration peut noter l\'evenement passe, une seule fois', async () => {
    const client = await srv.login(DEMO.client.email, DEMO.client.password);
    const before = await srv.api('/api/events/evt_zouglou_past/reviews', { token: client.token });
    assert.equal(before.json.can_review, true);
    const posted = await review('evt_zouglou_past', client, { rating: 5, comment: 'Ligne 1\nLigne 2' });
    assert.equal(posted.status, 201, posted.text);
    assert.equal(posted.json.summary.count, 4);
    const again = await review('evt_zouglou_past', client);
    assert.equal(again.status, 409);
    assert.equal(again.json.error.code, 'ALREADY_REVIEWED');
    const after = await srv.api('/api/events/evt_zouglou_past/reviews', { token: client.token });
    assert.equal(after.json.can_review, false);
    assert.equal(after.json.review_status, 'already');
    assert.ok(after.json.reviews.some((item) => item.mine && item.comment === 'Ligne 1\nLigne 2'));
  });

  it('reserve aux detenteurs d\'un billet paye, apres l\'evenement', async () => {
    const { eventId, holder } = await pastEventWithHolder();
    const stranger = await registerAndLogin(srv);
    const refused = await review(eventId, stranger);
    assert.equal(refused.status, 403);
    assert.equal(refused.json.error.code, 'NOT_A_PARTICIPANT');
    const organizer = await srv.login(DEMO.organizer.email, DEMO.organizer.password);
    assert.equal((await review(eventId, organizer)).status, 403, 'role organisateur');
    assert.equal((await srv.api(`/api/events/${eventId}/reviews`, { method: 'POST', body: { rating: 5 } })).status, 401);

    const upcoming = await createApprovedEvent(srv, { admin, body: { capacity: 20 } });
    await srv.api('/api/tickets', { method: 'POST', token: holder.token, body: { event_id: upcoming } });
    const early = await review(upcoming, holder);
    assert.equal(early.status, 409);
    assert.equal(early.json.error.code, 'EVENT_NOT_ENDED');

    const cancelledHolder = await registerAndLogin(srv);
    const bought = await srv.api('/api/tickets', { method: 'POST', token: cancelledHolder.token, body: { event_id: upcoming } });
    await db.execute({ sql: "update tickets set status = 'cancelled' where id = ?", args: [bought.json.id] });
    await db.execute({ sql: 'update events set starts_at = ?, ends_at = ? where id = ?', args: [isoIn(-2), isoIn(-2, '23:00'), upcoming] });
    assert.equal((await review(upcoming, cancelledHolder)).status, 403, 'billet annule');
    assert.equal((await review(eventId, holder)).status, 201);
  });

  it('valide la note et le commentaire', async () => {
    const { eventId, holder } = await pastEventWithHolder();
    for (const body of [{}, { rating: 0 }, { rating: 6 }, { rating: 4.5 }, { rating: '5e0' }, { rating: 4, comment: 'x'.repeat(1001) }, { rating: 4, comment: '<script>alert(1)</script>' }]) {
      assert.equal((await review(eventId, holder, body)).status, 422, JSON.stringify(body).slice(0, 60));
    }
  });

  it('moderation : reservee a l\'admin, l\'avis masque sort de la moyenne', async () => {
    const { eventId, holder } = await pastEventWithHolder();
    const posted = await review(eventId, holder, { rating: 1, comment: 'Arnaque, contactez-moi au 07 00 00 00 00' });
    const client = await registerAndLogin(srv);
    assert.equal((await srv.api(`/api/admin/reviews/${posted.json.id}`, { method: 'PATCH', token: client.token, body: { hidden: true } })).status, 403);
    assert.equal((await srv.api('/api/admin/reviews', { token: client.token })).status, 403);
    assert.equal((await srv.api(`/api/admin/reviews/${posted.json.id}`, { method: 'PATCH', token: admin.token, body: { hidden: 'oui' } })).status, 422);
    assert.equal((await srv.api(`/api/admin/reviews/${posted.json.id}`, { method: 'PATCH', token: admin.token, body: { hidden: true } })).status, 200);
    const publicList = await srv.api(`/api/events/${eventId}/reviews`);
    assert.equal(publicList.json.summary.count, 0);
    assert.equal(publicList.json.reviews.length, 0);
    const hidden = await srv.api('/api/admin/reviews?hidden=1', { token: admin.token });
    assert.ok(hidden.json.reviews.some((item) => item.id === posted.json.id));
    assert.equal((await srv.api('/api/admin/reviews/rev_inconnu', { method: 'PATCH', token: admin.token, body: { hidden: true } })).status, 404);
  });
});
