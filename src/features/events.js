// Evenements : catalogue, fiche, creation/edition (avec categories de billets),
// validation par l'administration et achat de billets.
//
// Categories de billets : un evenement peut definir jusqu'a MAX_CATEGORIES
// categories (Standard, VIP, Early bird...) avec leur prix et leur jauge. Sans
// categorie, l'evenement garde son tarif unique implicite (price_xof, capacity) :
// les evenements existants restent donc valables tels quels. Avec categories,
// events.capacity = somme des jauges, events.price_xof = prix le plus bas et
// events.tickets_sold = somme des ventes.
import crypto from 'node:crypto';
import { NOT_STARTED_SQL, currentUser, db, eventTimeMs, limiters, randomId, requireUser, safely } from '../app/context.js';
import { pathId, route, searchParam } from '../app/router.js';
import { assertIdentifier, insertByExistingColumns, tableColumns } from '../db/schema.js';
import { AppError, notFound } from '../shared/errors.js';
import { parseBody, sendJson } from '../shared/http.js';
import { enforce } from '../shared/rateLimit.js';
import * as v from '../shared/validation.js';
import { formatEventDate, notify } from './notifications.js';

export const PAYMENT_METHODS = ['Wave', 'Orange Money', 'Moov Money'];
const EVENT_STATUSES = ['approved', 'pending', 'rejected'];
export const MAX_TICKETS_PER_PURCHASE = 10;
export const MAX_CATEGORIES = 8;
const MAX_PRICE = 10_000_000;
const MAX_CAPACITY = 200_000;

// Reactions a une hausse de places disponibles (liste d'attente, etc.).
const capacityListeners = [];
export function onSeatsFreed(listener) {
  capacityListeners.push(listener);
}
export async function seatsFreed(eventId) {
  for (const listener of capacityListeners) {
    await safely('places liberees', () => listener(eventId));
  }
}

// ---------------------------------------------------------------------------
// Places : reservations atomiques (UPDATE conditionnels) avec compensation
// ---------------------------------------------------------------------------

// Places au niveau de l'evenement : ne passe que s'il reste assez de capacite
// (capacite <= 0 = historique "illimite") et si l'evenement n'a pas commence.
async function reserveEventSeats(eventId, quantity) {
  const columns = await tableColumns(db, 'events');
  const sets = ['tickets_sold = tickets_sold + ?'];
  const args = [quantity];
  if (columns.has('ticketsSold')) {
    sets.push('ticketsSold = coalesce(ticketsSold, 0) + ?');
    args.push(quantity);
  }
  args.push(eventId, quantity);
  const result = await db.execute({
    sql: `update events set ${sets.join(', ')}
          where id = ? and status = 'approved' and ${NOT_STARTED_SQL}
            and (coalesce(capacity, 0) <= 0 or coalesce(tickets_sold, 0) + ? <= capacity)`,
    args
  });
  return result.rowsAffected === 1;
}

export async function releaseEventSeats(eventId, quantity) {
  const columns = await tableColumns(db, 'events');
  const sets = ['tickets_sold = max(coalesce(tickets_sold, 0) - ?, 0)'];
  const args = [quantity];
  if (columns.has('ticketsSold')) {
    sets.push('ticketsSold = max(coalesce(ticketsSold, 0) - ?, 0)');
    args.push(quantity);
  }
  args.push(eventId);
  await db.execute({ sql: `update events set ${sets.join(', ')} where id = ?`, args });
}

// Places d'une categorie : meme principe, sur la jauge de la categorie.
async function reserveCategorySeats(categoryId, eventId, quantity) {
  const result = await db.execute({
    sql: `update ticket_categories set sold = sold + ?
          where id = ? and event_id = ? and sold + ? <= capacity
            and exists (select 1 from events where events.id = ticket_categories.event_id
                        and events.status = 'approved' and ${NOT_STARTED_SQL})`,
    args: [quantity, categoryId, eventId, quantity]
  });
  return result.rowsAffected === 1;
}

