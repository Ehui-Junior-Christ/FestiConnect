// Controle d'entree : le QR code du billet contient son code (FC-...). Le
// check-in marque le billet utilise de facon atomique (UPDATE conditionnel) :
// un billet ne passe qu'une fois, seulement pour les evenements de
// l'organisateur connecte (un admin peut controler tous les evenements).
import { db, requireUser } from '../app/context.js';
import { route } from '../app/router.js';
import { AppError } from '../shared/errors.js';
import { parseBody, sendJson } from '../shared/http.js';
import { RateLimiter, enforce } from '../shared/rateLimit.js';

const TICKET_CODE = /^FC-[A-Z0-9-]{4,40}$/;
export const checkinLimiter = new RateLimiter({ windowMs: 60 * 1000, max: 120 });

const TIME_FR = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Abidjan' });

function formatCheckedAt(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return TIME_FR.format(date).replace(/(\d{2}):(\d{2})$/, '$1h$2');
}

export function normalizeTicketCode(value) {
  if (typeof value !== 'string') throw new AppError(422, 'VALIDATION_ERROR', 'Code du billet invalide.');
  // Tolere les espaces et les minuscules d'une saisie manuelle.
  const code = value.trim().toUpperCase().replace(/\s+/g, '');
  if (!TICKET_CODE.test(code)) throw new AppError(422, 'VALIDATION_ERROR', 'Code du billet invalide : il commence par FC-.');
  return code;
}

async function ticketDetails(code) {
  const result = await db.execute({
    sql: `select tickets.id, tickets.code, tickets.quantity, tickets.status, tickets.checked_in_at, tickets.category_name,
                 events.id as event_id, events.title as event_title, events.organizer_id, users.name as client_name
          from tickets
          join events on events.id = tickets.event_id
          join users on users.id = tickets.user_id
          where tickets.code = ?`,
    args: [code]
  });
  return result.rows[0] || null;
}

function publicTicket(row) {
  return {
    code: row.code,
    client_name: row.client_name,
    event_id: row.event_id,
    event_title: row.event_title,
    quantity: Number(row.quantity || 1),
    category_name: row.category_name || '',
    checked_in_at: row.checked_in_at || ''
  };
}

route('POST', '/api/organizer/checkin', async ({ req, res }) => {
  const user = await requireUser(req, ['organisateur', 'admin']);
  enforce(checkinLimiter, user.id);
  const body = await parseBody(req);
  const code = normalizeTicketCode(body.code);
  const now = new Date().toISOString();
  const marked = await db.execute({
    sql: `update tickets set checked_in_at = ?, checked_in_by = ?
          where code = ? and status = 'paid' and coalesce(checked_in_at, '') = ''
            and (? = 'admin' or event_id in (select id from events where organizer_id = ?))`,
    args: [now, user.id, code, user.role, user.id]
  });
  const ticket = await ticketDetails(code);
  if (marked.rowsAffected === 1) {
    return sendJson(res, 200, { ok: true, ticket: publicTicket(ticket) });
  }
  // Refus : on n'indique jamais qu'un code existe sur l'evenement d'un autre organisateur.
  if (!ticket || (user.role !== 'admin' && ticket.organizer_id !== user.id)) {
    throw new AppError(404, 'TICKET_NOT_FOUND', 'Aucun billet avec ce code sur tes événements.');
  }
  if (ticket.status !== 'paid') {
    throw new AppError(409, 'TICKET_CANCELLED', `Billet annulé : ${ticket.client_name}, ${ticket.event_title}. Refuse l'entrée.`);
  }
  throw new AppError(409, 'ALREADY_CHECKED_IN', `Scanné le ${formatCheckedAt(ticket.checked_in_at)} : ${ticket.client_name}, ${ticket.event_title}. Refuse l'entrée.`);
});

// Compteurs d'entrees par evenement (a venir ou en cours) pour l'ecran de controle.
route('GET', '/api/organizer/checkin/summary', async ({ req, res }) => {
  const user = await requireUser(req, ['organisateur', 'admin']);
  const result = await db.execute({
    sql: `select events.id, events.title, events.starts_at, events.ends_at,
                 coalesce(sum(case when tickets.status = 'paid' then tickets.quantity else 0 end), 0) as sold,
                 coalesce(sum(case when tickets.status = 'paid' and coalesce(tickets.checked_in_at, '') <> '' then tickets.quantity else 0 end), 0) as checked_in
          from events left join tickets on tickets.event_id = events.id
          where events.organizer_id = ? and events.status = 'approved'
            and datetime(coalesce(nullif(events.ends_at, ''), events.starts_at), '+12 hours') > datetime('now')
          group by events.id
          order by datetime(events.starts_at) asc
          limit 50`,
    args: [user.id]
  });
  return sendJson(res, 200, {
    events: result.rows.map((row) => ({ ...row, sold: Number(row.sold), checked_in: Number(row.checked_in) }))
  });
});
