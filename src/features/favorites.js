// Favoris (« Garder » un evenement). Hors connexion, la liste vit dans le
// navigateur (localStorage) ; a la connexion elle est fusionnee ici via
// POST /api/favorites/sync. Seuls les evenements publies peuvent etre gardes.
import { db, randomId, requireUser } from '../app/context.js';
import { pathId, route } from '../app/router.js';
import { AppError, notFound } from '../shared/errors.js';
import { parseBody, sendJson } from '../shared/http.js';
import * as v from '../shared/validation.js';

const MAX_FAVORITES = 300;
const MAX_SYNC = 100;

async function favoriteIds(userId) {
  const result = await db.execute({ sql: 'select event_id from favorites where user_id = ? order by created_at desc', args: [userId] });
  return result.rows.map((row) => row.event_id);
}

// Ajoute si l'evenement est publie et que le plafond n'est pas atteint.
async function addFavorite(userId, eventId) {
  const result = await db.execute({
    sql: `insert or ignore into favorites (id, user_id, event_id, created_at)
          select ?, ?, events.id, ? from events
          where events.id = ? and events.status = 'approved'
            and (select count(*) from favorites where user_id = ?) < ${MAX_FAVORITES}`,
    args: [randomId('fav'), userId, new Date().toISOString(), eventId, userId]
  });
  return result.rowsAffected;
}

route('GET', '/api/favorites', async ({ req, res }) => {
  const user = await requireUser(req);
  const result = await db.execute({
    sql: `select events.*, users.name as organizer_name,
                 (select count(*) from ticket_categories c where c.event_id = events.id) as categories_count,
                 (select min(c.price_xof) from ticket_categories c where c.event_id = events.id and c.sold < c.capacity) as min_available_price_xof
          from favorites
          join events on events.id = favorites.event_id
          join users on users.id = events.organizer_id
          where favorites.user_id = ? and events.status = 'approved'
          order by datetime(coalesce(nullif(events.ends_at, ''), events.starts_at)) < datetime('now'), datetime(events.starts_at) asc`,
    args: [user.id]
  });
  return sendJson(res, 200, { events: result.rows, ids: result.rows.map((row) => row.id) });
});

route('PUT', /^\/api\/favorites\/([^/]+)$/, async ({ req, res, params }) => {
  const user = await requireUser(req);
  const eventId = pathId(params[0]);
  if (!eventId) return notFound(res);
  const exists = await db.execute({ sql: "select 1 from events where id = ? and status = 'approved'", args: [eventId] });
  if (!exists.rows[0]) return notFound(res);
  const already = await db.execute({ sql: 'select 1 from favorites where user_id = ? and event_id = ?', args: [user.id, eventId] });
  if (!already.rows[0] && !(await addFavorite(user.id, eventId))) {
    throw new AppError(409, 'FAVORITES_FULL', `Tu as déjà gardé ${MAX_FAVORITES} événements. Retire-en quelques-uns.`);
  }
  return sendJson(res, 200, { ok: true, saved: true });
});

route('DELETE', /^\/api\/favorites\/([^/]+)$/, async ({ req, res, params }) => {
  const user = await requireUser(req);
  const eventId = pathId(params[0]);
  if (!eventId) return notFound(res);
  await db.execute({ sql: 'delete from favorites where user_id = ? and event_id = ?', args: [user.id, eventId] });
  return sendJson(res, 200, { ok: true, saved: false });
});

// Fusion de la liste locale (hors connexion) avec celle du compte.
route('POST', '/api/favorites/sync', async ({ req, res }) => {
  const user = await requireUser(req);
  const body = await parseBody(req);
  const raw = body.event_ids ?? [];
  if (!Array.isArray(raw) || raw.length > MAX_SYNC) {
    throw new AppError(422, 'VALIDATION_ERROR', `Liste de favoris invalide (${MAX_SYNC} au maximum).`);
  }
  // Les identifiants mal formes ou d'evenements non publies sont ignores.
  const ids = [...new Set(raw.filter((value) => v.isValidId(value)))];
  for (const eventId of ids) await addFavorite(user.id, eventId);
  return sendJson(res, 200, { ids: await favoriteIds(user.id) });
});
