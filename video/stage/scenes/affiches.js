// Sequence B - La fete sous toutes ses formes
// B1 : un mot par temps fort, chacun sur un panneau de trame (le panneau entre en biais juste avant le temps).
// B2 : trois affiches en eventail, la question mot a mot, puis l'iris orange couvre le cadre (raccord avec le logo).
import { html, tw, E, spring, show, lerp, prog, splitChars, revealChars, xof } from '../lib/motion.js';
import { C, tile, art } from '../lib/motifs.js';

const WORDS = [
  { w: 'Concerts', bg: C.orange, fg: '#E8531A', tile: 'cercles', ink: C.nuit, dot: C.creme },
  { w: 'Festivals', bg: C.sable, fg: '#F5BE62', tile: 'tirets', ink: C.nuit, dot: C.orange },
  { w: 'Maquis', bg: C.nuit, fg: '#231915', tile: 'grille', ink: C.creme, dot: C.orange },
  { w: 'Défilés', bg: C.creme, fg: '#EDE3D3', tile: 'chevrons', ink: C.nuit, dot: C.orange },
];
const QUESTION = ['Où ?', 'Quand ?', 'Comment ?'];

export default {
  css: `
  .scene-affiches { background: var(--nuit); }
  .af-panel { position:absolute; inset:0; overflow:hidden; }
  .af-panel svg.pat { position:absolute; left:-200px; top:-200px; }
  .af-word { position:absolute; left:140px; top:330px; font-size: 330px; white-space:nowrap; }
  .af-idx { position:absolute; left:152px; top:250px; font: 700 26px/1 var(--f-mono); letter-spacing:.2em; }
  .af-b2 { position:absolute; inset:0; background: var(--nuit); }
  .af-q { position:absolute; left:0; right:0; top:120px; text-align:center; font-size: 120px; color: var(--creme); white-space:nowrap; }
  .af-q .qw { display:inline-block; margin: 0 .16em; }
  .af-q .qw:last-child { color: var(--orange); }
  .af-card { position:absolute; left:50%; top:380px; width:440px; height:580px; margin-left:-220px; border-radius:28px; overflow:hidden; background: var(--nuit-2); box-shadow: 0 40px 90px rgba(0,0,0,.55), 0 0 0 1px rgba(247,242,234,.08); transform-origin: 50% 120%; }
  .af-card .art { height:340px; }
  .af-card .art svg { width:100%; height:100%; display:block; }
  .af-card .bd { padding: 26px 28px; }
  .af-card .cat { font: 700 15px/1 var(--f-mono); letter-spacing:.16em; color: var(--orange); text-transform: uppercase; }
  .af-card .ti { margin-top:14px; font: 800 40px/1 var(--f-display); letter-spacing:-.03em; color: var(--creme); }
  .af-card .me { margin-top:14px; font: 400 18px/1 var(--f-ui); color: var(--creme-70); }
  .af-iris { position:absolute; inset:0; }
  `,
  build(el, ctx) {
    const ev = ctx.content.events.slice(0, 3);
    const pat = (w) => {
      let s = '';
      for (let y = 0; y < 6; y++) for (let x = 0; x < 10; x++) s += tile(w.tile, w.fg, w.bg, x * 250, y * 250, 250);
      return `<svg class="pat" width="2500" height="1500" viewBox="0 0 2500 1500">${s}</svg>`;
    };
    const r = html(el, `
      <div class="af-b2" data-k="b2">
        <div class="af-q display" data-k="q">${QUESTION.map((q, i) => `<span class="qw" data-k="q${i}"><span class="line">${splitChars(q)}</span></span>`).join('')}</div>
        ${ev.map((e, i) => `<div class="af-card" data-k="card${i}"><div class="art">${art(e.art)}</div><div class="bd"><div class="cat">${e.category} · ${e.city}</div><div class="ti">${e.title}</div><div class="me">${e.dateLong} · dès ${xof(e.price)} F</div></div></div>`).join('')}
      </div>
      ${WORDS.map((w, i) => `<div class="af-panel" data-k="p${i}" style="background:${w.bg}">${pat(w)}
        <div class="af-idx" style="color:${w.ink}">0${i + 1} / 04</div>
        <div class="af-word display" data-k="w${i}" style="color:${w.ink}"><span class="line">${splitChars(w.w).replace(/<\/span><\/span>$/, `<span class="ch" style="color:${w.dot}">.</span></span></span>`)}</span></div>
      </div>`).join('')}
      <svg class="af-iris" width="1920" height="1080" viewBox="0 0 1920 1080"><circle data-k="iris" cx="960" cy="560" r="0" fill="${C.orange}"/></svg>`);
    return { r };
  },

  update(s, lt, ctx, tg) {
    const { r } = s;
    const b2 = ctx.p('B2');

    // B1 : panneaux en biais, le mot claque sur le temps
    WORDS.forEach((w, i) => {
      const t0 = ctx.c(`B1.w${i + 1}`);
      const next = i < 3 ? ctx.c(`B1.w${i + 2}`) : b2.s;
      const p = r[`p${i}`];
      const vis = lt >= t0 - 0.2 && lt < next + 0.02;
      p.style.display = vis ? 'block' : 'none';
      if (!vis) return;
      // Entree en biais : le bord d'attaque (12 degres) balaie de droite a gauche et arrive sur le temps
      const u = i === 0 ? 1 : E.glisse(prog(lt, t0 - 0.2, t0));
      const x = lerp(2300, -300, u);
      p.style.clipPath = `polygon(${x}px 0, 2400px 0, 2400px 1080px, ${x - 230}px 1080px)`;
      const pat = p.querySelector('svg.pat');
      pat.style.transform = `translate(${(-(lt - t0) * 60).toFixed(1)}px, ${((lt - t0) * 25).toFixed(1)}px)`;
      revealChars(r[`w${i}`], lt, t0 - 0.08, { stagger: 0.022, dur: 0.45, dist: 1.1 });
      const punch = tw(lt, t0, next - t0, 1.07, 1, E.quart);
      r[`w${i}`].style.transform = `scale(${punch})`;
      r[`w${i}`].style.transformOrigin = '0 60%';
    });

    // B2 : affiches en eventail sur les temps
    const inB2 = lt >= b2.s - 0.2;
    r.b2.style.display = inB2 ? 'block' : 'none';
    if (!inB2) return;
    const fan = [-470, 0, 470], rot = [-9, 0, 9];
    const tIris = ctx.c('B2.iris');
    const away = E.sortie(prog(lt, tIris, ctx.dur));
    [0, 1, 2].forEach((i) => {
      const t0 = ctx.c(`B2.p${i + 1}`);
      const a = lt >= t0 ? spring(lt, t0, 1.6, 6) : 0;
      const drift = (lt - t0) * (i - 1) * 8;
      const card = r[`card${i}`];
      card.style.transform = `translate(${fan[i] * a + drift}px, ${lerp(700, 0, Math.min(a, 1.2))}px) rotate(${rot[i] * a + (i - 1) * 0.6 * (lt - t0)}deg) scale(${(i === 1 ? 1.06 : 1) * (1 - 0.25 * away)})`;
      card.style.zIndex = i === 1 ? 3 : 2;
      show(card, lt >= t0 - 0.05 ? 1 : 0);
    });
    QUESTION.forEach((_, i) => {
      const t0 = ctx.c('B2.question') + i * ctx.beat;
      revealChars(r[`q${i}`], lt, t0, { stagger: 0.03, dur: 0.45 });
    });
    // Iris : l'orange grandit depuis le centre et couvre tout le cadre a la fin de B2
    const ir = E.sortie(prog(lt, tIris, ctx.dur - 0.02));
    r.iris.setAttribute('r', (ir * 1150).toFixed(1));
    show(r.iris, ir > 0 ? 1 : 0);
  },
};
