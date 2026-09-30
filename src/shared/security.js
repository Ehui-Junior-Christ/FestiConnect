import net from 'node:net';
import { config } from '../config/env.js';
import { AppError } from './errors.js';

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'"
].join('; ');

export const PERMISSIONS_POLICY = [
  'accelerometer=()', 'camera=()', 'geolocation=()', 'gyroscope=()', 'magnetometer=()',
  'microphone=()', 'payment=()', 'usb=()', 'browsing-topics=()'
].join(', ');

export function applySecurityHeaders(res, { api = false } = {}) {
  res.removeHeader('X-Powered-By');
  res.setHeader(config.cspReportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy', CONTENT_SECURITY_POLICY);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  if (config.isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  if (api) {
    res.setHeader('Cache-Control', 'no-store');
  }
}

function normalizeIp(value) {
  let ip = String(value || '').trim();
  if (ip.startsWith('[') && ip.includes(']')) ip = ip.slice(1, ip.indexOf(']'));
  if (ip.toLowerCase().startsWith('::ffff:') && net.isIPv4(ip.slice(7))) ip = ip.slice(7);
  return ip;
}

// IP cliente. X-Forwarded-For n'est lu que si TRUST_PROXY >= 1 ; on prend
// alors l'entree ajoutee par le proxy de confiance le plus externe (lecture
// depuis la droite), jamais la premiere entree qui est controlable par le client.
export function getClientIp(req, trustProxy = config.trustProxy) {
  const remote = normalizeIp(req.socket?.remoteAddress) || 'unknown';
  if (!trustProxy) return remote;
  const header = req.headers['x-forwarded-for'];
  const list = (Array.isArray(header) ? header.join(',') : String(header || ''))
    .split(',').map((item) => item.trim()).filter(Boolean);
  if (!list.length) return remote;
  const candidate = normalizeIp(list[Math.max(0, list.length - trustProxy)]);
  return net.isIP(candidate) ? candidate : remote;
}

export function isSecureRequest(req, trustProxy = config.trustProxy) {
  if (req.socket?.encrypted) return true;
  if (!trustProxy) return false;
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',').map((item) => item.trim().toLowerCase());
  return proto[proto.length - 1] === 'https';
}

function originOf(value) {
  try {
    const url = new URL(value);
    return { origin: url.origin, host: url.host.toLowerCase() };
  } catch {
    return null;
  }
}

function isAllowedOrigin(value, req) {
  const parsed = originOf(value);
  if (!parsed) return false;
  if (config.appOrigins.length) return config.appOrigins.includes(parsed.origin);
  const host = String(req.headers.host || '').toLowerCase();
  return Boolean(host) && parsed.host === host;
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Protection CSRF pour les requetes mutantes :
// - Origin (ou a defaut Referer) doit correspondre a l'origine de l'application ;
// - sans Origin ni Referer, une requete authentifiee uniquement par cookie est refusee.
// Les appels "Authorization: Bearer" ne sont pas exposes au CSRF (en-tete non
// forgeable cross-site sans CORS, et aucun CORS n'est accorde).
export function assertSameOrigin(req, { hasCookieSession = false, hasBearer = false } = {}) {
  if (!MUTATING.has(req.method)) return;
  const forbidden = () => new AppError(403, 'CSRF_REJECTED', 'Origine de la requete non autorisee.');
  const origin = req.headers.origin;
  if (origin) {
    if (origin === 'null' || !isAllowedOrigin(origin, req)) throw forbidden();
    return;
  }
  const referer = req.headers.referer;
  if (referer) {
    if (!isAllowedOrigin(referer, req)) throw forbidden();
    return;
  }
  const site = String(req.headers['sec-fetch-site'] || '');
  if (site === 'cross-site' || site === 'same-site') throw forbidden();
  if (hasCookieSession && !hasBearer) throw forbidden();
}
