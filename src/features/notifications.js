// Centre de notifications in-app.
// Les notifications sont ecrites par le serveur (textes generes cote serveur,
// liens locaux) et ne sont lisibles que par leur destinataire.
import { db, eventTimeMs, randomId, requireUser, safely } from '../app/context.js';
import { route } from '../app/router.js';
import { AppError } from '../shared/errors.js';
import { parseBody, sendJson } from '../shared/http.js';
import * as v from '../shared/validation.js';

export const NOTIFICATION_TYPES = Object.freeze([
  'event_status', 'event_changed', 'withdrawal', 'waitlist', 'reminder', 'ticket_cancelled'
]);
const MAX_PER_USER = 200;
const LIST_LIMIT = 50;
const MAX_IDS = 100;

const DAY_FR = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Abidjan' });

// « le jeudi 1 octobre à 21h00 », heure d'Abidjan (UTC).
export function formatEventDate(value) {
  const time = eventTimeMs(value);
  if (Number.isNaN(time)) return 'à une date à confirmer';
  const date = new Date(time);
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `le ${DAY_FR.format(date)} à ${hours}h${minutes}`;
}

function clip(value, max) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function safeLink(link) {
  return /^\/(?![/\\])[A-Za-z0-9._~\-/?=&#%]*$/.test(link || '') ? link : '';
}

// Cree une notification. Ne leve jamais : une notification ratee ne doit pas
// faire echouer l'action qui l'a declenchee.
export async function notify(userId, { type, title, body = '', link = '', id }) {
  if (!NOTIFICATION_TYPES.includes(type)) throw new Error(`Type de notification inconnu: ${type}`);
  return safely(`notification ${type}`, async () => {
    const result = await db.execute({
      sql: `insert or ignore into notifications (id, user_id, type, title, body, link, created_at)
            values (?, ?, ?, ?, ?, ?, ?)`,
      args: [id || randomId('ntf'), userId, type, clip(title, 160), clip(body, 500), safeLink(link), new Date().toISOString()]
    });
    if (result.rowsAffected) {
      await db.execute({
        sql: `delete from notifications where user_id = ? and id not in (
                select id from notifications where user_id = ? order by created_at desc limit ${MAX_PER_USER})`,
        args: [userId, userId]
      });
    }
    return result.rowsAffected === 1;
  });
}

// Rappel J-1, calcule a la lecture (pas de tache planifiee) : pour chaque billet
// paye d'un evenement qui commence demain ou aujourd'hui (calendrier d'Abidjan =
// UTC), une notification a identifiant stable est creee une seule fois
// (insert or ignore), ce qui conserve ensuite son etat « lu ».
async function materializeReminders(userId) {
  const due = await db.execute({
    sql: `select tickets.id, events.title, events.starts_at, events.location, events.city,
                 date(events.starts_at) = date('now') as today
          from tickets join events on events.id = tickets.event_id
          where tickets.user_id = ? and tickets.status = 'paid'
            and datetime(events.starts_at) > datetime('now')
            and datetime(events.starts_at) < datetime('now', 'start of day', '+2 days')
          limit 20`,
    args: [userId]
  });
  for (const ticket of due.rows) {
    const place = [ticket.location, ticket.city].filter(Boolean).join(', ');
    await notify(userId, {
      id: `rem_${ticket.id}`.slice(0, 64),
      type: 'reminder',
      title: `${Number(ticket.today) ? 'C\'est aujourd\'hui' : 'C\'est demain'} : ${ticket.title}`,
      body: `Rendez-vous ${formatEventDate(ticket.starts_at)}${place ? `, ${place}` : ''}. Garde ton billet prêt à l'entrée.`,
      link: '/client.html#tickets'
    });
  }
}

async function unreadCount(userId) {
  const result = await db.execute({ sql: 'select count(*) as n from notifications where user_id = ? and read_at is null', args: [userId] });
  return Number(result.rows[0].n);
}

route('GET', '/api/notifications', async ({ req, res }) => {
  const user = await requireUser(req);
  await materializeReminders(user.id);
  const result = await db.execute({
    sql: `select id, type, title, body, link, read_at, created_at from notifications
          where user_id = ? order by created_at desc limit ${LIST_LIMIT}`,
    args: [user.id]
  });
  return sendJson(res, 200, { notifications: result.rows, unread: await unreadCount(user.id) });
});

route('GET', '/api/notifications/unread-count', async ({ req, res }) => {
  const user = await requireUser(req);
  await materializeReminders(user.id);
  return sendJson(res, 200, { unread: await unreadCount(user.id) });
});

// Marque comme lues : { all: true } ou { ids: [...] } (uniquement les siennes).
route('POST', '/api/notifications/read', async ({ req, res }) => {
  const user = await requireUser(req);
  const body = await parseBody(req);
  const now = new Date().toISOString();
  if (body.all === true) {
    await db.execute({ sql: 'update notifications set read_at = ? where user_id = ? and read_at is null', args: [now, user.id] });
  } else {
    if (!Array.isArray(body.ids) || !body.ids.length || body.ids.length > MAX_IDS) {
      throw new AppError(422, 'VALIDATION_ERROR', `Indique entre 1 et ${MAX_IDS} notifications à marquer comme lues.`);
    }
    const ids = [...new Set(body.ids.map((value) => v.id(value, { label: 'Notification' })))];
    await db.execute({
      sql: `update notifications set read_at = ? where user_id = ? and read_at is null and id in (${ids.map(() => '?').join(', ')})`,
      args: [now, user.id, ...ids]
    });
  }
  return sendJson(res, 200, { unread: await unreadCount(user.id) });
});
