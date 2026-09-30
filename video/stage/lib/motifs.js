// Vocabulaire graphique FestiConnect : "la trame".
// Cinq modules geometriques derives des visuels de l'app (cercles concentriques du maquis,
// pointilles de l'Abissa, chevrons du defile, grille-points de la ville, arcs de la lagune).
import { rng } from './motion.js';
import qrcode from '../../node_modules/qrcode-generator/dist/qrcode.mjs';

export const C = {
  nuit: '#0D0B0A', nuit2: '#171210', terre: '#2A1810', brun: '#4A2A1A',
  orange: '#FF5F1F', or: '#FFB938', sable: '#FFD08A', creme: '#F7F2EA',
  lagune: '#4CC9F0', vert: '#2EE07A', rouge: '#FF4D5E',
};

// --- Tuiles de trame (160 x 160) -------------------------------------------
const TILE = 160;
const tiles = {
  cercles: (fg, bg) => `<rect width="160" height="160" fill="${bg}"/>
    <g fill="none" stroke="${fg}" stroke-width="12"><circle cx="80" cy="80" r="62"/><circle cx="80" cy="80" r="34"/></g>
    <circle cx="80" cy="80" r="11" fill="${fg}"/>`,
  tirets: (fg, bg) => `<rect width="160" height="160" fill="${bg}"/>
    <g stroke="${fg}" stroke-width="16" stroke-dasharray="26 18"><path d="M0 28h160M-22 80h182M0 132h160"/></g>`,
  chevrons: (fg, bg) => `<rect width="160" height="160" fill="${bg}"/>
    <path d="M0 160 40 80l40 80 40-80 40 80z" fill="${fg}"/><path d="M40 80 80 0l40 80z" fill="${fg}" opacity=".55"/>`,
  grille: (fg, bg) => `<rect width="160" height="160" fill="${bg}"/>
    <path d="M0 80h160M80 0v160" stroke="${fg}" stroke-width="6" opacity=".6"/>
    <circle cx="80" cy="80" r="20" fill="${fg}"/><circle cx="0" cy="0" r="12" fill="${fg}"/><circle cx="160" cy="0" r="12" fill="${fg}"/><circle cx="0" cy="160" r="12" fill="${fg}"/><circle cx="160" cy="160" r="12" fill="${fg}"/>`,
  arcs: (fg, bg) => `<rect width="160" height="160" fill="${bg}"/>
    <g fill="none" stroke="${fg}" stroke-width="12"><path d="M8 80a72 72 0 0 1 144 0"/><path d="M40 80a40 40 0 0 1 80 0"/><path d="M8 160a72 72 0 0 1 144 0"/><path d="M40 160a40 40 0 0 1 80 0"/></g>`,
};
export const TILE_KINDS = Object.keys(tiles);

const COMBOS = [
  [C.orange, C.nuit], [C.sable, C.terre], [C.creme, C.orange], [C.nuit, C.sable],
  [C.orange, C.creme], [C.or, C.nuit], [C.terre, C.or], [C.creme, C.nuit],
];

export function tile(kind, fg, bg, x = 0, y = 0, size = TILE) {
  const s = size / TILE;
  return `<g transform="translate(${x} ${y}) scale(${s})">${tiles[kind](fg, bg)}</g>`;
}

// Bande de trame (ex. transition "Le Pagne") : cols x rows tuiles, choix seedes.
export function trameBand(cols, rows, seed = 7, size = 160) {
  const r = rng(seed);
  let out = '';
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const kind = TILE_KINDS[Math.floor(r() * TILE_KINDS.length)];
      const [fg, bg] = COMBOS[Math.floor(r() * COMBOS.length)];
      out += `<g data-tile="${x},${y}">${tile(kind, fg, bg, x * size, y * size, size)}</g>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * size}" height="${rows * size}" viewBox="0 0 ${cols * size} ${rows * size}">${out}</svg>`;
}

