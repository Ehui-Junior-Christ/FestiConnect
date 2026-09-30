// Primitives de mouvement deterministes : tout est fonction du temps t (secondes).
// Aucune dependance a requestAnimationFrame, Date ou Math.random.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const prog = (t, t0, t1) => (t1 === t0 ? (t >= t0 ? 1 : 0) : clamp((t - t0) / (t1 - t0)));

// cubic-bezier(p1x, p1y, p2x, p2y) identique a CSS, resolu par Newton + bissection.
export function bezier(p1x, p1y, p2x, p2y) {
  const cx = 3 * p1x, bx = 3 * (p2x - p1x) - cx, ax = 1 - cx - bx;
  const cy = 3 * p1y, by = 3 * (p2y - p1y) - cy, ay = 1 - cy - by;
  const sx = (u) => ((ax * u + bx) * u + cx) * u;
  const sy = (u) => ((ay * u + by) * u + cy) * u;
  const dsx = (u) => (3 * ax * u + 2 * bx) * u + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let u = x;
    for (let i = 0; i < 8; i++) {
      const err = sx(u) - x;
      if (Math.abs(err) < 1e-6) return sy(u);
      const d = dsx(u);
      if (Math.abs(d) < 1e-6) break;
      u -= err / d;
    }
    let lo = 0, hi = 1; u = x;
    for (let i = 0; i < 30; i++) {
      const v = sx(u);
      if (Math.abs(v - x) < 1e-6) break;
      if (v < x) lo = u; else hi = u;
      u = (lo + hi) / 2;
    }
    return sy(u);
  };
}

const backOut = (s) => (x) => { const c3 = s + 1; return 1 + c3 * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };

// Grammaire de mouvement FestiConnect (voir SCRIPT.md, section Direction artistique)
export const E = {
  linear: (x) => x,
  festi: bezier(0.22, 1, 0.36, 1),     // entree signature : depart franc, atterrissage long
  glisse: bezier(0.65, 0, 0.35, 1),    // deplacements camera / ecrans
  sortie: bezier(0.55, 0, 1, 0.45),    // sorties : accelere vers l'exterieur
  expo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  quart: (x) => 1 - Math.pow(1 - x, 4),
  pop: backOut(1.7),                    // impacts sur les temps forts
  popSoft: backOut(1.1),
};

// Interpolation simple : valeur de a vers b entre t0 et t0+dur
export function tw(t, t0, dur, a, b, e = E.festi) {
  return lerp(a, b, e(prog(t, t0, t0 + dur)));
}

// Keyframes : [[temps, valeur, ease?], ...] ; l'ease d'une cle s'applique au segment qui la suit.
export function keys(t, frames) {
  if (t <= frames[0][0]) return frames[0][1];
  for (let i = 0; i < frames.length - 1; i++) {
    const [t0, v0, e = E.festi] = frames[i];
    const [t1, v1] = frames[i + 1];
    if (t < t1) return lerp(v0, v1, e(prog(t, t0, t1)));
  }
  return frames[frames.length - 1][1];
}

// Ressort amorti (0 -> 1 avec depassement). freq en Hz, damp = amortissement.
export function spring(t, t0, freq = 2.2, damp = 7) {
  if (t <= t0) return 0;
  const x = t - t0;
  return 1 - Math.exp(-damp * x) * Math.cos(2 * Math.PI * freq * x);
}

// Pic bref (0 -> 1 -> 0) centre sur t0, utile pour flashs et pressions.
export function blip(t, t0, attack = 0.06, release = 0.35) {
  if (t < t0 - attack || t > t0 + release) return 0;
  if (t < t0) return E.quart(prog(t, t0 - attack, t0));
  return 1 - E.quart(prog(t, t0, t0 + release));
}

// Generateur pseudo-aleatoire deterministe
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Montant FCFA : 30000 -> "30 000" (espace fine insecable)
export function xof(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

// Helpers DOM
export function html(el, markup) {
  el.innerHTML = markup;
  const refs = {};
  el.querySelectorAll('[data-k]').forEach((n) => { refs[n.dataset.k] = n; });
  return refs;
}

export function css(node, props) {
  if (!node) return;
  for (const k in props) {
    const v = props[k];
    if (k.startsWith('--')) node.style.setProperty(k, v);
    else node.style[k] = v;
  }
}

// Visibilite + opacite en une fois (evite le rendu d'elements invisibles)
export function show(node, opacity) {
  if (!node) return;
  node.style.opacity = opacity;
  node.style.visibility = opacity <= 0.001 ? 'hidden' : 'visible';
}

// Decoupe un texte en caracteres masques pour les revelations typographiques.
// Retourne le markup ; les caracteres ont la classe .ch et data-i.
export function splitChars(text, cls = '') {
  let i = 0;
  return text.split(' ').map((word) => {
    const chars = [...word].map((c) => `<span class="ch ${cls}" data-i="${i++}">${c}</span>`).join('');
    i++;
    return `<span class="word"><span class="word-in">${chars}</span></span>`;
  }).join('<span class="sp"> </span>');
}

// Anime une ligne decoupee : chaque caractere monte depuis sous la ligne de base.
export function revealChars(root, t, t0, { stagger = 0.028, dur = 0.55, dist = 1.05, out = null, outDur = 0.35, outStagger = 0.012, outDist = 1.6, order = 'ltr' } = {}) {
  const chars = root.querySelectorAll('.ch');
  const n = chars.length;
  chars.forEach((c, k) => {
    let idx = k;
    if (order === 'center') idx = Math.abs(k - (n - 1) / 2);
    if (order === 'rtl') idx = n - 1 - k;
    let y = tw(t, t0 + idx * stagger, dur, dist, 0, E.festi);
    let rot = tw(t, t0 + idx * stagger, dur, 8, 0, E.festi);
    if (out !== null) {
      const yo = tw(t, out + k * outStagger, outDur, 0, -outDist, E.sortie);
      y += yo;
    }
    c.style.transform = `translateY(${y * 100}%) rotate(${rot}deg)`;
  });
}
