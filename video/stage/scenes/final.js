// Sequence H - Final
// H1 (optionnel) : triptyque Trouve. / Paie. / Entre., un mot par temps fort sur panneaux de trame.
// H2 : carton final. La pastille tombe sur le i, le logo se reforme, URL + signature,
//      puis tout s'eteint sauf la pastille qui se referme : le point final.
import { html, tw, E, spring, show, lerp, prog, splitChars, revealChars } from '../lib/motion.js';
import { C, tile } from '../lib/motifs.js';

const WORD = ['F', 'e', 's', 't', 'ı', 'C', 'o', 'n', 'n', 'e', 'c', 't'];
const I_IDX = 4;
const TRIO = [
  { w: 'Trouve', bg: C.orange, fg: '#E8531A', tile: 'cercles', ink: C.nuit, dot: C.creme },
  { w: 'Paie', bg: C.nuit, fg: '#231915', tile: 'grille', ink: C.creme, dot: C.orange },
  { w: 'Entre', bg: C.sable, fg: '#F5BE62', tile: 'tirets', ink: C.nuit, dot: C.orange },
];

export default {
  css: `
  .scene-final { background: var(--nuit); }
  .fn-panel { position:absolute; inset:0; overflow:hidden; }
  .fn-panel svg.pat { position:absolute; left:-200px; top:-200px; }
  .fn-word { position:absolute; left:0; right:0; top:360px; text-align:center; font-size: 340px; white-space:nowrap; }
  .fn-end { position:absolute; inset:0; background: var(--nuit); }
  .fn-bg { position:absolute; inset:0; }
  .fn-mark { position:absolute; left:0; right:0; top:330px; text-align:center; font-size: 210px; color: var(--creme); white-space:nowrap; }
  .fn-mark .lt { display:inline-block; overflow:hidden; vertical-align: top; padding: .1em 0 .2em; margin: -.1em 0 -.2em; }
  .fn-mark .lt > span { display:inline-block; }
  .fn-mark .lt.i { overflow: visible; margin: -.1em .035em -.2em .01em; }
  .fn-sign { position:absolute; left:0; right:0; top:640px; text-align:center; font: 600 58px/1 var(--f-ui); color: var(--creme); letter-spacing:-.01em; }
  .fn-url { position:absolute; left:0; right:0; top:860px; text-align:center; font: 500 30px/1 var(--f-mono); letter-spacing:.14em; color: var(--sable); }
  .fn-svg { position:absolute; inset:0; }
  .fn-black { position:absolute; inset:0; background:#000; }
  `,
  build(el, ctx) {
    const hasH1 = ctx.seq.plans.some((p) => p.id === 'H1');
    const pat = (w) => {
      let s = '';
      for (let y = 0; y < 6; y++) for (let x = 0; x < 10; x++) s += tile(w.tile, w.fg, w.bg, x * 250, y * 250, 250);
      return `<svg class="pat" width="2500" height="1500" viewBox="0 0 2500 1500">${s}</svg>`;
    };
    const r = html(el, `
      <div class="fn-end" data-k="end">
        <svg class="fn-bg" width="1920" height="1080" viewBox="0 0 1920 1080">
          <defs><radialGradient id="fn-glow"><stop offset="0" stop-color="${C.orange}" stop-opacity=".3"/><stop offset="1" stop-color="${C.orange}" stop-opacity="0"/></radialGradient></defs>
          <circle data-k="glow" r="640" fill="url(#fn-glow)"/>
          <g data-k="rings" fill="none" stroke="${C.sable}" stroke-width="2">${Array.from({ length: 14 }, (_, i) => `<circle r="${120 + i * 70}" stroke-dasharray="${i % 3 === 0 ? '14 18' : 'none'}" opacity="${(0.15 - i * 0.009).toFixed(3)}"/>`).join('')}</g>
        </svg>
        <div class="fn-mark display" data-k="mark">${WORD.map((c, i) => i === I_IDX
          ? `<span class="lt i"><span data-k="stem">${c}</span></span>`
          : `<span class="lt"><span data-k="l${i}">${c}</span></span>`).join('')}</div>
        <div class="fn-sign" data-k="sign"><span class="line">${splitChars('On est ensemble.')}</span></div>
        <div class="fn-url" data-k="url">${ctx.content.brand.url}</div>
        <div class="fn-black" data-k="black"></div>
        <svg class="fn-svg" width="1920" height="1080" viewBox="0 0 1920 1080">
          <circle data-k="rip" fill="none" stroke="${C.orange}" stroke-width="3"/>
          <circle data-k="dot" r="20" fill="${C.orange}"/>
        </svg>
      </div>
      ${hasH1 ? TRIO.map((w, i) => `<div class="fn-panel" data-k="p${i}" style="background:${w.bg}">${pat(w)}
        <div class="fn-word display" data-k="w${i}" style="color:${w.ink}"><span class="line">${splitChars(w.w).replace(/<\/span><\/span>$/, `<span class="ch" style="color:${w.dot}">.</span></span></span>`)}</span></div></div>`).join('') : ''}`);
    const root = document.getElementById('root').getBoundingClientRect();
    const k = root.width / 1920;
    const b = r.stem.getBoundingClientRect();
    const fs = 210;
    const dot = { x: (b.left + b.width / 2 - root.left) / k, y: (b.top - root.top) / k + fs * 0.155, r: fs * 0.092 };
    ['glow', 'rings'].forEach((n) => r[n].setAttribute('transform', `translate(${dot.x} ${dot.y})`));
    return { r, hasH1, dot };
  },

  update(s, lt, ctx, tg) {
    const { r, dot } = s;
    const h2 = ctx.p('H2');

    // H1 : triptyque
    if (s.hasH1) {
      const h1 = ctx.p('H1');
      TRIO.forEach((w, i) => {
        const t0 = ctx.c(`H1.w${i + 1}`, i * 1.0);
        const next = i < 2 ? ctx.c(`H1.w${i + 2}`, (i + 1) * 1.0) : h1.e;
        const p = r[`p${i}`];
        const vis = lt >= t0 - 0.2 && lt < next;
        p.style.display = vis ? 'block' : 'none';
        if (!vis) return;
        const u = i === 0 ? E.glisse(prog(lt, t0 - 0.2, t0)) : E.glisse(prog(lt, t0 - 0.2, t0));
        const x = lerp(2300, -300, u);
        p.style.clipPath = `polygon(${x}px 0, 2400px 0, 2400px 1080px, ${x - 230}px 1080px)`;
        p.querySelector('svg.pat').style.transform = `translate(${(-(lt - t0) * 60).toFixed(1)}px, ${((lt - t0) * 25).toFixed(1)}px)`;
        revealChars(r[`w${i}`], lt, t0 - 0.08, { stagger: 0.03, dur: 0.45, dist: 1.1 });
        r[`w${i}`].style.transform = `scale(${tw(lt, t0, next - t0, 1.08, 1, E.quart)})`;
      });
    }

    // H2 : carton final
    const tLogo = ctx.c('H2.logo', 0);
    const tUrl = ctx.c('H2.url', 1.0);
    const tSign = ctx.c('H2.sign', 1.5);
    const tFade = ctx.c('H2.fade', h2.d - 1.2);
    r.end.style.display = lt >= h2.s - 0.3 ? 'block' : 'none';
    // La pastille tombe du haut et rebondit sur le i
    const fall = E.sortie(prog(lt, tLogo, tLogo + 0.4));
    const bounce = lt > tLogo + 0.4 ? spring(lt, tLogo + 0.4, 2.8, 7) : 0;
    let y = lt < tLogo + 0.4 ? lerp(-60, dot.y, fall) : dot.y - 26 * (1 - bounce) * Math.max(0, Math.sin(Math.PI * Math.min(1, (lt - tLogo - 0.4) / 0.35)));
    let rad = dot.r * (lt < tLogo ? 0 : 1);
    // Point final : la pastille grossit un instant puis se referme
    const close = prog(lt, h2.e - 0.55, h2.e - 0.05);
    rad *= (1 + 0.5 * Math.sin(Math.PI * Math.min(1, close * 2)) * (close < 0.5 ? 1 : 0)) * (1 - E.sortie(prog(close, 0.4, 1)));
    // Pendant l'extinction, la pastille glisse au centre du cadre
    const mv = E.glisse(prog(lt, tFade, tFade + 0.7));
    r.dot.setAttribute('cx', lerp(dot.x, 960, mv).toFixed(2)); r.dot.setAttribute('cy', lerp(y, 540, mv).toFixed(2)); r.dot.setAttribute('r', Math.max(0, rad).toFixed(2));
    const age = lt - tLogo - 0.4;
    if (age > 0 && age < 1.2) { r.rip.style.visibility = 'visible'; r.rip.setAttribute('cx', dot.x); r.rip.setAttribute('cy', dot.y); r.rip.setAttribute('r', (dot.r + 380 * E.expo(age / 1.2)).toFixed(1)); r.rip.style.opacity = ((1 - age / 1.2) ** 2).toFixed(3); }
    else r.rip.style.visibility = 'hidden';
    WORD.forEach((_, i) => {
      const d = Math.abs(i - I_IDX);
      const v = tw(lt, tLogo + 0.3 + d * 0.03, 0.6, 1.4, 0, E.festi);
      (i === I_IDX ? r.stem : r[`l${i}`]).style.transform = `translateY(${v * 100}%)`;
    });
    revealChars(r.sign, lt, tSign, { stagger: 0.025, dur: 0.5 });
    show(r.url, tw(lt, tUrl, 0.5, 0, 1));
    r.url.style.transform = `translateY(${tw(lt, tUrl, 0.6, 20, 0)}px)`;
    show(r.glow, tw(lt, tLogo + 0.4, 0.8, 0, 1) * (0.8 + 0.2 * ctx.pulse(tg, 5)));
    r.rings.setAttribute('transform', `translate(${dot.x} ${dot.y}) rotate(${(lt * 5).toFixed(2)})`);
    show(r.rings, tw(lt, tLogo + 0.4, 1.0, 0, 1));
    // Extinction : tout passe au noir, sauf la pastille (au-dessus du noir)
    show(r.black, E.glisse(prog(lt, tFade, tFade + 0.5)));
  },
};
