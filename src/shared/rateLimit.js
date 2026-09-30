import { AppError } from './errors.js';

// Limiteur en memoire a fenetre fixe. Borne en nombre de cles pour eviter
// qu'un attaquant (IPs ou emails aleatoires) ne fasse grossir la memoire.
// NB : l'etat est local au processus (a remplacer par un store partage si
// l'application tourne un jour sur plusieurs instances).
export class RateLimiter {
  constructor({ windowMs, max, maxKeys = 50000, now = () => Date.now() }) {
    this.windowMs = windowMs;
    this.max = max;
    this.maxKeys = maxKeys;
    this.now = now;
    this.store = new Map();
    this.timer = setInterval(() => this.prune(), Math.min(windowMs, 60000));
    this.timer.unref?.();
  }

  entry(key) {
    const current = this.store.get(key);
    if (current && current.resetAt > this.now()) return current;
    if (current) this.store.delete(key);
    return null;
  }

  // Etat sans incrementer.
  check(key) {
    const entry = this.entry(key);
    if (!entry || entry.count < this.max) return { limited: false, retryAfterMs: 0 };
    return { limited: true, retryAfterMs: entry.resetAt - this.now() };
  }

  // Incremente et indique si la limite est depassee.
  hit(key) {
    let entry = this.entry(key);
    if (!entry) {
      if (this.store.size >= this.maxKeys) this.prune();
      while (this.store.size >= this.maxKeys) {
        this.store.delete(this.store.keys().next().value);
      }
      entry = { count: 0, resetAt: this.now() + this.windowMs };
      this.store.set(key, entry);
    }
    entry.count += 1;
    return { limited: entry.count > this.max, retryAfterMs: entry.resetAt - this.now() };
  }

  reset(key) {
    this.store.delete(key);
  }

  prune() {
    const now = this.now();
    for (const [key, entry] of this.store) {
      if (entry.resetAt <= now) this.store.delete(key);
    }
  }

  stop() {
    clearInterval(this.timer);
  }
}

export function tooManyRequests(retryAfterMs) {
  const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  const minutes = Math.ceil(seconds / 60);
  return new AppError(
    429,
    'RATE_LIMITED',
    `Trop de tentatives. Réessaie dans ${minutes > 1 ? `${minutes} minutes` : 'une minute'}.`,
    { 'Retry-After': String(seconds) }
  );
}

export function enforce(limiter, key) {
  const result = limiter.hit(key);
  if (result.limited) throw tooManyRequests(result.retryAfterMs);
}
