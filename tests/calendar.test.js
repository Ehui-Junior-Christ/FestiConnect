// Export .ics (RFC 5545) : echappement, pliage, fuseau, acces.
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { DEMO, isoIn, registerAndLogin, startServer } from './_helpers.js';

process.env.NODE_ENV = 'test';
process.env.TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL || 'file::memory:';
const { escapeIcsText, foldIcsLine, buildIcs, icsDate } = await import('../src/features/calendar.js');

let srv;

before(async () => {
  srv = await startServer();
});

after(async () => {
  await srv?.stop();
});

describe('format iCalendar', () => {
  it('echappe \\ ; , et les retours a la ligne', () => {
    assert.equal(escapeIcsText('Zouglou; coupé-décalé, et \\ «Abidjan»\r\nLigne 2\nLigne 3'), 'Zouglou\\; coupé-décalé\\, et \\\\ «Abidjan»\\nLigne 2\\nLigne 3');
  });

  it('plie les lignes a 75 octets sans couper un caractere multi-octets', () => {
    const line = `DESCRIPTION:${'é'.repeat(100)}`;
    const folded = foldIcsLine(line);
    const parts = folded.split('\r\n');
    assert.ok(parts.length > 1);
    for (const part of parts) assert.ok(Buffer.byteLength(part, 'utf8') <= 75, part);
    assert.ok(parts.slice(1).every((part) => part.startsWith(' ')));
    assert.equal(parts.map((part, index) => (index ? part.slice(1) : part)).join(''), line);
    assert.ok(!folded.includes('�'));
  });

  it('heure d\'Abidjan ecrite en UTC, fin par defaut, CRLF', () => {
    const ics = buildIcs({ id: 'evt_x', title: 'Nuit, test; ok', starts_at: '2026-12-31T22:30', ends_at: '', location: 'Palais de la Culture', city: 'Abidjan', description: '' }, { now: Date.UTC(2026, 8, 30, 12) });
    assert.match(ics, /\r\nDTSTART:20261231T223000Z\r\n/);
    assert.match(ics, /\r\nDTEND:20270101T013000Z\r\n/);
    assert.match(ics, /\r\nDTSTAMP:20260930T120000Z\r\n/);
    assert.match(ics, /\r\nSUMMARY:Nuit\\, test\\; ok\r\n/);
    assert.match(ics, /\r\nLOCATION:Palais de la Culture\\, Abidjan\r\n/);
    assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
    assert.ok(!/[^\r]\n/.test(ics), 'toutes les fins de ligne sont CRLF');
    assert.equal(icsDate(Date.UTC(2026, 0, 2, 3, 4, 5)), '20260102T030405Z');
  });
});

describe('GET /api/events/:id/ics', () => {
  it('telecharge un fichier .ics correct pour un evenement publie', async () => {
    const response = await srv.api('/api/events/evt_abissa_2026/ics');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'text/calendar; charset=utf-8');
    assert.equal(response.headers.get('content-disposition'), 'attachment; filename="festiconnect-festival-abissa-experience.ics"');
    assert.match(response.text, /^BEGIN:VCALENDAR\r\nVERSION:2\.0\r\n/);
    assert.match(response.text, /\r\nUID:evt_abissa_2026@festiconnect\.ci\r\n/);
    assert.match(response.text, /\r\nDTSTART:\d{8}T180000Z\r\n/);
    assert.match(response.text.replace(/\r\n /g, ''), /URL:http:\/\/localhost:\d+\/evenement\.html\?id=evt_abissa_2026/);
    assert.equal(response.headers.get('content-security-policy')?.includes("default-src 'self'"), true);
  });

  it('echappe les textes saisis par l\'organisateur', async () => {
    const organizer = await srv.login(DEMO.organizer.email, DEMO.organizer.password);
    const created = await srv.api('/api/events', {
      method: 'POST', token: organizer.token,
      body: { title: 'Gala; test, ok', category: 'Concert', city: 'Abidjan', starts_at: isoIn(10), description: 'Ligne 1\nBEGIN:VEVENT\nSUMMARY:pirate' }
    });
    const admin = await srv.login(DEMO.admin.email, DEMO.admin.password);
    await srv.api(`/api/events/${created.json.id}/status`, { method: 'PATCH', token: admin.token, body: { status: 'approved' } });
    const ics = (await srv.api(`/api/events/${created.json.id}/ics`)).text;
    assert.equal(ics.match(/^BEGIN:VEVENT\r$/gm)?.length, 1, 'aucune injection de composant');
    assert.match(ics, /SUMMARY:Gala\\; test\\, ok/);
    assert.match(ics.replace(/\r\n /g, ''), /DESCRIPTION:Ligne 1\\nBEGIN:VEVENT\\nSUMMARY:pirate/);
  });

  it('evenement non publie : reserve a son organisateur', async () => {
    assert.equal((await srv.api('/api/events/evt_pending_yakro/ics')).status, 404);
    const other = await registerAndLogin(srv, 'organisateur');
    assert.equal((await srv.api('/api/events/evt_pending_yakro/ics', { token: other.token })).status, 404);
    const owner = await srv.login(DEMO.organizer.email, DEMO.organizer.password);
    assert.equal((await srv.api('/api/events/evt_pending_yakro/ics', { token: owner.token })).status, 200);
    assert.equal((await srv.api('/api/events/evt_inconnu/ics')).status, 404);
  });
});
