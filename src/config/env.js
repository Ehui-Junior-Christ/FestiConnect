import fs from 'node:fs';
import path from 'node:path';

// Chargement minimal du fichier .env (sans dependance). Les variables deja
// definies dans l'environnement du processus ne sont jamais ecrasees.
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const PLACEHOLDER_MARKERS = [
  'colle-ton-token',
  'remplace-moi',
  'changeme',
  'change-me',
  'placeholder',
  'your-token',
  'your-secret',
  'xxxxxxxx'
];

export function isPlaceholder(value) {
  const lower = String(value || '').toLowerCase();
  return PLACEHOLDER_MARKERS.some((marker) => lower.includes(marker));
}

// Les messages d'erreur ne contiennent JAMAIS la valeur de la variable.
export function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Variable d'environnement manquante: ${name}`);
  if (isPlaceholder(value)) {
    throw new Error(`Variable d'environnement non configuree (valeur d'exemple): ${name}`);
  }
  return value;
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

const DEV_APP_SECRET = 'festiconnect-dev-secret-ne-pas-utiliser-en-production';
const MIN_APP_SECRET_LENGTH = 32;

function resolveAppSecret() {
  const value = process.env.APP_SECRET || '';
  if (isProduction) {
    const secret = requiredEnv('APP_SECRET');
    if (secret.length < MIN_APP_SECRET_LENGTH) {
      throw new Error(`APP_SECRET doit contenir au moins ${MIN_APP_SECRET_LENGTH} caracteres en production.`);
    }
    return secret;
  }
  if (!value || isPlaceholder(value) || value.length < MIN_APP_SECRET_LENGTH) {
    if (nodeEnv !== 'test') {
      console.warn('[config] APP_SECRET absent ou faible: secret de developpement utilise (interdit en production).');
    }
    return DEV_APP_SECRET;
  }
  return value;
}

function parseTrustProxy(raw) {
  if (!raw || raw === 'false') return 0;
  if (raw === 'true') return 1;
  const hops = Number.parseInt(raw, 10);
  if (!Number.isInteger(hops) || hops < 0 || hops > 10) {
    throw new Error('TRUST_PROXY doit etre un entier entre 0 et 10 (nombre de proxys de confiance).');
  }
  return hops;
}

function parseOrigins(raw) {
  if (!raw) return [];
  return raw.split(',').map((item) => item.trim()).filter(Boolean).map((item) => {
    let url;
    try {
      url = new URL(item);
    } catch {
      throw new Error('APP_ORIGIN contient une origine invalide.');
    }
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('APP_ORIGIN doit utiliser http(s).');
    return url.origin;
  });
}

function parsePort(raw) {
  const port = Number(raw || 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT invalide.');
  return port;
}

export const config = Object.freeze({
  nodeEnv,
  isProduction,
  port: parsePort(process.env.PORT),
  appSecret: resolveAppSecret(),
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  appOrigins: parseOrigins(process.env.APP_ORIGIN),
  cspReportOnly: process.env.CSP_REPORT_ONLY === 'true'
});

export function isLocalDatabaseUrl(url) {
  return url === ':memory:' || url.startsWith('file:');
}

// Configuration de la base. Une base locale (file:) est acceptee en
// developpement/test uniquement ; en production elle est refusee explicitement.
export function databaseConfig() {
  const url = requiredEnv('TURSO_DATABASE_URL');
  if (isLocalDatabaseUrl(url)) {
    if (isProduction) {
      throw new Error('TURSO_DATABASE_URL pointe vers une base locale (file:), interdit en production.');
    }
    return { url };
  }
  if (isProduction && !/^(libsql|https|wss):\/\//i.test(url)) {
    throw new Error('TURSO_DATABASE_URL doit utiliser libsql://, https:// ou wss:// en production.');
  }
  return { url, authToken: requiredEnv('TURSO_AUTH_TOKEN') };
}