export async function releaseCategorySeats(categoryId, quantity) {
  await db.execute({ sql: 'update ticket_categories set sold = max(sold - ?, 0) where id = ?', args: [quantity, categoryId] });
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

export async function loadCategories(eventId) {
  const result = await db.execute({
    sql: 'select id, event_id, name, price_xof, capacity, sold, position from ticket_categories where event_id = ? order by position, created_at',
    args: [eventId]
  });
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    price_xof: Number(row.price_xof),
    capacity: Number(row.capacity),
    sold: Number(row.sold),
    position: Number(row.position)
  }));
}

export async function findEvent(eventId) {
  const result = await db.execute({
    sql: `select events.*, users.name as organizer_name
          from events join users on users.id = events.organizer_id
          where events.id = ?`,
    args: [eventId]
  });
  return result.rows[0] || null;
}

// Evenement visible par l'utilisateur : publie, ou brouillon de son organisateur / admin.
export async function findVisibleEvent(eventId, req) {
  const event = await findEvent(eventId);
  if (!event) return null;
  if (event.status !== 'approved') {
    const user = await currentUser(req);
    if (!user || (user.role !== 'admin' && user.id !== event.organizer_id)) return null;
  }
  return event;
}

// Evenement modifiable : son organisateur ou un admin (sinon introuvable).
export async function findOwnedEvent(eventId, user) {
  const event = await findEvent(eventId);
  if (!event || (user.role !== 'admin' && event.organizer_id !== user.id)) return null;
  return event;
}

