// Sequence C - Revelation du logo
// C1 : l'aplat orange (fin de l'iris de B2) se contracte et devient le point du "i" de FestiConnect ;
//      les lettres montent depuis le i, du centre vers l'exterieur. Les trois promesses tombent sur les temps.
// C2 : les promesses sont aspirees dans la pastille ("tout au meme endroit"), puis plongee dans le point.
import { html, tw, E, spring, show, lerp, prog, blip } from '../lib/motion.js';
import { C } from '../lib/motifs.js';

const WORD = ['F', 'e', 's', 't', 'ı', 'C', 'o', 'n', 'n', 'e', 'c', 't'];
const I_IDX = 4;
const TAGS = ['Billetterie', 'Boutique', 'Paiement mobile'];

export default {
  css: `
  .scene-logo { background: var(--nuit); }
  .lg-cam { position:absolute; inset:0; transform-origin: 0 0; }
  .lg-bg { position:absolute; inset:0; }
  .lg-word { position:absolute; left:0; right:0; top:372px; text-align:center; font-size: 232px; color: var(--creme); white-space:nowrap; }
  .lg-word .lt { display:inline-block; overflow:hidden; vertical-align: top; padding: .1em 0 .2em; margin: -.1em 0 -.2em; }
  .lg-word .lt > span { display:inline-block; }
  .lg-word .lt.i { overflow: visible; position: relative; margin: -.1em .035em -.2em .01em; }
  .lg-word .lt.i .stem { display:inline-block; }
  .lg-anchor { position:absolute; left:50%; width:0; height:0; }
  .lg-tags { position:absolute; left:0; right:0; top:690px; display:flex; justify-content:center; align-items:center; gap: 30px; font: 500 46px/1 var(--f-ui); color: var(--creme); letter-spacing: -.005em; }
  .lg-tag { display:inline-block; overflow:hidden; padding: .1em 0 .2em; }
  .lg-tag > span { display:inline-block; }
  .lg-sep { width:14px; height:14px; border-radius:50%; background: var(--orange); }
  .lg-svg { position:absolute; inset:0; }
  `,
  build(el, ctx) {
    const r = html(el, `
      <div class="lg-cam" data-k="cam">
        <svg class="lg-bg" width="1920" height="1080" viewBox="0 0 1920 1080">
          <defs><radialGradient id="lg-glow"><stop offset="0" stop-color="${C.orange}" stop-opacity=".32"/><stop offset="1" stop-color="${C.orange}" stop-opacity="0"/></radialGradient></defs>
          <circle data-k="glow" r="620" fill="url(#lg-glow)"/>
          <g data-k="rings" fill="none" stroke="${C.sable}" stroke-width="2">${Array.from({ length: 14 }, (_, i) => `<circle r="${120 + i * 70}" stroke-dasharray="${i % 3 === 0 ? '14 18' : 'none'}" opacity="${(0.16 - i * 0.009).toFixed(3)}"/>`).join('')}</g>
        </svg>
        <div class="lg-tags" data-k="tags">${TAGS.map((t, i) => `${i ? `<span class="lg-sep" data-k="sep${i}"></span>` : ''}<span class="lg-tag" data-k="tag${i}"><span>${t}</span></span>`).join('')}</div>
        <div class="lg-word display" data-k="word">${WORD.map((c, i) => i === I_IDX
          ? `<span class="lt i" data-k="li"><span class="stem" data-k="stem">${c}</span><span class="lg-anchor" data-k="anchor"></span></span>`
          : `<span class="lt"><span data-k="l${i}">${c}</span></span>`).join('')}</div>
        <svg class="lg-svg" width="1920" height="1080" viewBox="0 0 1920 1080">
          <circle data-k="rip0" fill="none" stroke="${C.orange}" stroke-width="3"/>
          <circle data-k="rip1" fill="none" stroke="${C.creme}" stroke-width="2"/>
          <circle data-k="dot" r="20" fill="${C.orange}"/>
        </svg>
      </div>`);
    // Mesure de la position du point du i (en coordonnees 1920x1080, independantes de l'echelle de sortie)
    const root = document.getElementById('root');
    const k = root.getBoundingClientRect().width / 1920;
    const rs = root.getBoundingClientRect();
    const b = r.stem.getBoundingClientRect();
    const fs = 232;
    const dot = { x: (b.left + b.width / 2 - rs.left) / k, y: (b.top - rs.top) / k + fs * 0.155, r: fs * 0.092 };
    // Centre des elements de la ligne de promesses, pour l'aspiration vers la pastille
    const tagPos = TAGS.map((_, i) => { const q = r[`tag${i}`].getBoundingClientRect(); return { x: (q.left + q.width / 2 - rs.left) / k, y: (q.top + q.height / 2 - rs.top) / k }; });
    const sepPos = [1, 2].map((i) => { const q = r[`sep${i}`].getBoundingClientRect(); return { x: (q.left + q.width / 2 - rs.left) / k, y: (q.top + q.height / 2 - rs.top) / k }; });
    ['glow', 'rings'].forEach((n) => r[n].setAttribute('transform', `translate(${dot.x} ${dot.y})`));
    return { r, dot, tagPos, sepPos };
  },

  update(s, lt, ctx, tg) {
    const { r, dot } = s;
    const tC = ctx.c('C1.contract');
    const tW = ctx.c('C1.word');
    const tP = ctx.c('C2.promise');
    const tD = ctx.c('C2.dive');
    const end = ctx.dur;

    // Contraction de l'aplat vers le point du i, avec petit rebond a l'atterrissage
    const land = tC + 0.62;
    let rad;
    if (lt < land) rad = lerp(1400, dot.r * 0.7, E.glisse(prog(lt, tC, land)));
    else rad = dot.r * (0.7 + 0.3 * spring(lt, land, 2.8, 8));
    const hop = lt > tW + 1 && lt < tP ? ctx.pulse(tg, 9) : 0;
    let dy = -hop * 14;
    // Aspiration des promesses : la pastille grossit a chaque absorption
    const absorb = [0, 1, 2].map((i) => prog(lt, tP + i * 0.18, tP + i * 0.18 + 0.42));
    rad *= 1 + 0.12 * absorb.reduce((a, v) => a + E.pop(v) * (v > 0.95 ? 1 : v), 0) / 3 + 0.25 * blip(lt, tP + 0.78, 0.05, 0.3);
    r.dot.setAttribute('cx', dot.x.toFixed(2));
    r.dot.setAttribute('cy', (dot.y + dy).toFixed(2));
    r.dot.setAttribute('r', rad.toFixed(2));

    // Ondes a l'atterrissage
    [0, 1].forEach((i) => {
      const c = r[`rip${i}`], age = lt - land - i * 0.08;
      if (age > 0 && age < 1.3) {
        c.style.visibility = 'visible';
        c.setAttribute('cx', dot.x); c.setAttribute('cy', dot.y);
        c.setAttribute('r', (dot.r + (i ? 260 : 420) * E.expo(age / 1.3)).toFixed(1));
        c.style.opacity = ((1 - age / 1.3) ** 2 * 0.9).toFixed(3);
      } else c.style.visibility = 'hidden';
    });

    // Lettres : du i vers l'exterieur
    const rise = (i) => {
      const d = Math.abs(i - I_IDX);
      return tw(lt, tW + d * 0.035, 0.6, 1.4, 0, E.festi);
    };
    r.stem.style.transform = `translateY(${rise(I_IDX) * 100}%)`;
    WORD.forEach((_, i) => { if (i !== I_IDX) r[`l${i}`].style.transform = `translateY(${rise(i) * 100}%)`; });

    // Promesses sur les temps, puis aspiration vers la pastille
    [0, 1, 2].forEach((i) => {
      const t0 = ctx.c(`C1.tag${i + 1}`);
      const inner = r[`tag${i}`].firstElementChild;
      inner.style.transform = `translateY(${tw(lt, t0, 0.45, 110, 0)}%)`;
      const a = E.glisse(absorb[i]);
      const p = s.tagPos[i];
      const tx = (dot.x - p.x) * a, ty = (dot.y - p.y) * a;
      r[`tag${i}`].style.transform = `translate(${tx}px, ${ty}px) scale(${1 - 0.95 * a})`;
      r[`tag${i}`].style.opacity = 1 - E.quart(prog(absorb[i], 0.25, 0.8));
      if (i > 0) {
        const sp = r[`sep${i}`];
        const sa = E.glisse(prog(lt, tP + (i - 0.5) * 0.18, tP + (i - 0.5) * 0.18 + 0.4));
        const q = s.sepPos[i - 1];
        sp.style.transform = `translate(${(dot.x - q.x) * sa}px, ${(dot.y - q.y) * sa}px) scale(${spring(lt, t0 - 0.25, 2.5, 7) * (1 - 0.9 * sa)})`;
        sp.style.opacity = 1 - E.quart(prog(sa, 0.5, 0.9));
      }
    });

    // Fond : anneaux et halo qui respirent
    show(r.glow, tw(lt, land, 0.8, 0, 1) * (0.8 + 0.2 * ctx.pulse(tg, 5)));
    r.rings.setAttribute('transform', `translate(${dot.x} ${dot.y}) rotate(${(lt * 6).toFixed(2)}) scale(${tw(lt, land, 1.6, 0.6, 1).toFixed(3)})`);
    show(r.rings, tw(lt, land, 1.0, 0, 1));

    // Plongee dans la pastille : zoom exponentiel centre sur le point, l'orange remplit le cadre
    const z = Math.pow(80, E.sortie(prog(lt, tD, end - 0.04)));
    r.cam.style.transform = `translate(${dot.x}px, ${dot.y}px) scale(${z}) translate(${-dot.x}px, ${-dot.y}px)`;
  },
};
