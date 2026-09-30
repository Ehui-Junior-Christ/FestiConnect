// Sequence A - Ouverture "Abidjan, 21 h"
// A1 : la pastille orange nait sur un temps et pulse ; les ondes partent a chaque temps.
// A2 : la camera recule, la pastille devient Abidjan dans une constellation de villes reliees.
import { html, tw, keys, E, spring, show, splitChars, revealChars, lerp, prog } from '../lib/motion.js';
import { C } from '../lib/motifs.js';

const CITIES = [
  { name: 'Abidjan', x: 1500, y: 760, main: true },
  { name: 'Grand-Bassam', x: 1662, y: 806, from: 0, lx: 18, ly: 30 },
  { name: 'Yamoussoukro', x: 1392, y: 540, from: 0, lx: 20, ly: 6 },
  { name: 'Bouaké', x: 1502, y: 382, from: 2, lx: 20, ly: 6 },
  { name: 'San-Pédro', x: 1122, y: 866, from: 0, lx: -20, ly: 32, anchor: 'end' },
  { name: 'Korhogo', x: 1352, y: 200, from: 3, lx: 20, ly: 6 },
];
const POOL = 8;

function curve(a, b, bend = 0.18) {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const dx = b.x - a.x, dy = b.y - a.y;
  return { x0: a.x, y0: a.y, cx: mx - dy * bend, cy: my + dx * bend, x1: b.x, y1: b.y };
}
const qpt = (q, u) => ({
  x: (1 - u) * (1 - u) * q.x0 + 2 * (1 - u) * u * q.cx + u * u * q.x1,
  y: (1 - u) * (1 - u) * q.y0 + 2 * (1 - u) * u * q.cy + u * u * q.y1,
});

