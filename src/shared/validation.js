import { AppError } from './errors.js';

// Caracteres de controle (on tolere \t \n \r uniquement en multiligne).
const CONTROL_STRICT = /[\u0000-\u001F\u007F\u2028\u2029]/;
const CONTROL_MULTILINE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u2028\u2029]/;
// Defense en profondeur contre le XSS stocke : pas de balises dans les textes.
const MARKUP = /[<>]/;

function invalid(message) {
  return new AppError(422, 'VALIDATION_ERROR', message);
}

function isEmpty(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

export function text(value, { label, min = 0, max = 200, required = false, multiline = false, fallback = '' }) {
  if (isEmpty(value)) {
    if (required) throw invalid(`${label} est obligatoire.`);
    return fallback;
  }
  if (typeof value !== 'string' && typeof value !== 'number') throw invalid(`${label} invalide.`);
  const result = String(value).normalize('NFC').trim();
  if (result.length < min) throw invalid(`${label} doit contenir au moins ${min} caractères.`);
  if (result.length > max) throw invalid(`${label} ne doit pas dépasser ${max} caractères.`);
  if ((multiline ? CONTROL_MULTILINE : CONTROL_STRICT).test(result)) {
    throw invalid(`${label} contient des caractères non autorisés.`);
  }
  if (MARKUP.test(result)) throw invalid(`${label} ne doit pas contenir les caractères < ou >.`);
  return result;
}

export function integer(value, { label, min, max, fallback }) {
  if (isEmpty(value)) {
    if (fallback !== undefined) return fallback;
    throw invalid(`${label} est obligatoire.`);
  }
  let number = Number.NaN;
  if (typeof value === 'number') number = value;
  else if (typeof value === 'string' && /^\s*-?\d{1,16}\s*$/.test(value)) number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw invalid(`${label} doit être un nombre entier entre ${min} et ${max}.`);
  }
  return number;
}

export function oneOf(value, allowed, { label, fallback }) {
  if (isEmpty(value) && fallback !== undefined) return fallback;
  if (typeof value !== 'string' || !allowed.includes(value)) throw invalid(`${label} invalide.`);
  return value;
}

const EMAIL = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function email(value, { label = 'Email' } = {}) {
  const result = normalizeEmail(value);
  if (!result) throw invalid(`${label} est obligatoire.`);
  const [local] = result.split('@');
  if (result.length > 254 || local.length > 64 || !EMAIL.test(result) || result.includes('..')) {
    throw invalid('Adresse email invalide.');
  }
  return result;
}

const PHONE = /^\+?[0-9][0-9 .()-]{5,24}$/;

export function phone(value, { label = 'Téléphone' } = {}) {
  if (isEmpty(value)) return '';
  if (typeof value !== 'string') throw invalid(`${label} invalide.`);
  const result = value.trim();
  const digits = result.replace(/\D/g, '');
  if (!PHONE.test(result) || digits.length < 6 || digits.length > 15) throw invalid(`${label} invalide.`);
  return result;
}

// Numero Mobile Money ivoirien : +225 puis 10 chiffres commencant par 01
// (Moov), 05 (MTN) ou 07 (Orange). Espaces, points et tirets toleres ;
// normalise en « +225 07 00 00 00 00 ».
export function ivorianMobile(value, { label = 'Numéro Mobile Money' } = {}) {
  if (isEmpty(value)) throw invalid(`${label} est obligatoire.`);
  if (typeof value !== 'string' || value.length > 30) throw invalid(`${label} invalide.`);
  const compact = value.trim().replace(/[\s.()-]/g, '');
  const match = /^(?:\+225|00225)?(0[157]\d{8})$/.exec(compact);
  if (!match) throw invalid(`${label} invalide : +225 suivi de 10 chiffres commençant par 01, 05 ou 07.`);
  return `+225 ${match[1].replace(/(\d{2})(?=\d)/g, '$1 ')}`;
}

const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?$/;

export function dateTime(value, { label, required = false }) {
  if (isEmpty(value)) {
    if (required) throw invalid(`${label} est obligatoire.`);
    return '';
  }
  if (typeof value !== 'string') throw invalid(`${label} invalide.`);
  const result = value.trim();
  const match = DATE_TIME.exec(result);
  const time = Date.parse(result);
  if (!match || Number.isNaN(time)) throw invalid(`${label} invalide (format attendu AAAA-MM-JJTHH:MM).`);
  const [, year, month, day, hour, minute] = match.map(Number);
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) {
    throw invalid(`${label} invalide.`);
  }
  return result;
}

// Identifiants de ressources (ids texte generes ou ids historiques numeriques).
const ID = /^[A-Za-z0-9_-]{1,64}$/;

export function isValidId(value) {
  return typeof value === 'string' && ID.test(value);
}

export function id(value, { label }) {
  if (isEmpty(value)) throw invalid(`${label} est obligatoire.`);
  if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value);
  if (!isValidId(value)) throw invalid(`${label} invalide.`);
  return value;
}

// Image : chemin local des assets ou URL https (sans guillemets/espaces).
const LOCAL_IMAGE = /^\/assets\/img\/[A-Za-z0-9_-]{1,80}\.(?:svg|png|jpe?g|webp|gif|avif)$/;
const REMOTE_IMAGE = /^https:\/\/[A-Za-z0-9.-]+(?::\d{2,5})?\/[A-Za-z0-9._~\-/%?=&+]*$/;

export function imageUrl(value, { label, fallback }) {
  if (isEmpty(value)) return fallback;
  if (typeof value !== 'string') throw invalid(`${label} invalide.`);
  const result = value.trim();
  if (result.length > 500 || !(LOCAL_IMAGE.test(result) || REMOTE_IMAGE.test(result))) {
    throw invalid(`${label} invalide (chemin /assets/img/... ou URL https attendu).`);
  }
  return result;
}
