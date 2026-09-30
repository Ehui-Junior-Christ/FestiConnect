// Codes promo des organisateurs : pourcentage ou montant fixe, nombre
// d'utilisations maximal, date d'expiration. La remise est toujours calculee
// cote serveur, et l'utilisation est consommee de maniere atomique au moment
// de l'achat (UPDATE conditionnel + contrainte CHECK en base).
import { db, eventTimeMs, randomId, requireUser } from '../app/context.js';
import { RateLimiter, enforce } from '../shared/rateLimit.js';
import { pathId, route } from '../app/router.js';
import { AppError, notFound } from '../shared/errors.js';
import { parseBody, sendJson } from '../shared/http.js';
import * as v from '../shared/validation.js';
import { MAX_TICKETS_PER_PURCHASE, addPricingHook, findOwnedEvent, loadCategories } from './events.js';

const PROMO_KINDS = ['percent', 'fixed'];
const CODE_FORMAT = /^[A-Z0-9][A-Z0-9-]{2,19}$/;
const MAX_PROMOS_PER_EVENT = 50;

const MINUTE = 60 * 1000;
export const promoLimiters = {
  checkUser: new RateLimiter({ windowMs: 10 * MINUTE, max: 20 }),
  checkIp: new RateLimiter({ windowMs: 10 * MINUTE, max: 40 }),
  createUser: new RateLimiter({ windowMs: 60 * MINUTE, max: 60 })
};

function invalid(message) {
  return new AppError(422, 'VALIDATION_ERROR', message);
}

export function normalizeCode(value, { required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw invalid('Saisis un code promo.');
    return '';
  }
  if (typeof value !== 'string') throw invalid('Code promo invalide.');
  const code = value.trim().toUpperCase();
  if (!CODE_FORMAT.test(code)) throw invalid('Code promo invalide : 3 à 20 lettres, chiffres ou tirets.');
  return code;
}

export function computeDiscount(promo, subtotal) {
  const value = Number(promo.value);
  if (promo.kind === 'percent') return Math.min(subtotal, Math.floor((subtotal * value) / 100));
  return Math.min(subtotal, value);
}

function promoLabel(promo) {
  return promo.kind === 'percent' ? `-${promo.value} %` : `-${new Intl.NumberFormat('fr-FR').format(promo.value).replace(/\s/g, ' ')} FCFA`;
}

const genericInvalid = () => new AppError(404, 'PROMO_INVALID', 'Ce code promo n\'existe pas pour cet événement.');

// Verifie un code (sans le consommer). Messages distincts pour expire / epuise.
async function findUsablePromo(eventId, code) {
  const found = await db.execute({
    sql: `select *, (expires_at <> '' and datetime(expires_at) <= datetime('now')) as expired
          from promo_codes where event_id = ? and code = ?`,
    args: [eventId, code]
  });
  const promo = found.rows[0];
  if (!promo || !Number(promo.active)) throw genericInvalid();
  if (Number(promo.expired)) throw new AppError(409, 'PROMO_EXPIRED', 'Ce code promo a expiré.');
  if (Number(promo.max_uses) > 0 && Number(promo.used) >= Number(promo.max_uses)) {
    throw new AppError(409, 'PROMO_EXHAUSTED', 'Ce code promo a atteint son nombre maximal d\'utilisations.');
  }
  return promo;
}

// Branchement sur l'achat de billets (voir events.js).
addPricingHook({
  async prepare(pricing) {
    const code = normalizeCode(pricing.body.promo_code, { required: false });
    if (!code) return;
    const promo = await findUsablePromo(pricing.event.id, code);
    pricing.discount = computeDiscount(promo, pricing.subtotal);
    pricing.record = { ...pricing.record, promo_id: promo.id, promo_code: promo.code, discount_xof: pricing.discount };
    pricing.effects.push({
      async commit() {
        const used = await db.execute({
          sql: `update promo_codes set used = used + 1
                where id = ? and active = 1
                  and (max_uses = 0 or used < max_uses)
                  and (expires_at = '' or datetime(expires_at) > datetime('now'))`,
          args: [promo.id]
        });
        if (used.rowsAffected !== 1) {
          throw new AppError(409, 'PROMO_EXHAUSTED', 'Ce code promo vient d\'atteindre son nombre maximal d\'utilisations.');
        }
      },
      async rollback() {
        await db.execute({ sql: 'update promo_codes set used = max(used - 1, 0) where id = ?', args: [promo.id] });
      }
    });
  }
});

