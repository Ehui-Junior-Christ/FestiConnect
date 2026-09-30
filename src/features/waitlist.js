// Liste d'attente sur un evenement complet (ou une categorie complete), et
// annulation d'un billet par l'organisateur. Quand des places se liberent
// (jauge augmentee, billet annule), les inscrits recoivent une notification
// in-app ; la place n'est pas reservee : premier arrive, premier servi.
import { db, randomId, requireUser, safely } from '../app/context.js';
import { pathId, route } from '../app/router.js';
import { AppError, notFound } from '../shared/errors.js';
import { parseBody, sendJson } from '../shared/http.js';
import { RateLimiter, enforce } from '../shared/rateLimit.js';
import * as v from '../shared/validation.js';
import { availableSeats, findEvent, loadCategories, onSeatsFreed, releaseCategorySeats, releaseEventSeats, seatsFreed } from './events.js';
import { notify } from './notifications.js';

const waitlistLimiter = new RateLimiter({ windowMs: 10 * 60 * 1000, max: 30 });
const MAX_NOTIFIED_PER_RELEASE = 500;

function categoryParam(value) {
  if (value === undefined || value === null || value === '') return '';
  return v.id(value, { label: 'Catégorie de billet' });
}

// Previent les inscrits des categories (ou de l'evenement) qui ont des places.
export async function notifyWaitlist(eventId) {
  const event = await findEvent(eventId);
  if (!event || event.status !== 'approved') return 0;
  const started = await db.execute({ sql: "select datetime(starts_at) <= datetime('now') as started from events where id = ?", args: [eventId] });
  if (Number(started.rows[0]?.started)) return 0;
  const categories = new Map((await loadCategories(eventId)).map((category) => [category.id, category.name]));
  let sent = 0;
  for (const [categoryId, seats] of await availableSeats(eventId)) {
    if (seats <= 0) continue;
    const waiting = await db.execute({
      sql: `select id, user_id from waitlist where event_id = ? and category_id = ? and notified_at = ''
            order by created_at limit ${MAX_NOTIFIED_PER_RELEASE}`,
      args: [eventId, categoryId]
    });
    const label = categoryId ? ` (${categories.get(categoryId) || 'catégorie'})` : '';
    for (const entry of waiting.rows) {
      const claimed = await db.execute({
        sql: "update waitlist set notified_at = ? where id = ? and notified_at = ''",
        args: [new Date().toISOString(), entry.id]
      });
      if (!claimed.rowsAffected) continue;
      await notify(entry.user_id, {
        type: 'waitlist',
        title: `Des places se sont libérées : ${event.title}`,
        body: `${seats > 1 ? `${seats} places sont disponibles` : 'Une place est disponible'}${label}. Elles ne sont pas réservées : premier arrivé, premier servi.`,
        link: `/evenement.html?id=${encodeURIComponent(eventId)}#reserver`
      });
      sent += 1;
    }
  }
  return sent;
}

onSeatsFreed(notifyWaitlist);

route('GET', /^\/api\/events\/([^/]+)\/waitlist$/, async ({ req, res, params }) => {
  const user = await requireUser(req);
  const eventId = pathId(params[0]);
  if (!eventId) return notFound(res);
  const result = await db.execute({
    sql: 'select category_id, notified_at, created_at from waitlist where event_id = ? and user_id = ?',
    args: [eventId, user.id]
  });
  return sendJson(res, 200, { entries: result.rows });
});

route('POST', /^\/api\/events\/([^/]+)\/waitlist$/, async ({ req, res, params }) => {
  const user = await requireUser(req, ['client', 'admin']);
  enforce(waitlistLimiter, user.id);
  const eventId = pathId(params[0]);
  if (!eventId) return notFound(res);
  const body = await parseBody(req);
  const categoryId = categoryParam(body.category_id);
  const event = await findEvent(eventId);
  if (!event || event.status !== 'approved') throw new AppError(404, 'EVENT_NOT_FOUND', 'Événement introuvable.');
  const open = await db.execute({ sql: "select datetime(starts_at) > datetime('now') as open from events where id = ?", args: [eventId] });
  if (!Number(open.rows[0].open)) throw new AppError(409, 'EVENT_STARTED', 'Cet événement a déjà commencé : la liste d\'attente est fermée.');
  const seats = await availableSeats(eventId);
  const categories = await loadCategories(eventId);
  if (categories.length && !categoryId) throw new AppError(422, 'VALIDATION_ERROR', 'Choisis la catégorie pour laquelle tu veux être prévenu.');
  if (!seats.has(categoryId)) throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Cette catégorie de billet n\'existe pas pour cet événement.');
  if (seats.get(categoryId) > 0) {
    throw new AppError(409, 'NOT_SOLD_OUT', 'Il reste des places : tu peux réserver directement.');
  }
  // Nouvelle inscription, ou reinscription apres une alerte deja envoyee.
  await db.execute({
    sql: `insert into waitlist (id, event_id, category_id, user_id, created_at, notified_at)
          values (?, ?, ?, ?, ?, '')
          on conflict(event_id, category_id, user_id) do update set notified_at = '', created_at = excluded.created_at
          where waitlist.notified_at <> ''`,
    args: [randomId('wai'), eventId, categoryId, user.id, new Date().toISOString()]
  });
  const position = await db.execute({
    sql: `select count(*) as n from waitlist where event_id = ? and category_id = ? and notified_at = ''
            and created_at <= (select created_at from waitlist where event_id = ? and category_id = ? and user_id = ?)`,
    args: [eventId, categoryId, eventId, categoryId, user.id]
  });
  return sendJson(res, 201, { ok: true, position: Number(position.rows[0].n) });
});

