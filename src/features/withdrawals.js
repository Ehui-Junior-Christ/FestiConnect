// Retraits Mobile Money des organisateurs (Wave, Orange Money, Moov Money).
// Solde disponible = revenus des billets payes
//                  - commission de la plateforme (PLATFORM_COMMISSION_PERCENT, 0 par defaut)
//                  - retraits en attente ou valides.
// La demande est inseree par un INSERT ... SELECT conditionnel : deux
// demandes simultanees ne peuvent pas depasser le solde.
import { config } from '../config/env.js';
import { db, randomId, requireUser } from '../app/context.js';
import { pathId, route } from '../app/router.js';
import { AppError, notFound } from '../shared/errors.js';
import { parseBody, sendJson } from '../shared/http.js';
import { RateLimiter, enforce } from '../shared/rateLimit.js';
import * as v from '../shared/validation.js';
import { PAYMENT_METHODS } from './events.js';
import { notify } from './notifications.js';

export const MIN_WITHDRAWAL = 1000;
export const MAX_WITHDRAWAL = 10_000_000;
const WITHDRAWAL_STATUSES = ['pending', 'approved', 'rejected'];
const withdrawalLimiter = new RateLimiter({ windowMs: 60 * 60 * 1000, max: 10 });

const REVENUE_SQL = `select coalesce(sum(tickets.amount_xof), 0) as total
  from tickets join events on events.id = tickets.event_id
  where events.organizer_id = ? and tickets.status = 'paid'`;
const RESERVED_SQL = `select coalesce(sum(amount_xof), 0) as total
  from withdrawals where organizer_id = ? and status in ('pending', 'approved')`;

// Commission arrondie a l'unite (points de base, calcul entier).
export function commissionFor(revenue, bps = config.commissionBps) {
  return Math.floor((revenue * bps + 5000) / 10000);
}

function formatFcfa(amount) {
  return `${new Intl.NumberFormat('fr-FR').format(amount).replace(/\s/g, ' ')} FCFA`;
}

export async function walletFor(organizerId) {
  const revenue = Number((await db.execute({ sql: REVENUE_SQL, args: [organizerId] })).rows[0].total);
  const sums = await db.execute({
    sql: `select coalesce(sum(case when status = 'pending' then amount_xof end), 0) as pending,
                 coalesce(sum(case when status = 'approved' then amount_xof end), 0) as paid_out
          from withdrawals where organizer_id = ?`,
    args: [organizerId]
  });
  const pending = Number(sums.rows[0].pending);
  const paidOut = Number(sums.rows[0].paid_out);
  const commission = commissionFor(revenue);
  return {
    revenue,
    commission,
    commission_percent: config.commissionBps / 100,
    pending,
    paid_out: paidOut,
    available: Math.max(0, revenue - commission - pending - paidOut)
  };
}

function publicWithdrawal(row) {
  return {
    id: row.id,
    amount_xof: Number(row.amount_xof),
    method: row.method,
    phone: row.phone,
    status: row.status,
    admin_note: row.admin_note || '',
    created_at: row.created_at,
    processed_at: row.processed_at || '',
    organizer_name: row.organizer_name,
    organizer_email: row.organizer_email
  };
}

route('GET', '/api/organizer/wallet', async ({ req, res }) => {
  const user = await requireUser(req, ['organisateur', 'admin']);
  const history = await db.execute({
    sql: 'select * from withdrawals where organizer_id = ? order by created_at desc limit 100',
    args: [user.id]
  });
  return sendJson(res, 200, { balance: await walletFor(user.id), withdrawals: history.rows.map(publicWithdrawal), min_xof: MIN_WITHDRAWAL });
});