// Apercu de la remise (rate limite : evite de deviner des codes).
route('POST', '/api/promos/check', async ({ req, res, ip }) => {
  const user = await requireUser(req, ['client', 'admin']);
  enforce(promoLimiters.checkIp, ip);
  enforce(promoLimiters.checkUser, user.id);
  const body = await parseBody(req);
  const eventId = v.id(body.event_id, { label: 'Événement' });
  const code = normalizeCode(body.code);
  const quantity = v.integer(body.quantity, { label: 'Quantité', min: 1, max: MAX_TICKETS_PER_PURCHASE, fallback: 1 });
  const event = (await db.execute({ sql: "select id, price_xof from events where id = ? and status = 'approved'", args: [eventId] })).rows[0];
  if (!event) throw new AppError(404, 'EVENT_NOT_FOUND', 'Événement introuvable.');
  const categories = await loadCategories(eventId);
  let unitPrice = Number(event.price_xof || 0);
  if (categories.length) {
    const category = categories.find((item) => item.id === body.category_id) || categories[0];
    unitPrice = category.price_xof;
  }
  // Verification : un code refuse n'est pas une erreur HTTP (reponse 200
  // { valid: false }) ; l'achat, lui, renvoie bien une erreur.
  let promo;
  try {
    promo = await findUsablePromo(eventId, code);
  } catch (error) {
    if (!(error instanceof AppError) || !String(error.code).startsWith('PROMO_')) throw error;
    return sendJson(res, 200, { valid: false, error: { code: error.code, message: error.message } });
  }
  const subtotal = unitPrice * quantity;
  const discount = computeDiscount(promo, subtotal);
  return sendJson(res, 200, {
    valid: true,
    promo: { code: promo.code, kind: promo.kind, value: Number(promo.value), label: promoLabel(promo) },
    subtotal_xof: subtotal,
    discount_xof: discount,
    total_xof: subtotal - discount
  });
});

// ---------------------------------------------------------------------------
// Gestion par l'organisateur
// ---------------------------------------------------------------------------

function publicPromo(row) {
  return {
    id: row.id,
    event_id: row.event_id,
    event_title: row.event_title,
    code: row.code,
    kind: row.kind,
    value: Number(row.value),
    label: promoLabel(row),
    max_uses: Number(row.max_uses),
    used: Number(row.used),
    expires_at: row.expires_at,
    expired: Boolean(Number(row.expired)),
    active: Boolean(Number(row.active)),
    created_at: row.created_at
  };
}

route('GET', '/api/organizer/promos', async ({ req, res }) => {
  const user = await requireUser(req, ['organisateur', 'admin']);
  const result = await db.execute({
    sql: `select promo_codes.*, events.title as event_title,
                 (promo_codes.expires_at <> '' and datetime(promo_codes.expires_at) <= datetime('now')) as expired
          from promo_codes join events on events.id = promo_codes.event_id
          where events.organizer_id = ?
          order by promo_codes.created_at desc limit 500`,
    args: [user.id]
  });
  return sendJson(res, 200, { promos: result.rows.map(publicPromo) });
});

route('POST', '/api/organizer/promos', async ({ req, res }) => {
  const user = await requireUser(req, ['organisateur', 'admin']);
  enforce(promoLimiters.createUser, user.id);
  const body = await parseBody(req);
  const eventId = v.id(body.event_id, { label: 'Événement' });
  const event = await findOwnedEvent(eventId, user);
  if (!event) throw new AppError(404, 'EVENT_NOT_FOUND', 'Événement introuvable.');
  const code = normalizeCode(body.code);
  const kind = v.oneOf(body.kind, PROMO_KINDS, { label: 'Type de remise' });
  const value = kind === 'percent'
    ? v.integer(body.value, { label: 'Pourcentage', min: 1, max: 100 })
    : v.integer(body.value, { label: 'Montant de la remise', min: 100, max: 10_000_000 });
  const maxUses = v.integer(body.max_uses, { label: 'Utilisations maximum', min: 0, max: 100_000, fallback: 0 });
  const expiresAt = v.dateTime(body.expires_at, { label: 'Date d\'expiration' });
  if (expiresAt && !(eventTimeMs(expiresAt) > Date.now())) throw invalid('La date d\'expiration doit être dans le futur.');
  const count = await db.execute({ sql: 'select count(*) as n from promo_codes where event_id = ?', args: [eventId] });
  if (Number(count.rows[0].n) >= MAX_PROMOS_PER_EVENT) throw invalid(`${MAX_PROMOS_PER_EVENT} codes promo au maximum par événement.`);
  const id = randomId('prm');
  try {
    await db.execute({
      sql: `insert into promo_codes (id, event_id, organizer_id, code, kind, value, max_uses, used, expires_at, active, created_at)
            values (?, ?, ?, ?, ?, ?, ?, 0, ?, 1, ?)`,
      args: [id, eventId, event.organizer_id, code, kind, value, maxUses, expiresAt, new Date().toISOString()]
    });
  } catch (error) {
    if (String(error?.message || '').includes('UNIQUE')) {
      throw new AppError(409, 'PROMO_EXISTS', `Le code ${code} existe déjà pour cet événement.`);
    }
    throw error;
  }
  return sendJson(res, 201, { id, code });
});

route('PATCH', /^\/api\/organizer\/promos\/([^/]+)$/, async ({ req, res, params }) => {
  const user = await requireUser(req, ['organisateur', 'admin']);
  const promoId = pathId(params[0]);
  if (!promoId) return notFound(res);
  const body = await parseBody(req);
  if (typeof body.active !== 'boolean') throw invalid('Indique si le code est actif (true ou false).');
  const result = await db.execute({
    sql: `update promo_codes set active = ?
          where id = ? and (? = 'admin' or event_id in (select id from events where organizer_id = ?))`,
    args: [body.active ? 1 : 0, promoId, user.role, user.id]
  });
  if (!result.rowsAffected) return notFound(res);
  return sendJson(res, 200, { ok: true, active: body.active });
});