// --- Affiches d'evenements stylisees (viewBox 900 x 560) --------------------
export function art(kind) {
  const band = (y, seed) => {
    const r = rng(seed); let s = '';
    for (let i = 0; i < 12; i++) {
      const k = TILE_KINDS[Math.floor(r() * TILE_KINDS.length)];
      const [fg, bg] = COMBOS[Math.floor(r() * COMBOS.length)];
      s += tile(k, fg, bg, i * 80, y, 80);
    }
    return s;
  };
  const wrap = (inner) => `<svg viewBox="0 0 900 560" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
  switch (kind) {
    case 'abissa':
      return wrap(`<rect width="900" height="560" fill="${C.terre}"/>
        <circle cx="640" cy="190" r="150" fill="${C.orange}"/>
        <g fill="none" stroke="${C.sable}" stroke-width="10" opacity=".9"><circle cx="640" cy="190" r="190"/><circle cx="640" cy="190" r="232" stroke-dasharray="30 22"/></g>
        <path d="M0 380c126-70 227-48 345 0s222 55 395-38c75-40 126-53 160-46v264H0z" fill="${C.nuit}"/>
        <g fill="${C.creme}"><path d="M170 300h54l14 110h-82z"/><path d="M262 270h62l18 140h-98z"/><path d="M372 312h46l12 98h-70z"/></g>
        ${band(480, 11)}`);
    case 'maquis':
      return wrap(`<rect width="900" height="560" fill="${C.nuit}"/>
        <rect width="900" height="560" fill="${C.orange}" opacity=".12"/>
        <g fill="none" stroke="${C.orange}" stroke-width="18"><circle cx="450" cy="280" r="200"/><circle cx="450" cy="280" r="120"/></g>
        <circle cx="450" cy="280" r="44" fill="${C.sable}"/>
        <g fill="${C.creme}" opacity=".85">${Array.from({ length: 9 }, (_, i) => `<circle cx="${60 + i * 100}" cy="60" r="7"/><circle cx="${60 + i * 100}" cy="500" r="7"/>`).join('')}</g>`);
    case 'mode':
      return wrap(`<rect width="900" height="560" fill="${C.terre}"/>
        <g fill="none" stroke="${C.brun}" stroke-width="10">${Array.from({ length: 7 }, (_, i) => `<path d="M${-40 + i * 150} 0l110 560"/>`).join("")}</g>
        <path d="M275 470 448 90l177 380z" fill="${C.orange}"/>
        <path d="M348 470 448 190l103 280z" fill="${C.sable}"/>
        <path d="M120 500h660" stroke="${C.creme}" stroke-width="18" stroke-linecap="round"/>`);
    default:
      return wrap(`<rect width="900" height="560" fill="${C.nuit2}"/>
        <path d="M110 110h680v340H110z" fill="${C.orange}" fill-opacity=".18" stroke="${C.orange}" stroke-width="8"/>
        <circle cx="300" cy="280" r="90" fill="${C.sable}" opacity=".8"/>
        <g fill="none" stroke="${C.creme}" stroke-width="10" opacity=".7"><path d="M460 220h250M460 280h200M460 340h230"/></g>`);
  }
}

// --- Produits de la boutique (viewBox 800 x 800, d'apres public/assets/img/product-*.svg) ---
export function productArt(kind) {
  const wrap = (bg, inner) => `<svg viewBox="0 0 800 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><rect width="800" height="800" fill="${bg}"/>${inner}</svg>`;
  switch (kind) {
    case 'cap':
      return wrap(C.terre, `<g opacity=".35">${tile('cercles', C.brun, 'transparent', 560, 40, 200)}</g>
        <ellipse cx="410" cy="600" rx="300" ry="34" fill="#000" opacity=".35"/>
        <path d="M180 440c28-150 160-240 322-184 86 30 134 96 152 184z" fill="${C.orange}"/>
        <path d="M200 400h440l8 40H192z" fill="${C.sable}"/><path d="M230 400h40v40h-40zm80 0h40v40h-40zm80 0h40v40h-40zm80 0h40v40h-40zm80 0h40v40h-40z" fill="${C.nuit}"/>
        <path d="M130 456c160-48 348-54 540-6 34 9 47 54 16 74-130 82-364 72-536-8-31-14-51-50-20-60z" fill="${C.creme}"/>
        <path d="M290 300c48 58 90 90 140 106 48-40 80-74 110-130" fill="none" stroke="${C.sable}" stroke-width="22" stroke-linecap="round"/>`);
    case 'tote':
      return wrap(C.nuit2, `<g opacity=".3">${tile('tirets', C.brun, 'transparent', 40, 580, 200)}</g>
        <ellipse cx="400" cy="672" rx="250" ry="26" fill="#000" opacity=".4"/>
        <path d="M300 260c0-100 200-100 200 0" fill="none" stroke="${C.orange}" stroke-width="26" stroke-linecap="round"/>
        <path d="M230 250h340l58 410H172z" fill="${C.creme}"/>
        <g transform="translate(290 360)">${tile('chevrons', C.orange, C.sable, 0, 0, 220)}</g>`);
    default:
      return wrap(C.brun, `<ellipse cx="400" cy="730" rx="230" ry="22" fill="#000" opacity=".35"/>
        <rect x="200" y="90" width="400" height="610" rx="14" fill="${C.creme}"/>
        <rect x="236" y="126" width="328" height="300" fill="${C.orange}"/>
        <circle cx="400" cy="276" r="86" fill="${C.sable}"/>
        <g fill="none" stroke="${C.creme}" stroke-width="8" opacity=".8"><circle cx="400" cy="276" r="116"/></g>
        <path d="M258 470h284v26H258zm0 52h200v20H258z" fill="${C.nuit}"/>
        <text x="542" y="664" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="26" font-weight="700" fill="${C.nuit}">N° 027 / 150</text>`);
  }
}