route('DELETE', /^\/api\/events\/([^/]+)\/waitlist$/, async ({ req, res, params, url }) => {
  const user = await requireUser(req);
  const eventId = pathId(params[0]);
  if (!eventId) return notFound(res);
  const categoryId = categoryParam(url.searchParams.get('category_id'));
  await db.execute({
    sql: 'delete from waitlist where event_id = ? and category_id = ? and user_id = ?',
    args: [eventId, categoryId, user.id]
  });
  return sendJson(res, 200, { ok: true });
});

// Listes d'attente de l'utilisateur (espace client).
route('GET', '/api/waitlist', async ({ req, res }) => {
  const user = await requireUser(req);
  const result = await db.execute({
    sql: `select waitlist.event_id, waitlist.category_id, waitlist.notified_at, waitlist.created_at,
                 events.title, events.starts_at, events.city, ticket_categories.name as category_name
          from waitlist
          join events on events.id = waitlist.event_id
          left join ticket_categories on ticket_categories.id = waitlist.category_id
          where waitlist.user_id = ? and events.status = 'approved' and datetime(events.starts_at) > datetime('now')
          order by datetime(events.starts_at) asc`,
    args: [user.id]
  });
  return sendJson(res, 200, { entries: result.rows });
});

// ---------------------------------------------------------------------------
// Annulation d'un billet par l'organisateur (ou un admin)
// ---------------------------------------------------------------------------

route('POST', /^\/api\/organizer\/tickets\/([^/]+)\/cancel$/, async ({ req, res, params }) => {
  const user = await requireUser(req, ['organisateur', 'admin']);
  const ticketId = pathId(params[0]);
  if (!ticketId) return notFound(res);
  const found = await db.execute({
    sql: `select tickets.id, tickets.user_id, tickets.quantity, tickets.category_id, tickets.status, tickets.checked_in_at,
                 events.id as event_id, events.title, events.organizer_id
          from tickets join events on events.id = tickets.event_id where tickets.id = ?`,
    args: [ticketId]
  });
  const ticket = found.rows[0];
  if (!ticket || (user.role !== 'admin' && ticket.organizer_id !== user.id)) return notFound(res);
  // Transition atomique paid -> cancelled : les places ne sont liberees qu'une fois.
  const cancelled = await db.execute({
    sql: "update tickets set status = 'cancelled', cancelled_at = ? where id = ? and status = 'paid' and coalesce(checked_in_at, '') = ''",
    args: [new Date().toISOString(), ticketId]
  });
  if (!cancelled.rowsAffected) {
    const reason = ticket.checked_in_at ? 'Ce billet a déjà été scanné à l\'entrée : il ne peut plus être annulé.' : 'Ce billet est déjà annulé.';
    throw new AppError(409, 'TICKET_NOT_CANCELLABLE', reason);
  }
  const quantity = Number(ticket.quantity || 1);
  if (ticket.category_id) await safely('liberation categorie', () => releaseCategorySeats(ticket.category_id, quantity));
  await safely('liberation evenement', () => releaseEventSeats(ticket.event_id, quantity));
  await notify(ticket.user_id, {
    type: 'ticket_cancelled',
    title: `Billet annulé : ${ticket.title}`,
    body: 'L\'organisateur a annulé ta réservation. Pour le remboursement Mobile Money, réponds-lui ou écris au support FestiConnect avec la référence de ton billet.',
    link: '/client.html#tickets'
  });
  await seatsFreed(ticket.event_id);
  return sendJson(res, 200, { ok: true });
});
