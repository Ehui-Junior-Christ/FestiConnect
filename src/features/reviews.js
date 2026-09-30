// Avis apres l'evenement : note de 1 a 5 et commentaire, reserves aux
// detenteurs d'un billet paye, une fois l'evenement termine, un avis par
// personne. Moderation par l'administration (avis masques).
import { currentUser, db, randomId, requireUser } from '../app/context.js';
import { pathId, route } from '../app/router.js';
import { AppError, notFound } from '../shared/errors.js';
import { parseBody, sendJson } from '../shared/http.js';
import { RateLimiter, enforce } from '../shared/rateLimit.js';
import * as v from '../shared/validation.js';
import { findVisibleEvent } from './events.js';

const reviewLimiter = new RateLimiter({ windowMs: 60 * 60 * 1000, max: 10 });
const ENDED_SQL = "datetime(coalesce(nullif(events.ends_at, ''), events.starts_at)) <= datetime('now')";

// « Junior E. » : prenom et initiale, jamais le nom complet ni l'email.
function authorName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Participant';
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.` : parts[0];
}

export async function ratingSummary(eventId) {
  const result = await db.execute({
    sql: `select rating, count(*) as n from reviews where event_id = ? and hidden = 0 group by rating`,
    args: [eventId]
  });
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let count = 0;
  let total = 0;
  for (const row of result.rows) {
    distribution[row.rating] = Number(row.n);
    count += Number(row.n);
    total += Number(row.rating) * Number(row.n);
  }
  return { count, average: count ? Math.round((total / count) * 10) / 10 : null, distribution };
}

// Peut noter : billet paye + evenement termine + pas encore d'avis.
async function reviewEligibility(eventId, user) {
  if (!user || !['client', 'admin'].includes(user.role)) return { can: false, reason: 'role' };
  const result = await db.execute({
    sql: `select ${ENDED_SQL} as ended,
                 exists(select 1 from tickets where tickets.event_id = events.id and tickets.user_id = ? and tickets.status = 'paid') as holder,
                 exists(select 1 from reviews where reviews.event_id = events.id and reviews.user_id = ?) as reviewed
          from events where events.id = ?`,
    args: [user.id, user.id, eventId]
  });
  const row = result.rows[0];
  if (!row) return { can: false, reason: 'missing' };
  if (!Number(row.holder)) return { can: false, reason: 'no_ticket' };
  if (Number(row.reviewed)) return { can: false, reason: 'already' };
  if (!Number(row.ended)) return { can: false, reason: 'not_ended' };
  return { can: true, reason: '' };
}

route('GET', /^\/api\/events\/([^/]+)\/reviews$/, async ({ req, res, params }) => {
  const eventId = pathId(params[0]);
  if (!eventId) return notFound(res);
  const event = await findVisibleEvent(eventId, req);
  if (!event) return notFound(res);
  const user = await currentUser(req);
  const list = await db.execute({
    sql: `select reviews.id, reviews.rating, reviews.comment, reviews.created_at, reviews.user_id, users.name
          from reviews join users on users.id = reviews.user_id
          where reviews.event_id = ? and reviews.hidden = 0
          order by reviews.created_at desc limit 50`,
    args: [eventId]
  });
  const eligibility = await reviewEligibility(eventId, user);
  return sendJson(res, 200, {
    summary: await ratingSummary(eventId),
    reviews: list.rows.map((row) => ({
      id: row.id,
      rating: Number(row.rating),
      comment: row.comment,
      author: authorName(row.name),
      created_at: row.created_at,
      mine: Boolean(user && row.user_id === user.id)
    })),
    can_review: eligibility.can,
    review_status: eligibility.reason
  });
});

route('POST', /^\/api\/events\/([^/]+)\/reviews$/, async ({ req, res, params }) => {
  const user = await requireUser(req, ['client', 'admin']);
  enforce(reviewLimiter, user.id);
  const eventId = pathId(params[0]);
  if (!eventId) return notFound(res);
  const body = await parseBody(req);
  const rating = v.integer(body.rating, { label: 'Note', min: 1, max: 5 });
  const comment = v.text(body.comment, { label: 'Commentaire', max: 1000, multiline: true });
  const event = await findVisibleEvent(eventId, req);
  if (!event || event.status !== 'approved') return notFound(res);
  const eligibility = await reviewEligibility(eventId, user);
  if (!eligibility.can) {
    const errors = {
      no_ticket: [403, 'NOT_A_PARTICIPANT', 'Seules les personnes qui avaient un billet payé peuvent donner leur avis.'],
      already: [409, 'ALREADY_REVIEWED', 'Tu as déjà donné ton avis sur cet événement.'],
      not_ended: [409, 'EVENT_NOT_ENDED', 'Tu pourras donner ton avis une fois l\'événement terminé.']
    };
    const [status, code, message] = errors[eligibility.reason] || [404, 'NOT_FOUND', 'Ressource introuvable.'];
    throw new AppError(status, code, message);
  }
  const id = randomId('rev');
  const now = new Date().toISOString();
  try {
    await db.execute({
      sql: `insert into reviews (id, event_id, user_id, rating, comment, hidden, created_at, updated_at)
            values (?, ?, ?, ?, ?, 0, ?, ?)`,
      args: [id, eventId, user.id, rating, comment, now, now]
    });
  } catch (error) {
    if (String(error?.message || '').includes('UNIQUE')) {
      throw new AppError(409, 'ALREADY_REVIEWED', 'Tu as déjà donné ton avis sur cet événement.');
    }
    throw error;
  }
  return sendJson(res, 201, { id, summary: await ratingSummary(eventId) });
});

// ---------------------------------------------------------------------------
// Moderation
// ---------------------------------------------------------------------------

route('GET', '/api/admin/reviews', async ({ req, res, url }) => {
  await requireUser(req, ['admin']);
  const filter = v.oneOf(url.searchParams.get('hidden'), ['0', '1'], { label: 'Filtre', fallback: '' });
  const result = await db.execute({
    sql: `select reviews.*, users.name as author_name, users.email as author_email, events.title as event_title
          from reviews
          join users on users.id = reviews.user_id
          join events on events.id = reviews.event_id
          where (? = '' or reviews.hidden = cast(? as integer))
          order by reviews.created_at desc limit 200`,
    args: [filter, filter]
  });
  return sendJson(res, 200, {
    reviews: result.rows.map((row) => ({
      id: row.id,
      event_id: row.event_id,
      event_title: row.event_title,
      author_name: row.author_name,
      author_email: row.author_email,
      rating: Number(row.rating),
      comment: row.comment,
      hidden: Boolean(Number(row.hidden)),
      created_at: row.created_at
    }))
  });
});

route('PATCH', /^\/api\/admin\/reviews\/([^/]+)$/, async ({ req, res, params }) => {
  await requireUser(req, ['admin']);
  const reviewId = pathId(params[0]);
  if (!reviewId) return notFound(res);
  const body = await parseBody(req);
  if (typeof body.hidden !== 'boolean') throw new AppError(422, 'VALIDATION_ERROR', 'Indique si l\'avis est masqué (true ou false).');
  const result = await db.execute({
    sql: 'update reviews set hidden = ?, updated_at = ? where id = ?',
    args: [body.hidden ? 1 : 0, new Date().toISOString(), reviewId]
  });
  if (!result.rowsAffected) return notFound(res);
  return sendJson(res, 200, { ok: true, hidden: body.hidden });
});
