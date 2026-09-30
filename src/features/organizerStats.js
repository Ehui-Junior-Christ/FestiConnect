// Tableau de bord organisateur : ventes par jour, remplissage par categorie,
// export CSV des participants, duplication d'un evenement.
import { db, eventTimeMs, limiters, randomId, requireUser } from '../app/context.js';
import { pathId, route } from '../app/router.js';
import { insertByExistingColumns } from '../db/schema.js';
import { AppError, notFound } from '../shared/errors.js';
import { sendJson } from '../shared/http.js';
import { enforce } from '../shared/rateLimit.js';
import * as v from '../shared/validation.js';
import { findOwnedEvent, loadCategories } from './events.js';

const PERIODS = ['7', '30', '90'];
const DAY_MS = 24 * 60 * 60 * 1000;

route('GET', '/api/organizer/stats', async ({ req, res, url }) => {
  const user = await requireUser(req, ['organisateur', 'admin']);
  const days = Number(v.oneOf(url.searchParams.get('days'), PERIODS, { label: 'Période', fallback: '30' }));
  const requested = url.searchParams.get('event_id') || '';
  let eventId = '';
  if (requested) {
    eventId = v.id(requested, { label: 'Événement' });
    if (!(await findOwnedEvent(eventId, user))) return notFound(res);
  }
  // Jours calendaires d'Abidjan (= UTC) : les dates ISO du billet suffisent.
  const since = new Date(Date.now() - (days - 1) * DAY_MS).toISOString().slice(0, 10);
  const sales = await db.execute({
    sql: `select substr(tickets.created_at, 1, 10) as day,
                 coalesce(sum(tickets.quantity), 0) as tickets,
                 coalesce(sum(tickets.amount_xof), 0) as revenue
          from tickets join events on events.id = tickets.event_id
          where events.organizer_id = ? and tickets.status = 'paid'
            and (? = '' or events.id = ?)
            and substr(tickets.created_at, 1, 10) >= ?
          group by day`,
    args: [user.id, eventId, eventId, since]
  });
  const byDay = new Map(sales.rows.map((row) => [row.day, row]));
  const series = Array.from({ length: days }, (_, index) => {
    const day = new Date(Date.parse(`${since}T00:00:00Z`) + index * DAY_MS).toISOString().slice(0, 10);
    const row = byDay.get(day);
    return { day, tickets: Number(row?.tickets || 0), revenue: Number(row?.revenue || 0) };
  });

  // Remplissage : par categorie (ou tarif unique) des evenements a venir ou choisis.
  const events = await db.execute({
    sql: `select id, title, starts_at, capacity, tickets_sold from events
          where organizer_id = ? and status <> 'rejected'
            and (? <> '' and id = ? or ? = '' and datetime(coalesce(nullif(ends_at, ''), starts_at)) > datetime('now'))
          order by datetime(starts_at) asc limit 20`,
    args: [user.id, eventId, eventId, eventId]
  });
  const fill = [];
  for (const event of events.rows) {
    const categories = await loadCategories(event.id);
    fill.push({
      event_id: event.id,
      event_title: event.title,
      starts_at: event.starts_at,
      categories: categories.length
        ? categories.map((category) => ({ name: category.name, capacity: category.capacity, sold: category.sold }))
        : [{ name: 'Tarif unique', capacity: Number(event.capacity || 0), sold: Number(event.tickets_sold || 0) }]
    });
  }
  return sendJson(res, 200, {
    days,
    sales: series,
    totals: { tickets: series.reduce((sum, item) => sum + item.tickets, 0), revenue: series.reduce((sum, item) => sum + item.revenue, 0) },
    fill
  });
});

// ---------------------------------------------------------------------------
// Export CSV des participants
// ---------------------------------------------------------------------------