route('GET', '/api/events', async ({ res, url }) => {
  const q = searchParam(url, 'q', 100);
  const category = searchParam(url, 'category', 40);
  const city = searchParam(url, 'city', 60);
  const like = `%${q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
  // Le catalogue public n'expose que les evenements valides (le parametre
  // `status` n'est plus pris en compte : voir /api/admin/events) et pas encore
  // termines (une fiche passee reste accessible par son lien, pour les avis).
  const result = await db.execute({
    sql: `select events.*, users.name as organizer_name,
                 (select count(*) from ticket_categories c where c.event_id = events.id) as categories_count,
                 (select min(c.price_xof) from ticket_categories c where c.event_id = events.id and c.sold < c.capacity) as min_available_price_xof
          from events join users on users.id = events.organizer_id
          where events.status = 'approved'
            and datetime(coalesce(nullif(events.ends_at, ''), events.starts_at)) > datetime('now')
            and (events.title like ? escape '\\' or events.description like ? escape '\\' or events.city like ? escape '\\')
            and (? = '' or events.category = ?)
            and (? = '' or events.city = ?)
          order by datetime(events.starts_at) asc
          limit 500`,
    args: [like, like, like, category, category, city, city]
  });
  return sendJson(res, 200, { events: result.rows });
});

route('GET', /^\/api\/events\/([^/]+)$/, async ({ req, res, params }) => {
  const eventId = pathId(params[0]);
  if (!eventId) return notFound(res);
  const event = await findVisibleEvent(eventId, req);
  if (!event) return notFound(res);
  return sendJson(res, 200, { event: { ...event, categories: await loadCategories(eventId) } });
});

// ---------------------------------------------------------------------------
// Creation / edition
// ---------------------------------------------------------------------------

function invalid(message) {
  return new AppError(422, 'VALIDATION_ERROR', message);
}

function parseEventFields(body) {
  if (!body.title || !body.category || !body.city || !body.starts_at) {
    throw invalid('Titre, catégorie, ville et date sont obligatoires.');
  }
  const title = v.text(body.title, { label: 'Titre', min: 3, max: 120, required: true });
  const category = v.text(body.category, { label: 'Catégorie', min: 2, max: 40, required: true });
  const city = v.text(body.city, { label: 'Ville', min: 2, max: 60, required: true });
  const location = v.text(body.location, { label: 'Lieu', max: 120, fallback: city });
  const startsAt = v.dateTime(body.starts_at, { label: 'Date de début', required: true });
  const endsAt = v.dateTime(body.ends_at, { label: 'Date de fin' }) || startsAt;
  if (eventTimeMs(endsAt) < eventTimeMs(startsAt)) {
    throw invalid('La date de fin doit être postérieure à la date de début.');
  }
  return {
    title,
    category,
    city,
    location,
    starts_at: startsAt,
    ends_at: endsAt,
    price_xof: v.integer(body.price_xof, { label: 'Prix', min: 0, max: MAX_PRICE, fallback: 0 }),
    capacity: v.integer(body.capacity, { label: 'Capacité', min: 1, max: MAX_CAPACITY, fallback: 100 }),
    cover_url: v.imageUrl(body.cover_url, { label: 'Image', fallback: '/assets/img/event-default.svg' }),
    description: v.text(body.description, { label: 'Description', max: 5000, multiline: true })
  };
}

// Categories envoyees par l'organisateur : null si le champ est absent.
export function parseCategories(raw) {
  if (raw === undefined || raw === null) return null;
  if (!Array.isArray(raw)) throw invalid('Les catégories de billets doivent être une liste.');
  if (raw.length > MAX_CATEGORIES) throw invalid(`${MAX_CATEGORIES} catégories de billets au maximum.`);
  const seen = new Set();
  return raw.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw invalid('Catégorie de billet invalide.');
    const name = v.text(item.name, { label: `Nom de la catégorie ${index + 1}`, min: 2, max: 40, required: true });
    const key = name.toLocaleLowerCase('fr');
    if (seen.has(key)) throw invalid(`La catégorie « ${name} » apparaît deux fois.`);
    seen.add(key);
    return {
      id: item.id === undefined || item.id === null || item.id === '' ? null : v.id(item.id, { label: 'Catégorie' }),
      name,
      price_xof: v.integer(item.price_xof, { label: `Prix « ${name} »`, min: 0, max: MAX_PRICE }),
      capacity: v.integer(item.capacity, { label: `Places « ${name} »`, min: 1, max: MAX_CAPACITY }),
      position: index
    };
  });
}

function categoryTotals(categories) {
  return {
    capacity: categories.reduce((sum, item) => sum + item.capacity, 0),
    price_xof: Math.min(...categories.map((item) => item.price_xof))
  };
}

// Met a jour les colonnes existantes d'un evenement (dont les colonnes
// historiques camelCase si la base en contient encore).
async function updateEventColumns(eventId, record, condition = '', conditionArgs = []) {
  const columns = await tableColumns(db, 'events');
  const entries = Object.entries(record).filter(([key, value]) => columns.has(key) && value !== undefined);
  if (!entries.length) return 1;
  const result = await db.execute({
    sql: `update events set ${entries.map(([key]) => `${assertIdentifier(key)} = ?`).join(', ')} where id = ?${condition}`,
    args: [...entries.map(([, value]) => value), eventId, ...conditionArgs]
  });
  return result.rowsAffected;
}

function legacyFields(fields) {
  return {
    date: fields.starts_at,
    price: fields.price_xof,
    ticketsCapacity: fields.capacity,
    image: fields.cover_url
  };
}

function categoryInsert(eventId, category, sold = 0) {
  return {
    sql: `insert into ticket_categories (id, event_id, name, price_xof, capacity, sold, position, created_at)
          values (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [randomId('cat'), eventId, category.name, category.price_xof, category.capacity, sold, category.position, new Date().toISOString()]
  };
}

route('POST', '/api/events', async ({ req, res }) => {
  const user = await requireUser(req, ['organisateur', 'admin']);
  enforce(limiters.eventCreateUser, user.id);
  const body = await parseBody(req);
  const fields = parseEventFields(body);
  if (eventTimeMs(fields.starts_at) <= Date.now()) {
    throw invalid('La date de début doit être dans le futur.');
  }
  const categories = parseCategories(body.categories) || [];
  if (categories.some((item) => item.id)) throw invalid('Une nouvelle catégorie ne peut pas avoir d\'identifiant.');
  if (categories.length) Object.assign(fields, categoryTotals(categories));

  const id = randomId('evt');
  await insertByExistingColumns(db, 'events', {
    id,
    organizer_id: user.id,
    organizerId: user.id,
    ...fields,
    ...legacyFields(fields),
    tickets_sold: 0,
    ticketsSold: 0,
    status: user.role === 'admin' ? 'approved' : 'pending',
    created_at: new Date().toISOString()
  });
  if (categories.length) {
    await db.batch(categories.map((category) => categoryInsert(id, category)), 'write');
  }
  return sendJson(res, 201, { id });
});

// Edition par l'organisateur (ou un admin). Le statut de validation est
// conserve. Garde-fous : aucune jauge sous le nombre de billets deja vendus,
// aucune categorie supprimee si elle a des ventes.
route('PATCH', /^\/api\/events\/([^/]+)$/, async ({ req, res, params }) => {
  const user = await requireUser(req, ['organisateur', 'admin']);
  const eventId = pathId(params[0]);
  if (!eventId) return notFound(res);
  const event = await findOwnedEvent(eventId, user);
  if (!event) return notFound(res);
  const body = await parseBody(req);
  const fields = parseEventFields(body);
  if (fields.starts_at !== event.starts_at && eventTimeMs(fields.starts_at) <= Date.now()) {
    throw invalid('La nouvelle date de début doit être dans le futur.');
  }
  const existing = await loadCategories(eventId);
  const wanted = parseCategories(body.categories) ?? existing;
  const sold = Number(event.tickets_sold || 0);
  const conflict = (message) => new AppError(409, 'CAPACITY_CONFLICT', message);

  // Controles prealables (les ecritures restent conditionnelles pour les courses).
  const byId = new Map(existing.map((item) => [item.id, item]));
  for (const category of wanted) {
    if (category.id && !byId.has(category.id)) throw invalid('Catégorie de billet inconnue pour cet événement.');
    const current = category.id ? byId.get(category.id) : null;
    if (current && category.capacity < current.sold) {
      throw conflict(`« ${category.name} » a déjà ${current.sold} billets vendus : sa jauge ne peut pas descendre en dessous.`);
    }
  }
  const kept = new Set(wanted.map((item) => item.id).filter(Boolean));
  const removed = existing.filter((item) => !kept.has(item.id));
  const withSales = removed.find((item) => item.sold > 0);
  if (withSales) throw conflict(`« ${withSales.name} » a déjà des billets vendus : elle ne peut pas être supprimée.`);
  // Passage du tarif unique a des categories : la premiere categorie reprend
  // les billets deja vendus au tarif unique.
  const inheritedSold = !existing.length && wanted.length ? sold : 0;
  if (inheritedSold && wanted[0].capacity < inheritedSold) {
    throw conflict(`${sold} billets sont déjà vendus au tarif unique : « ${wanted[0].name} » doit compter au moins ${sold} places.`);
  }
  if (!wanted.length && fields.capacity < sold) {
    throw conflict(`${sold} billets sont déjà vendus : la capacité ne peut pas descendre en dessous.`);
  }

  const availableBefore = await availableSeats(eventId);

  // Ecritures
  const { price_xof: price, capacity, ...content } = fields;
  await updateEventColumns(eventId, { ...content, date: content.starts_at, image: content.cover_url });
  for (const category of removed) {
    const result = await db.execute({ sql: 'delete from ticket_categories where id = ? and sold = 0', args: [category.id] });
    if (!result.rowsAffected) throw conflict(`« ${category.name} » vient d'enregistrer une vente : recharge la page.`);
  }
  for (const [index, category] of wanted.entries()) {
    if (category.id) {
      const result = await db.execute({
        sql: 'update ticket_categories set name = ?, price_xof = ?, capacity = ?, position = ? where id = ? and event_id = ? and sold <= ?',
        args: [category.name, category.price_xof, category.capacity, category.position, category.id, eventId, category.capacity]
      });
      if (!result.rowsAffected) throw conflict(`« ${category.name} » vient d'enregistrer des ventes : recharge la page.`);
    } else {
      await db.execute(categoryInsert(eventId, category, index === 0 ? inheritedSold : 0));
    }
  }
  if (wanted.length) {
    const totals = categoryTotals(wanted);
    await updateEventColumns(eventId, { capacity: totals.capacity, ticketsCapacity: totals.capacity, price_xof: totals.price_xof, price: totals.price_xof });
  } else {
    const updated = await updateEventColumns(eventId, { capacity, ticketsCapacity: capacity, price_xof: price, price }, ' and coalesce(tickets_sold, 0) <= ?', [capacity]);
    if (!updated) throw conflict('Des billets viennent d\'être vendus : recharge la page.');
  }

  const availableAfter = await availableSeats(eventId);
  if ([...availableAfter].some(([key, seats]) => seats > (availableBefore.get(key) ?? 0))) {
    await seatsFreed(eventId);
  }
  await notifyScheduleChange(event, fields);
  return sendJson(res, 200, { id: eventId, event: { ...(await findEvent(eventId)), categories: await loadCategories(eventId) } });
});

// Places disponibles par categorie ('' = evenement sans categorie).
export async function availableSeats(eventId) {
  const seats = new Map();
  const categories = await loadCategories(eventId);
  if (categories.length) {
    for (const category of categories) seats.set(category.id, Math.max(0, category.capacity - category.sold));
  } else {
    const row = (await db.execute({ sql: 'select capacity, tickets_sold from events where id = ?', args: [eventId] })).rows[0];
    if (row) seats.set('', Math.max(0, Number(row.capacity || 0) - Number(row.tickets_sold || 0)));
  }
  return seats;
}

// Date ou lieu modifies : les detenteurs de billets sont prevenus.
async function notifyScheduleChange(before, after) {
  const dateChanged = before.starts_at !== after.starts_at;
  const placeChanged = before.location !== after.location || before.city !== after.city;
  if (before.status !== 'approved' || (!dateChanged && !placeChanged)) return;
  const holders = await db.execute({
    sql: "select distinct user_id from tickets where event_id = ? and status = 'paid' limit 5000",
    args: [before.id]
  });
  const changes = [
    dateChanged ? `Nouvel horaire : ${formatEventDate(after.starts_at)}.` : '',
    placeChanged ? `Nouveau lieu : ${[after.location, after.city].filter(Boolean).join(', ')}.` : ''
  ].filter(Boolean).join(' ');
  for (const row of holders.rows) {
    await notify(row.user_id, {
      type: 'event_changed',
      title: `Changement pour « ${after.title} »`,
      body: `${changes} Ton billet reste valable.`,
      link: `/evenement.html?id=${encodeURIComponent(before.id)}`
    });
  }
}

route('PATCH', /^\/api\/events\/([^/]+)\/status$/, async ({ req, res, params }) => {
  await requireUser(req, ['admin']);
  const eventId = pathId(params[0]);
  if (!eventId) return notFound(res);
  const body = await parseBody(req);
  const status = v.oneOf(body.status, EVENT_STATUSES, { label: 'Statut' });
  const found = await db.execute({ sql: 'select id, title, status, organizer_id from events where id = ?', args: [eventId] });
  const event = found.rows[0];
  if (!event) return notFound(res);
  await db.execute({ sql: 'update events set status = ? where id = ?', args: [status, eventId] });
  if (event.status !== status && status !== 'pending') {
    const approved = status === 'approved';
    await notify(event.organizer_id, {
      type: 'event_status',
      title: approved ? `« ${event.title} » est en ligne` : `« ${event.title} » n'a pas été validé`,
      body: approved
        ? 'Ton événement est visible dans le catalogue et la billetterie est ouverte.'
        : 'L\'équipe FestiConnect ne l\'a pas publié. Vérifie le titre, la date, le lieu et la description, puis écris au support si besoin.',
      link: approved ? `/evenement.html?id=${encodeURIComponent(event.id)}` : '/organisateur.html#analytics'
    });
  }
  return sendJson(res, 200, { ok: true });
});

// ---------------------------------------------------------------------------
// Achat de billets
// ---------------------------------------------------------------------------

const eventStarted = () => new AppError(409, 'EVENT_STARTED', 'Cet événement a déjà commencé : la billetterie est fermée.');

async function hasStarted(eventId) {
  const fresh = await db.execute({ sql: `select ${NOT_STARTED_SQL} as open from events where id = ?`, args: [eventId] });
  return !Number(fresh.rows[0]?.open);
}

// Hooks optionnels branches par d'autres modules (codes promo...).
const pricingHooks = [];
export function addPricingHook(hook) {
  pricingHooks.push(hook);
}

route('POST', '/api/tickets', async ({ req, res }) => {
  const user = await requireUser(req, ['client', 'admin']);
  enforce(limiters.purchaseUser, user.id);
  const body = await parseBody(req);
  const eventId = v.id(body.event_id, { label: 'Événement' });
  const quantity = v.integer(body.quantity, { label: 'Quantité', min: 1, max: MAX_TICKETS_PER_PURCHASE, fallback: 1 });
  const paymentMethod = v.oneOf(body.payment_method, PAYMENT_METHODS, { label: 'Moyen de paiement', fallback: 'Wave' });
  const categoryId = body.category_id === undefined || body.category_id === null || body.category_id === ''
    ? ''
    : v.id(body.category_id, { label: 'Catégorie de billet' });

  const found = await db.execute({ sql: 'select * from events where id = ? and status = ?', args: [eventId, 'approved'] });
  const row = found.rows[0];
  if (!row) throw new AppError(404, 'EVENT_NOT_FOUND', 'Événement introuvable.');
  if (!(eventTimeMs(row.starts_at) > Date.now())) throw eventStarted();

  // Prix toujours calcule cote serveur a partir de la base.
  const categories = await loadCategories(row.id);
  let category = null;
  if (categories.length) {
    if (!categoryId) throw invalid('Choisis une catégorie de billet.');
    category = categories.find((item) => item.id === categoryId);
    if (!category) throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Cette catégorie de billet n\'existe pas pour cet événement.');
  } else if (categoryId) {
    throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Cette catégorie de billet n\'existe pas pour cet événement.');
  }
  const unitPrice = Number(category ? category.price_xof : (row.price_xof ?? row.price ?? 0));
  if (!Number.isSafeInteger(unitPrice) || unitPrice < 0) throw new Error(`Prix invalide pour l'evenement ${row.id}`);
  // Un hook peut ajouter une remise et des effets atomiques ({ commit, rollback })
  // executes apres la reservation des places, et des colonnes du billet.
  const pricing = { event: row, category, quantity, user, body, subtotal: quantity * unitPrice, discount: 0, effects: [], record: {} };
  for (const hook of pricingHooks) await hook.prepare(pricing);
  const amount = Math.max(0, pricing.subtotal - pricing.discount);

  // Reservation atomique : categorie, puis evenement, puis effets des hooks.
  const undo = [];
  const rollback = async () => {
    for (const step of undo.reverse()) await safely('compensation achat', step);
  };
  if (category) {
    if (!(await reserveCategorySeats(category.id, row.id, quantity))) {
      if (await hasStarted(row.id)) throw eventStarted();
      throw new AppError(409, 'SOLD_OUT', `Plus assez de places en « ${category.name} ».`);
    }
    undo.push(() => releaseCategorySeats(category.id, quantity));
  }
  if (!(await reserveEventSeats(row.id, quantity))) {
    await rollback();
    if (await hasStarted(row.id)) throw eventStarted();
    throw new AppError(409, 'SOLD_OUT', 'Plus assez de places disponibles pour cet événement.');
  }
  undo.push(() => releaseEventSeats(row.id, quantity));
  try {
    for (const effect of pricing.effects) {
      await effect.commit();
      undo.push(effect.rollback);
    }
    const id = randomId('tkt');
    const code = `FC-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    const now = new Date().toISOString();
    await insertByExistingColumns(db, 'tickets', {
      id,
      event_id: row.id,
      eventId: row.id,
      eventTitle: row.title,
      eventDate: row.starts_at || row.date,
      eventLocation: row.location,
      eventImage: row.cover_url || row.image,
      user_id: user.id,
      userId: user.id,
      code,
      qrcode: code,
      quantity,
      amount_xof: amount,
      price: amount,
      category_id: category?.id || '',
      category_name: category?.name || '',
      ...pricing.record,
      status: 'paid',
      payment_method: paymentMethod,
      created_at: now,
      createdAt: now
    });
    return sendJson(res, 201, { id, amount_xof: amount, subtotal_xof: pricing.subtotal, discount_xof: pricing.discount, category_name: category?.name || '' });
  } catch (error) {
    await rollback();
    throw error;
  }
});
