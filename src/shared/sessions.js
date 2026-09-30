import crypto from 'node:crypto';
import { config } from '../config/env.js';
import { parseCookies } from './http.js';

export const SESSION_COOKIE = 'fc_session';
export const SESSION_TTL_SECONDS = 14 * 24 * 60 * 60;
export const MAX_SESSIONS_PER_USER = 10;
const TOKEN_FORMAT = /^[a-f0-9]{64}$/;

export function newSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Seul un HMAC (cle APP_SECRET) du jeton est stocke : une fuite de la table
// sessions ne permet pas de se connecter, et une ecriture en base ne permet pas
// de fabriquer une session valide sans connaitre APP_SECRET.
export function hashSessionToken(token) {
  return crypto.createHmac('sha256', config.appSecret).update(token).digest('hex');
}

function sessionId() {
  return `ses_${crypto.randomUUID().replaceAll('-', '').slice(0, 24)}`;
}

// Jetons presentes par la requete (Bearer puis cookie), au format valide uniquement.
export function requestTokens(req) {
  const tokens = [];
  const auth = String(req.headers.authorization || '');
  const match = /^Bearer\s+(\S+)$/i.exec(auth);
  if (match && TOKEN_FORMAT.test(match[1])) tokens.push({ token: match[1], source: 'bearer' });
  const cookie = parseCookies(req)[SESSION_COOKIE];
  if (cookie && TOKEN_FORMAT.test(cookie) && cookie !== tokens[0]?.token) tokens.push({ token: cookie, source: 'cookie' });
  return tokens;
}

export function hasCookieSession(req) {
  return Boolean(parseCookies(req)[SESSION_COOKIE]);
}

export function hasBearer(req) {
  return /^Bearer\s+\S+$/i.test(String(req.headers.authorization || ''));
}

export async function findSessionUser(db, req) {
  for (const { token } of requestTokens(req)) {
    const result = await db.execute({
      sql: `select users.id, users.name, users.email, users.role, users.phone, users.city
            from sessions
            join users on users.id = sessions.user_id
            where sessions.token_hash = ? and sessions.expires_at > datetime('now')`,
      args: [hashSessionToken(token)]
    });
    if (result.rows[0]) return result.rows[0];
  }
  return null;
}

export async function createSession(db, userId) {
  const token = newSessionToken();
  await db.execute({
    sql: `insert into sessions (id, user_id, token_hash, expires_at)
          values (?, ?, ?, datetime('now', '+${SESSION_TTL_SECONDS} seconds'))`,
    args: [sessionId(), userId, hashSessionToken(token)]
  });
  // Nettoyage : sessions expirees de l'utilisateur + plafond de sessions actives.
  await db.execute({
    sql: `delete from sessions where user_id = ? and (
            expires_at <= datetime('now')
            or id not in (select id from sessions where user_id = ? order by rowid desc limit ${MAX_SESSIONS_PER_USER})
          )`,
    args: [userId, userId]
  });
  return token;
}

export async function revokeRequestSessions(db, req) {
  const hashes = requestTokens(req).map(({ token }) => hashSessionToken(token));
  for (const hash of hashes) {
    await db.execute({ sql: 'delete from sessions where token_hash = ?', args: [hash] });
  }
}

export async function revokeAllSessions(db, userId) {
  await db.execute({ sql: 'delete from sessions where user_id = ?', args: [userId] });
}

export async function purgeExpiredSessions(db) {
  await db.execute(`delete from sessions where expires_at <= datetime('now')`);
}

export function sessionCookie(token, { secure }) {
  return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_SECONDS}${secure ? '; Secure' : ''}`;
}

export function clearSessionCookie({ secure }) {
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure ? '; Secure' : ''}`;
}