// Cellule CSV : entre guillemets, guillemets doubles, et neutralisation des
// formules (=, +, -, @, tabulation, retour chariot) par une apostrophe.
export function csvCell(value) {
  let text = String(value ?? '').replace(/\r\n?/g, '\n');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(rows) {
  // BOM : Excel ouvre ainsi correctement les accents ; « ; » = separateur attendu par Excel en francais.
  return `﻿${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}\r\n`;
}

function slug(value) {
  return String(value || 'evenement').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'evenement';
}

const STATUS_LABELS = { paid: 'Payé', cancelled: 'Annulé' };

route('GET', /^\/api\/organizer\/events\/([^/]+)\/attendees\.csv$/, async ({ req, res, params }) => {
  const user = await requireUser(req, ['organisateur', 'admin']);
  const eventId = pathId(params[0]);
  if (!eventId) return notFound(res);
  const event = await findOwnedEvent(eventId, user);
  if (!event) return notFound(res);
  const result = await db.execute({
    sql: `select tickets.code, users.name, users.email, users.phone, tickets.category_name, tickets.quantity,
                 tickets.amount_xof, tickets.promo_code, tickets.payment_method, tickets.status,
                 tickets.created_at, tickets.checked_in_at
          from tickets join users on users.id = tickets.user_id
          where tickets.event_id = ?
          order by users.name collate nocase, tickets.created_at`,
    args: [eventId]
  });
  const rows = [
    ['Code billet', 'Nom', 'Email', 'Téléphone', 'Catégorie', 'Places', 'Montant (FCFA)', 'Code promo', 'Paiement', 'Statut', 'Acheté le (UTC)', 'Entrée scannée le (UTC)'],
    ...result.rows.map((row) => [
      row.code, row.name, row.email, row.phone, row.category_name || 'Tarif unique', row.quantity, row.amount_xof,
      row.promo_code, row.payment_method, STATUS_LABELS[row.status] || row.status,
      String(row.created_at || '').slice(0, 16).replace('T', ' '), String(row.checked_in_at || '').slice(0, 16).replace('T', ' ')
    ])
  ];
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="participants-${slug(event.title)}.csv"`
  });
  res.end(toCsv(rows));
});

// ---------------------------------------------------------------------------
// Duplication
// ---------------------------------------------------------------------------

// Copie un evenement (et ses categories, ventes remises a zero). Une date
// passee est decalee de semaines entieres pour tomber dans le futur (meme jour
// de la semaine, meme heure). La copie repasse en validation.
route('POST', /^\/api\/organizer\/events\/([^/]+)\/duplicate$/, async ({ req, res, params }) => {
  const user = await requireUser(req, ['organisateur', 'admin']);
  enforce(limiters.eventCreateUser, user.id);
  const eventId = pathId(params[0]);
  if (!eventId) return notFound(res);
  const source = await findOwnedEvent(eventId, user);
  if (!source) return notFound(res);
  const start = eventTimeMs(source.starts_at);
  if (Number.isNaN(start)) throw new AppError(422, 'VALIDATION_ERROR', 'Date de l\'événement d\'origine illisible.');
  const end = eventTimeMs(source.ends_at);
  const weeks = start > Date.now() ? 0 : Math.ceil((Date.now() - start) / (7 * DAY_MS)) || 1;
  const shift = weeks * 7 * DAY_MS;
  const iso = (ms) => new Date(ms).toISOString().slice(0, 16);
  const startsAt = iso(start + shift);
  const endsAt = Number.isNaN(end) ? startsAt : iso(end + shift);
  const title = `${String(source.title).slice(0, 110)} (copie)`;
  const id = randomId('evt');
  const now = new Date().toISOString();
  await insertByExistingColumns(db, 'events', {
    id,
    organizer_id: source.organizer_id,
    organizerId: source.organizer_id,
    title,
    category: source.category,
    city: source.city,
    location: source.location,
    starts_at: startsAt,
    ends_at: endsAt,
    date: startsAt,
    price_xof: source.price_xof,
    price: source.price_xof,
    capacity: source.capacity,
    ticketsCapacity: source.capacity,
    tickets_sold: 0,
    ticketsSold: 0,
    status: 'pending',
    cover_url: source.cover_url,
    image: source.cover_url,
    description: source.description,
    created_at: now
  });
  const categories = await loadCategories(eventId);
  if (categories.length) {
    await db.batch(categories.map((category) => ({
      sql: `insert into ticket_categories (id, event_id, name, price_xof, capacity, sold, position, created_at)
            values (?, ?, ?, ?, ?, 0, ?, ?)`,
      args: [randomId('cat'), id, category.name, category.price_xof, category.capacity, category.position, now]
    })), 'write');
  }
  return sendJson(res, 201, { id, title, starts_at: startsAt });
});
