// Export calendrier (.ics, RFC 5545) d'un evenement.
// Les horaires sont saisis en heure d'Abidjan (Africa/Abidjan = UTC toute
// l'annee) : ils sont ecrits en UTC (suffixe Z), sans VTIMEZONE necessaire.
import { config } from '../config/env.js';
import { eventTimeMs } from '../app/context.js';
import { pathId, route } from '../app/router.js';
import { notFound } from '../shared/errors.js';
import { isSecureRequest } from '../shared/security.js';
import { findVisibleEvent } from './events.js';

const DEFAULT_DURATION_MS = 3 * 60 * 60 * 1000;

// TEXT (RFC 5545 §3.3.11) : \ ; , echappes, retours a la ligne en \n.
export function escapeIcsText(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

// Pliage (§3.1) : lignes de 75 octets au plus, suite precedee d'un espace,
// sans couper un caractere UTF-8 multi-octets.
export function foldIcsLine(line) {
  const parts = [];
  let current = '';
  let bytes = 0;
  for (const char of line) {
    const size = Buffer.byteLength(char, 'utf8');
    const limit = parts.length ? 74 : 75;
    if (bytes + size > limit) {
      parts.push(current);
      current = '';
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

export function icsDate(ms) {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function buildIcs(event, { url = '', now = Date.now() } = {}) {
  const start = eventTimeMs(event.starts_at);
  let end = eventTimeMs(event.ends_at);
  if (Number.isNaN(end) || end <= start) end = start + DEFAULT_DURATION_MS;
  const place = [event.location, event.city].filter(Boolean).filter((value, index, all) => all.indexOf(value) === index).join(', ');
  const description = [event.description, url ? `Billets et infos : ${url}` : ''].filter(Boolean).join('\n\n');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FestiConnect//Billetterie//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id}@festiconnect.ci`,
    `DTSTAMP:${icsDate(now)}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    place ? `LOCATION:${escapeIcsText(place)}` : '',
    description ? `DESCRIPTION:${escapeIcsText(description)}` : '',
    url ? `URL:${url}` : '',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:-P1D',
    `DESCRIPTION:${escapeIcsText(`Demain : ${event.title}`)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(Boolean);
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}

// Origine publique : APP_ORIGIN si configuree, sinon l'hote de la requete
// s'il a une forme valide (pas de lien sinon).
function publicOrigin(req) {
  if (config.appOrigins.length) return config.appOrigins[0];
  const host = String(req.headers.host || '');
  if (!/^[A-Za-z0-9.-]{1,253}(?::\d{2,5})?$/.test(host)) return '';
  return `${isSecureRequest(req) ? 'https' : 'http'}://${host}`;
}

function slug(value) {
  return String(value || 'evenement').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'evenement';
}

route('GET', /^\/api\/events\/([^/]+)\/ics$/, async ({ req, res, params }) => {
  const eventId = pathId(params[0]);
  if (!eventId) return notFound(res);
  const event = await findVisibleEvent(eventId, req);
  if (!event || Number.isNaN(eventTimeMs(event.starts_at))) return notFound(res);
  const origin = publicOrigin(req);
  const body = buildIcs(event, { url: origin ? `${origin}/evenement.html?id=${encodeURIComponent(event.id)}` : '' });
  res.writeHead(200, {
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': `attachment; filename="festiconnect-${slug(event.title)}.ics"`
  });
  res.end(body);
});