export default {
  css: `
  .scene-ouverture { background: var(--nuit); }
  .ov-svg { position:absolute; inset:0; }
  .ov-label { position:absolute; left:156px; top:268px; font: 500 24px/1 var(--f-mono); letter-spacing:.18em; color: var(--sable); white-space:nowrap; }
  .ov-clock { position:absolute; right:150px; top:118px; font: 500 26px/1 var(--f-mono); letter-spacing:.12em; color: var(--creme-70); }
  .ov-clock b { color: var(--orange); font-weight:700; }
  .ov-t1 { position:absolute; left:142px; top:318px; font-size: 250px; color: var(--creme); white-space:nowrap; }
  .ov-t2 { position:absolute; left:156px; top:610px; font: 600 64px/1 var(--f-ui); color: var(--creme); white-space:nowrap; letter-spacing:-.01em; }
  .ov-t2 .o { color: var(--orange); }
  .ov-t3 { position:absolute; left:142px; top:300px; font-size: 150px; color: var(--creme); }
  .ov-t3 .line { white-space: nowrap; }
  .ov-city { font: 500 19px/1 var(--f-mono); letter-spacing:.16em; text-transform: uppercase; fill: var(--creme); }
  .ov-city.main { font-size: 24px; font-weight: 700; fill: var(--orange); }
  `,
  build(el, ctx) {
    const abj = CITIES[0];
    const links = CITIES.slice(1).map((c) => curve(CITIES[c.from], c, c.from === 0 ? 0.16 : -0.14));
    const coast = [0, 1, 2].map((i) => `M860 ${930 + i * 18} C 1120 ${880 + i * 18}, 1320 ${845 + i * 18}, 1500 ${800 + i * 18} S 1800 ${835 + i * 18}, 2000 ${820 + i * 18}`);
    const r = html(el, `
      <svg class="ov-svg" width="1920" height="1080" viewBox="0 0 1920 1080">
        <defs>
          <pattern id="ov-grid" width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="20" cy="20" r="1.7" fill="${C.creme}"/></pattern>
          <radialGradient id="ov-fade"><stop offset="0" stop-color="#fff"/><stop offset=".7" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
          <mask id="ov-mask"><circle data-k="maskC" cx="${abj.x}" cy="${abj.y}" r="0" fill="url(#ov-fade)"/></mask>
          <radialGradient id="ov-glow"><stop offset="0" stop-color="${C.orange}" stop-opacity=".55"/><stop offset="1" stop-color="${C.orange}" stop-opacity="0"/></radialGradient>
        </defs>
        <g data-k="world">
          <rect x="-400" y="-400" width="2800" height="1900" fill="url(#ov-grid)" mask="url(#ov-mask)" opacity=".16"/>
          <g data-k="coastG" fill="none" stroke="${C.lagune}" stroke-width="2">${coast.map((d, i) => `<path data-k="coast${i}" d="${d}" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1" opacity="${0.5 - i * 0.12}"/>`).join('')}</g>
          <circle data-k="glow" cx="${abj.x}" cy="${abj.y}" r="170" fill="url(#ov-glow)"/>
          <g data-k="ripG" fill="none">${Array.from({ length: POOL }, (_, i) => `<circle data-k="rip${i}" cx="${abj.x}" cy="${abj.y}" r="10" stroke="${C.creme}"/>`).join('')}</g>
          <g data-k="linkG" fill="none" stroke="${C.orange}" stroke-width="2.5" stroke-linecap="round">${links.map((q, i) => `<path data-k="link${i}" d="M${q.x0} ${q.y0} Q${q.cx} ${q.cy} ${q.x1} ${q.y1}" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"/>`).join('')}</g>
          <g>${links.map((_, i) => `<circle data-k="spark${i}" r="4.5" fill="${C.sable}"/>`).join('')}</g>
          <g>${CITIES.slice(1).map((c, i) => `
            <circle data-k="cring${i}" cx="${c.x}" cy="${c.y}" r="10" fill="none" stroke="${C.orange}" stroke-width="2"/>
            <circle data-k="city${i}" cx="${c.x}" cy="${c.y}" r="8" fill="${C.creme}"/>
            <text data-k="lab${i}" class="ov-city" x="${c.x + c.lx}" y="${c.y + c.ly}" text-anchor="${c.anchor || 'start'}">${c.name}</text>`).join('')}
          </g>
          <circle data-k="dot" cx="${abj.x}" cy="${abj.y}" r="12" fill="${C.orange}"/>
          <text data-k="labMain" class="ov-city main" x="${abj.x + 22}" y="${abj.y - 20}">Abidjan</text>
        </g>
      </svg>
      <div class="ov-label" data-k="label">CÔTE D'IVOIRE  ·  05°20′N  04°01′O</div>
      <div class="ov-clock" data-k="clock"></div>
      <div class="ov-t1 display" data-k="t1"><span class="line">${splitChars('Abidjan').replace('</span></span>', '</span><span class="ch dot">.</span></span>')}</span></div>
      <div class="ov-t2" data-k="t2"><span class="line"><span class="ch" style="transform-origin:0 100%">Vendredi, <span class="o">21 h</span></span></span></div>
      <div class="ov-t3 display" data-k="t3">
        <span class="line" data-k="l1">${splitChars('Ce soir,')}</span>
        <span class="line" data-k="l2">${splitChars('tout le monde')}</span>
        <span class="line" data-k="l3">${splitChars('sort')}<span class="word"><span class="word-in"><span class="ch dot">.</span></span></span></span>
      </div>`);
    r.label.dataset.full = r.label.textContent;
    return { r, links, abj };
  },

  update(s, lt, ctx, tg) {
    const { r, links, abj } = s;
    const a1 = ctx.p('A1'), a2 = ctx.p('A2');
    const tDot = ctx.c('A1.dot');
    const tPull = ctx.c('A2.pullback');
    const tOut = ctx.c('A2.out');
    const beat = ctx.beat;

    // Camera : zoom serre sur Abidjan (A1) puis recul (A2)
    const push = tw(lt, a1.s, a1.d, 3.1, 3.35, E.linear);
    const pull = E.glisse(prog(lt, tPull - 0.15, tPull + 1.5));
    const outZ = tw(lt, tOut, ctx.dur - tOut, 1, 1.12, E.sortie);
    const sc = lerp(push, 1, pull) * outZ;
    const fx = lerp(1360, abj.x, pull), fy = lerp(560, abj.y, pull);
    r.world.setAttribute('transform', `translate(${fx - abj.x * sc} ${fy - abj.y * sc}) scale(${sc})`);
    // Epaisseurs de trait constantes a l'ecran malgre le zoom
    r.coastG.setAttribute('stroke-width', (2 / sc).toFixed(3));
    r.ripG.setAttribute('stroke-width', (2 / sc).toFixed(3));
    r.linkG.setAttribute('stroke-width', (2.5 / sc).toFixed(3));
    for (let i = 0; i < CITIES.length - 1; i++) r[`cring${i}`].setAttribute('stroke-width', (2 / sc).toFixed(3));

    // Pastille : naissance en ressort sur le temps, pulsation sur chaque temps
    const born = lt >= tDot - 0.02 ? Math.max(0, spring(lt, tDot - 0.02, 2.4, 6.5)) : 0;
    const pulse = lt >= tDot ? ctx.pulse(tg, 6) : 0;
    r.dot.setAttribute('r', (12 * born * (1 + 0.22 * pulse)).toFixed(2));
    r.glow.setAttribute('r', (170 * born * (1 + 0.35 * pulse)).toFixed(1));
    show(r.glow, born * (0.55 + 0.45 * pulse));

    // Ondes : une par temps, plus grande et orange sur le premier temps de la mesure
    const bpb = ctx.tl.music.beatsPerBar || 4;
    const life = 1.9;
    for (let i = 0; i < 8; i++) r[`rip${i}`].style.visibility = 'hidden';
    if (lt >= tDot) {
      const kNow = Math.floor((lt - tDot) / beat + 1e-6);
      for (let k = Math.max(0, kNow - 5); k <= kNow; k++) {
        const tb = tDot + k * beat;
        const age = lt - tb;
        if (age < 0 || age > life || tb > tOut) continue;
        const down = ctx.beatIndex(tb + ctx.seq.start) % bpb === 0;
        const c = r[`rip${k % 8}`];
        const u = age / life;
        c.setAttribute('r', (12 + (down ? 300 : 170) * E.expo(u)).toFixed(1));
        c.setAttribute('stroke', down ? C.orange : C.creme);
        c.style.visibility = 'visible';
        c.style.opacity = ((1 - u) * (1 - u) * (down ? 0.9 : 0.45) * (1 - 0.6 * pull)).toFixed(3);
      }
    }

    // Grille urbaine et littoral (lagune) reveles par le recul
    r.maskC.setAttribute('r', (tw(lt, tDot, 2.5, 0, 260, E.festi) + tw(lt, tPull, 2.4, 0, 900, E.festi)).toFixed(1));
    [0, 1, 2].forEach((i) => r[`coast${i}`].setAttribute('stroke-dashoffset', (1 - tw(lt, tPull + 0.1 + i * 0.12, 1.8, 0, 1, E.glisse)).toFixed(4)));

    // Villes : la liaison part de la ville source et atterrit exactement sur le temps
    const tC = ctx.c('A2.cities');
    const step = ctx.seq.plans[1].cues.cityStep ?? beat;
    links.forEach((q, i) => {
      const ti = tC + i * step;
      const draw = prog(lt, ti - 0.42, ti);
      r[`link${i}`].setAttribute('stroke-dashoffset', (1 - E.glisse(draw)).toFixed(4));
      show(r[`link${i}`], 0.85 * tw(lt, tOut, 0.4, 1, 0.4));
      const pop = lt >= ti ? spring(lt, ti, 2.6, 7) : 0;
      r[`city${i}`].setAttribute('r', (8 * pop).toFixed(2));
      const age = lt - ti;
      const ring = r[`cring${i}`];
      if (age > 0 && age < 1.2) { ring.style.visibility = 'visible'; ring.setAttribute('r', (8 + 46 * E.expo(age / 1.2)).toFixed(1)); ring.style.opacity = ((1 - age / 1.2) * 0.9).toFixed(3); }
      else ring.style.visibility = 'hidden';
      const lab = r[`lab${i}`];
      show(lab, tw(lt, ti + 0.05, 0.35, 0, 0.8));
      lab.setAttribute('transform', `translate(0 ${tw(lt, ti + 0.05, 0.45, 10, 0).toFixed(2)})`);
      // Etincelle qui circule sur la liaison une fois tracee (la "connexion")
      const sp = r[`spark${i}`];
      if (lt > ti + 0.2 && lt < tOut + 0.3) {
        const u = ((lt - ti - 0.2) / 1.6 + i * 0.37) % 1;
        const p = qpt(q, E.glisse(u));
        sp.setAttribute('cx', p.x.toFixed(1)); sp.setAttribute('cy', p.y.toFixed(1));
        sp.style.visibility = 'visible'; sp.style.opacity = Math.sin(Math.PI * u).toFixed(3);
      } else sp.style.visibility = 'hidden';
    });
    show(r.labMain, tw(lt, tPull + 0.6, 0.4, 0, 1));

    // Typo A1
    show(r.label, tw(lt, tDot, 0.4, 0, 1) * tw(lt, tPull, 0.3, 1, 0));
    r.label.textContent = r.label.dataset.full.slice(0, Math.max(0, Math.round(prog(lt, tDot, tDot + 0.7) * r.label.dataset.full.length)));
    revealChars(r.t1, lt, ctx.c('A1.title1'), { stagger: 0.035, dur: 0.6, out: tPull - 0.05, outDur: 0.35 });
    const t2In = ctx.c('A1.title2');
    r.t2.querySelector('.ch').style.transform = `translateY(${(tw(lt, t2In, 0.55, 1.1, 0) + tw(lt, tPull - 0.05, 0.35, 0, -1.2, E.sortie)) * 100}%)`;

    // Horloge : 21:00:00 tombe exactement sur title2
    const secs = Math.floor(lt - t2In + 1e-6);
    const tot = 21 * 3600 + secs;
    const hh = String(Math.floor(tot / 3600) % 24).padStart(2, '0'), mm = String(Math.floor(tot / 60) % 60).padStart(2, '0'), ss = String(((tot % 60) + 60) % 60).padStart(2, '0');
    r.clock.innerHTML = `VEN. <b>${hh}:${mm}:${ss}</b>`;
    show(r.clock, tw(lt, ctx.c('A1.clock'), 0.3, 0, 1) * tw(lt, tOut, 0.3, 1, 0));

    // Typo A2
    const t3 = ctx.c('A2.title3'), t4 = ctx.c('A2.title4');
    revealChars(r.l1, lt, t3, { stagger: 0.03, out: tOut, outDur: 0.3 });
    revealChars(r.l2, lt, t4, { stagger: 0.025, out: tOut + 0.04, outDur: 0.3 });
    revealChars(r.l3, lt, t4 + 0.3, { stagger: 0.03, out: tOut + 0.08, outDur: 0.3 });
    const o = tw(lt, a2.e - 0.12, 0.12, 1, 0, E.linear);
    r.world.style.opacity = o;
  },
};
