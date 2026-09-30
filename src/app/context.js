// Outils partages par les routes : base, utilisateur courant, limiteurs, ids.
import crypto from 'node:crypto';
import { getDb } from '../db/client.js';
import { AppError } from '../shared/errors.js';
import { RateLimiter } from '../shared/rateLimit.js';
import { findSessionUser } from '../shared/sessions.js';

export const db = getDb();

const MINUTE = 60 * 1000;
export const limiters = {
  api: new RateLimiter({ windowMs: MINUTE, max: 300 }),
  loginIp: new RateLimiter({ windowMs: 15 * MINUTE, max: 30 }),
  loginAccountIp: new RateLimiter({ windowMs: 15 * MINUTE, max: 5 }),
  loginAccount: new RateLimiter({ windowMs: 15 * MINUTE, max: 20 }),
  registerIp: new RateLimiter({ windowMs: 60 * MINUTE, max: 10 }),
  purchaseUser: new RateLimiter({ windowMs: 10 * MINUTE, max: 30 }),
  eventCreateUser: new RateLimiter({ windowMs: 60 * MINUTE, max: 20 }),
  logoutAllUser: new RateLimiter({ windowMs: 15 * MINUTE, max: 10 })
};

export function randomId(prefix) {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 18)}`;
}

export function currentUser(req) {
  return findSessionUser(db, req);
}

export async function requireUser(req, roles = []) {
  const user = await findSessionUser(db, req);
  if (!user) throw new AppError(401, 'AUTH_REQUIRED', 'Connexion requise.');
  if (roles.length && !roles.includes(user.role)) {
    throw new AppError(403, 'FORBIDDEN', 'Accès refusé pour ce rôle.');
  }
  return user;
}

// Journalise sans interrompre : compensations et effets secondaires
// (notifications) ne doivent jamais faire echouer la requete principale.
export async function safely(label, action) {
  try {
    return await action();
  } catch (error) {
    console.error(`[compensation] ${label}`, error);
    return undefined;
  }
}

// Les dates sont saisies en heure d'Abidjan (Africa/Abidjan = UTC, sans heure
// d'ete) au format AAAA-MM-JJTHH:MM, sans fuseau : on les lit donc en UTC.
export function eventTimeMs(value) {
  const text = String(value || '').trim();
  if (!text) return Number.NaN;
  if (/(?:Z|[+-]\d{2}:\d{2})$/.test(text)) return Date.parse(text);
  return Date.parse(`${text}${text.length === 16 ? ':00' : ''}Z`);
}

// Condition SQL "l'evenement n'a pas encore commence" (datetime() lit en UTC).
export const NOT_STARTED_SQL = "datetime(events.starts_at) > datetime('now')";