// --- QR code reel (qrcode-generator, MIT) ----------------------------------
// Encodage standard, correction d'erreur M par defaut : le code affiche est scannable.
export function qrMatrix(text, ec = 'M') {
  const q = qrcode(0, ec);
  q.addData(text);
  q.make();
  const n = q.getModuleCount();
  const m = Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => (q.isDark(y, x) ? 1 : 0)));
  return { m, n };
}

// SVG du QR ; chaque module porte data-d (distance diagonale 0..1) pour l'animation de construction.
export function qrSVG(text, size = 240, { fg = C.nuit, eye = C.orange } = {}) {
  const { m, n } = qrMatrix(text);
  const u = Math.floor(size / n);
  const off = Math.floor((size - u * n) / 2);
  let mods = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (!m[y][x]) continue;
    const isEye = [[0, 0], [n - 7, 0], [0, n - 7]].some(([ox, oy]) => x >= ox + 2 && x <= ox + 4 && y >= oy + 2 && y <= oy + 4);
    if (isEye) continue;
    const d = ((x + y) / (2 * (n - 1))).toFixed(3);
    mods += `<rect class="qm" data-d="${d}" x="${off + x * u}" y="${off + y * u}" width="${u}" height="${u}" fill="${fg}"/>`;
  }
  const eyes = [[0, 0], [n - 7, 0], [0, n - 7]].map(([ox, oy]) =>
    `<rect class="qeye" x="${off + (ox + 2) * u}" y="${off + (oy + 2) * u}" width="${3 * u}" height="${3 * u}" rx="${u * 0.5}" fill="${eye}"/>`).join('');
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${mods}${eyes}</svg>`;
}

// --- Icones (traits 24x24, style lucide, ISC) -------------------------------
const P = {
  search: '<circle cx="11" cy="11" r="7.5"/><path d="m21 21-4.6-4.6"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="17" rx="2.5"/><path d="M16 2.5v4M8 2.5v4M3 10h18"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
  heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/>',
  back: '<path d="m12 19-7-7 7-7M19 12H5"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  minus: '<path d="M5 12h14"/>',
  plus: '<path d="M5 12h14M12 5v14"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  ticket: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2M13 17v2M13 11v2"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z"/>',
  bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 16v-5M12 16V8M17 16V6"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M16 4a4 4 0 0 1 0 8M22 21v-1a6 6 0 0 0-4-5.6"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
};
export function icon(name, size = 24, color = 'currentColor', sw = 2) {
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${P[name]}</svg>`;
}
