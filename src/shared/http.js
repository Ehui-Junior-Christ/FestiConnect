import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { AppError } from './errors.js';

export const MAX_BODY_BYTES = 100 * 1024;

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

export function contentTypeFor(filePath) {
  return types[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

export function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function isJsonContentType(req) {
  const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  return type === 'application/json';
}

// Lit un corps JSON borne en taille. Erreurs explicites :
// 413 (trop gros), 415 (pas du JSON), 400 (JSON invalide / pas un objet).
export async function parseBody(req, { limit = MAX_BODY_BYTES } = {}) {
  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > limit) {
    throw new AppError(413, 'PAYLOAD_TOO_LARGE', 'Requête trop volumineuse.', { Connection: 'close' });
  }

  const raw = await new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let done = false;
    const finish = (error, value) => {
      if (done) return;
      done = true;
      req.off('data', onData);
      req.off('end', onEnd);
      req.off('error', onError);
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk) => {
      size += chunk.length;
      if (size > limit) {
        // On arrete d'accumuler ; la connexion sera fermee apres la reponse 413.
        req.resume();
        finish(new AppError(413, 'PAYLOAD_TOO_LARGE', 'Requête trop volumineuse.', { Connection: 'close' }));
        return;
      }
      chunks.push(chunk);
    };
    const onEnd = () => finish(null, Buffer.concat(chunks).toString('utf8'));
    const onError = () => finish(new AppError(400, 'BAD_REQUEST', 'Requête interrompue.'));
    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
  });

  if (!raw.trim()) return {};
  if (!isJsonContentType(req)) {
    throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Le corps de la requête doit être en JSON (Content-Type: application/json).');
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new AppError(400, 'INVALID_JSON', 'Corps JSON invalide.');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new AppError(400, 'INVALID_JSON', 'Le corps de la requête doit être un objet JSON.');
  }
  return data;
}

export function parseCookies(req) {
  const header = String(req.headers.cookie || '');
  const cookies = Object.create(null);
  if (header.length > 8192) return cookies;
  for (const item of header.split(';')) {
    const index = item.indexOf('=');
    if (index <= 0) continue;
    const name = item.slice(0, index).trim();
    if (!name || name in cookies) continue;
    let value = item.slice(index + 1).trim();
    try {
      value = decodeURIComponent(value);
    } catch {
      continue;
    }
    cookies[name] = value;
  }
  return cookies;
}

// Resout un chemin d'URL vers un fichier de `rootDir`, ou null si interdit
// (traversal, fichier cache, octet nul, encodage invalide).
export function resolveStaticPath(rootDir, urlPathname) {
  let pathname;
  try {
    pathname = decodeURIComponent(urlPathname);
  } catch {
    return null;
  }
  if (pathname.includes('\0') || pathname.includes('\\')) return null;
  if (pathname === '/' || pathname === '') pathname = '/index.html';
  const segments = pathname.split('/').filter(Boolean);
  if (segments.some((segment) => segment.startsWith('.'))) return null;
  const root = path.resolve(rootDir);
  const filePath = path.resolve(root, ...segments);
  if (filePath !== root && !filePath.startsWith(root + path.sep)) return null;
  return filePath;
}

async function statFile(filePath) {
  try {
    const stat = await fsp.stat(filePath);
    return stat.isFile() ? stat : null;
  } catch {
    return null;
  }
}

export async function serveFile(req, res, filePath, status = 200, stat = null) {
  const info = stat || await statFile(filePath);
  if (!info) return false;
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(status, {
    'Content-Type': contentTypeFor(filePath),
    'Content-Length': info.size,
    'Cache-Control': ext === '.html' || status !== 200 ? 'no-cache' : 'public, max-age=3600'
  });
  if (req.method === 'HEAD') {
    res.end();
    return true;
  }
  const stream = fs.createReadStream(filePath);
  stream.on('error', (error) => {
    console.error('[static] lecture impossible', error.code || error.message);
    res.destroy();
  });
  stream.pipe(res);
  return true;
}

export async function serveStatic(req, res, rootDir, urlPathname) {
  const filePath = resolveStaticPath(rootDir, urlPathname);
  if (filePath) {
    const stat = await statFile(filePath);
    if (stat) return serveFile(req, res, filePath, 200, stat);
  }
  const notFoundPage = path.join(rootDir, '404.html');
  if (await serveFile(req, res, notFoundPage, 404)) return true;
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
  return true;
}
