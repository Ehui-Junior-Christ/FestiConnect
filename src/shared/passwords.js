import crypto from 'node:crypto';

// Hachage scrypt (natif Node), execute de maniere asynchrone dans le
// threadpool libuv pour ne pas bloquer la boucle d'evenements.
// Parametres : recommandation OWASP (N=2^15, r=8, p=3 ~ 32 Mio par hachage).
export const SCRYPT_PARAMS = Object.freeze({ N: 32768, r: 8, p: 3 });
// Parametres historiques (hash hexadecimal "nu" produit par scryptSync par defaut).
const LEGACY_PARAMS = Object.freeze({ N: 16384, r: 8, p: 1 });
const KEY_LENGTH = 64;
const SALT_BYTES = 16;
const MAX_MEMORY = 128 * 1024 * 1024;
const PREFIX = 'scrypt';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
// Au-dela, on ne tente meme pas de deriver (anti-DoS).
const VERIFY_MAX_LENGTH = 1024;

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', 'motdepasse', 'motdepasse1', 'azerty', 'azerty123', 'azertyuiop',
  'qwerty', 'qwerty123', 'qwertyuiop', '12345678', '123456789', '1234567890', '11111111', '00000000',
  'abc12345', 'abcd1234', 'iloveyou', 'admin123', 'welcome1', 'bienvenue', 'bienvenue1', 'soleil123',
  'festiconnect', 'festiconnect1', 'festiconnect123', 'abidjan123', 'passw0rd', 'p@ssw0rd'
]);

function derive(password, salt, params) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEY_LENGTH, { ...params, maxmem: MAX_MEMORY }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

function parseStoredHash(stored) {
  if (typeof stored !== 'string') return null;
  if (stored.startsWith(`${PREFIX}$`)) {
    const [, n, r, p, hex] = stored.split('$');
    const params = { N: Number(n), r: Number(r), p: Number(p) };
    const valid = [params.N, params.r, params.p].every(Number.isSafeInteger)
      && params.N >= 1024 && params.N <= 1048576 && (params.N & (params.N - 1)) === 0
      && params.r >= 1 && params.r <= 32 && params.p >= 1 && params.p <= 16
      && /^[0-9a-f]+$/i.test(hex || '');
    return valid ? { params, hash: Buffer.from(hex, 'hex') } : null;
  }
  if (/^[0-9a-f]{128}$/i.test(stored)) {
    return { params: LEGACY_PARAMS, hash: Buffer.from(stored, 'hex') };
  }
  return null;
}

export async function hashPassword(password) {
  if (typeof password !== 'string' || !password) throw new Error('Mot de passe invalide.');
  const salt = crypto.randomBytes(SALT_BYTES).toString('hex');
  const key = await derive(password, salt, SCRYPT_PARAMS);
  const { N, r, p } = SCRYPT_PARAMS;
  return { salt, hash: `${PREFIX}$${N}$${r}$${p}$${key.toString('hex')}` };
}

export async function verifyPassword(password, salt, storedHash) {
  if (typeof password !== 'string' || !password || password.length > VERIFY_MAX_LENGTH) return false;
  if (typeof salt !== 'string' || !salt) return false;
  const parsed = parseStoredHash(storedHash);
  if (!parsed || parsed.hash.length !== KEY_LENGTH) return false;
  const key = await derive(password, salt, parsed.params);
  return crypto.timingSafeEqual(key, parsed.hash);
}

// Vrai si le hash stocke n'utilise pas les parametres courants (rehash au login).
export function needsRehash(storedHash) {
  const parsed = parseStoredHash(storedHash);
  if (!parsed || typeof storedHash !== 'string' || !storedHash.startsWith(`${PREFIX}$`)) return true;
  const { N, r, p } = parsed.params;
  return N !== SCRYPT_PARAMS.N || r !== SCRYPT_PARAMS.r || p !== SCRYPT_PARAMS.p;
}

let dummy;
// Verification factice (compte inexistant) pour egaliser le temps de reponse
// du login et limiter l'enumeration d'emails par mesure de temps.
export async function dummyVerify(password) {
  if (!dummy) dummy = hashPassword(crypto.randomBytes(16).toString('hex'));
  const { salt, hash } = await dummy;
  await verifyPassword(typeof password === 'string' && password ? password.slice(0, VERIFY_MAX_LENGTH) : 'x', salt, hash);
  return false;
}

// Retourne un message d'erreur (francais) ou null si le mot de passe est acceptable.
export function passwordPolicyError(password, { email = '', name = '' } = {}) {
  if (typeof password !== 'string' || !password) return 'Le mot de passe est obligatoire.';
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Le mot de passe ne doit pas dépasser ${PASSWORD_MAX_LENGTH} caractères.`;
  }
  if (!/\p{L}/u.test(password) || !/\p{N}/u.test(password)) {
    return 'Le mot de passe doit contenir au moins une lettre et un chiffre.';
  }
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return 'Ce mot de passe est trop courant. Choisis-en un autre.';
  const localPart = String(email).split('@')[0].toLowerCase();
  if ((localPart && localPart.length >= 4 && lower.includes(localPart)) || lower === String(email).toLowerCase()) {
    return 'Le mot de passe ne doit pas contenir ton adresse email.';
  }
  if (name && lower === String(name).trim().toLowerCase()) {
    return 'Le mot de passe ne doit pas être identique à ton nom.';
  }
  return null;
}
