// Centre de notifications : acces, isolation par utilisateur, rappel J-1.
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { DEMO, createApprovedEvent, isoIn, registerAndLogin, startServer } from './_helpers.js';

let srv;

before(async () => {
  srv = await startServer();
});

after(async () => {
  await srv?.stop();
});

describe('notifications', () => {
  it('anonyme => 401', async () => {
    assert.equal((await srv.api('/api/notifications')).status, 401);
    assert.equal((await srv.api('/api/notifications/unread-count')).status, 401);
    assert.equal((await srv.api('/api/notifications/read', { method: 'POST', body: { all: true } })).status, 401);
  });

  it('validation / refus d\'un evenement => notification pour son organisateur uniquement', async () => {
    const organizer = await registerAndLogin(srv, 'organisateur');
    const other = await registerAndLogin(srv, 'organisateur');
    const admin = await srv.login(DEMO.admin.email, DEMO.admin.password);
    await createApprovedEvent(srv, { session: organizer, admin, body: { title: 'Nuit Coupé-Décalé' } });
    const created = await srv.api('/api/events', { method: 'POST', token: organizer.token, body: { title: 'Brouillon refusé', category: 'Concert', city: 'Abidjan', starts_at: isoIn(20) } });
    await srv.api(`/api/events/${created.json.id}/status`, { method: 'PATCH', token: admin.token, body: { status: 'rejected' } });

    const mine = await srv.api('/api/notifications', { token: organizer.token });
    assert.equal(mine.status, 200);
    const titles = mine.json.notifications.map((item) => item.title);
    assert.ok(titles.includes('« Nuit Coupé-Décalé » est en ligne'), titles.join(' | '));
    assert.ok(titles.includes('« Brouillon refusé » n\'a pas été validé'), titles.join(' | '));
    assert.equal(mine.json.unread, 2);
    assert.ok(mine.json.notifications.every((item) => item.type === 'event_status' && item.link.startsWith('/')));
    assert.deepEqual((await srv.api('/api/notifications', { token: other.token })).json.notifications, []);
  });

  it('marquer comme lu : seulement ses propres notifications (IDOR)', async () => {
    const owner = await registerAndLogin(srv, 'organisateur');
    const attacker = await registerAndLogin(srv, 'organisateur');
    await createApprovedEvent(srv, { session: owner });
    const [notification] = (await srv.api('/api/notifications', { token: owner.token })).json.notifications;
    const attempt = await srv.api('/api/notifications/read', { method: 'POST', token: attacker.token, body: { ids: [notification.id] } });
    assert.equal(attempt.status, 200);
    assert.equal((await srv.api('/api/notifications/unread-count', { token: owner.token })).json.unread, 1, 'toujours non lue');
    await srv.api('/api/notifications/read', { method: 'POST', token: attacker.token, body: { all: true } });
    assert.equal((await srv.api('/api/notifications/unread-count', { token: owner.token })).json.unread, 1);

    const read = await srv.api('/api/notifications/read', { method: 'POST', token: owner.token, body: { ids: [notification.id] } });
    assert.equal(read.json.unread, 0);
    const listed = (await srv.api('/api/notifications', { token: owner.token })).json.notifications[0];
    assert.ok(listed.read_at);
  });

  it('valide les identifiants a marquer', async () => {
    const user = await registerAndLogin(srv);
    for (const body of [{}, { ids: 'ntf_1' }, { ids: [] }, { ids: ['<x>'] }, { ids: Array.from({ length: 101 }, (_, i) => `ntf_${i}`) }, { all: 'true' }]) {
      assert.equal((await srv.api('/api/notifications/read', { method: 'POST', token: user.token, body })).status, 422, JSON.stringify(body).slice(0, 60));
    }
  });

  it('rappel J-1 calcule a la lecture, une seule fois, pour les billets payes', async () => {
    const tomorrow = await createApprovedEvent(srv, { body: { title: 'Concert de demain', starts_at: isoIn(1, '23:30'), capacity: 50 } });
    const later = await createApprovedEvent(srv, { body: { title: 'Concert dans cinq jours', starts_at: isoIn(5), capacity: 50 } });
    const client = await registerAndLogin(srv);
    for (const eventId of [tomorrow, later]) {
      assert.equal((await srv.api('/api/tickets', { method: 'POST', token: client.token, body: { event_id: eventId } })).status, 201);
    }
    const first = await srv.api('/api/notifications', { token: client.token });
    const reminders = first.json.notifications.filter((item) => item.type === 'reminder');
    assert.equal(reminders.length, 1);
    assert.match(reminders[0].title, /^C'est (demain|aujourd'hui) : Concert de demain$/);
    assert.match(reminders[0].body, /à 23h30/);
    await srv.api('/api/notifications/read', { method: 'POST', token: client.token, body: { all: true } });
    const second = await srv.api('/api/notifications', { token: client.token });
    assert.equal(second.json.notifications.filter((item) => item.type === 'reminder').length, 1, 'pas de doublon');
    assert.equal(second.json.unread, 0, 'l\'etat lu est conserve');
  });

  it('le client de demonstration a son rappel pour l\'evenement de demain', async () => {
    const client = await srv.login(DEMO.client.email, DEMO.client.password);
    const list = await srv.api('/api/notifications', { token: client.token });
    assert.ok(list.json.notifications.some((item) => item.id === 'rem_tkt_demo_maquis'));
  });
});