route('POST', '/api/organizer/withdrawals', async ({ req, res }) => {
  const user = await requireUser(req, ['organisateur']);
  enforce(withdrawalLimiter, user.id);
  const body = await parseBody(req);
  const amount = v.integer(body.amount_xof, { label: 'Montant', min: MIN_WITHDRAWAL, max: MAX_WITHDRAWAL });
  const method = v.oneOf(body.method, PAYMENT_METHODS, { label: 'Moyen de retrait' });
  const phone = v.ivorianMobile(body.phone);
  const id = randomId('wdr');
  const inserted = await db.execute({
    sql: `with revenue as (${REVENUE_SQL}), reserved as (${RESERVED_SQL})
          insert into withdrawals (id, organizer_id, amount_xof, status, method, phone, created_at)
          select ?, ?, ?, 'pending', ?, ?, ? from revenue, reserved
          where revenue.total - (revenue.total * cast(? as integer) + 5000) / 10000 - reserved.total >= ?`,
    args: [user.id, user.id, id, user.id, amount, method, phone, new Date().toISOString(), config.commissionBps, amount]
  });
  if (!inserted.rowsAffected) {
    const { available } = await walletFor(user.id);
    throw new AppError(409, 'INSUFFICIENT_BALANCE', `Solde insuffisant : ${formatFcfa(available)} disponibles pour un retrait.`);
  }
  return sendJson(res, 201, { id, status: 'pending', balance: await walletFor(user.id) });
});

// ---------------------------------------------------------------------------
// Administration
// ---------------------------------------------------------------------------

route('GET', '/api/admin/withdrawals', async ({ req, res, url }) => {
  await requireUser(req, ['admin']);
  const status = v.oneOf(url.searchParams.get('status'), WITHDRAWAL_STATUSES, { label: 'Statut', fallback: '' });
  const result = await db.execute({
    sql: `select withdrawals.*, users.name as organizer_name, users.email as organizer_email
          from withdrawals join users on users.id = withdrawals.organizer_id
          where (? = '' or withdrawals.status = ?)
          order by withdrawals.status = 'pending' desc, withdrawals.created_at desc limit 300`,
    args: [status, status]
  });
  return sendJson(res, 200, { withdrawals: result.rows.map(publicWithdrawal) });
});

route('PATCH', /^\/api\/admin\/withdrawals\/([^/]+)$/, async ({ req, res, params }) => {
  const admin = await requireUser(req, ['admin']);
  const withdrawalId = pathId(params[0]);
  if (!withdrawalId) return notFound(res);
  const body = await parseBody(req);
  const status = v.oneOf(body.status, ['approved', 'rejected'], { label: 'Décision' });
  const note = v.text(body.note, { label: 'Motif', max: 300, multiline: true });
  if (status === 'rejected' && note.length < 5) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Indique le motif du refus (5 caractères au moins) : l\'organisateur le recevra.');
  }
  const found = await db.execute({ sql: 'select * from withdrawals where id = ?', args: [withdrawalId] });
  const withdrawal = found.rows[0];
  if (!withdrawal) return notFound(res);
  // Transition atomique : une demande n'est traitee qu'une fois.
  const updated = await db.execute({
    sql: "update withdrawals set status = ?, admin_note = ?, processed_at = ?, processed_by = ? where id = ? and status = 'pending'",
    args: [status, note, new Date().toISOString(), admin.id, withdrawalId]
  });
  if (!updated.rowsAffected) throw new AppError(409, 'ALREADY_PROCESSED', 'Cette demande de retrait a déjà été traitée.');
  const amount = formatFcfa(Number(withdrawal.amount_xof));
  await notify(withdrawal.organizer_id, {
    type: 'withdrawal',
    title: status === 'approved' ? `Retrait de ${amount} envoyé` : `Retrait de ${amount} refusé`,
    body: status === 'approved'
      ? `Le transfert ${withdrawal.method} vers le ${withdrawal.phone} a été effectué.${note ? ` ${note}` : ''}`
      : `Motif : ${note} Le montant est de nouveau disponible dans ton solde.`,
    link: '/organisateur.html#revenus'
  });
  return sendJson(res, 200, { ok: true, status });
});
