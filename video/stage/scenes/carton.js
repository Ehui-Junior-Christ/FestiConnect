// Carton d'animatic : remplace automatiquement toute sequence dont le module n'existe pas encore.
// Affiche plan, timecodes, description d'ecran et voix off, avec un indicateur de temps musicaux :
// l'animatic complet peut ainsi etre cale sur l'audio avant la production de chaque plan.
import { html, tw, E, prog, show } from '../lib/motion.js';
import { tile, C } from '../lib/motifs.js';

const tc = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(2).padStart(5, '0')}`;

export default {
  css: `
  .scene-carton { background: var(--nuit); }
  .ct-bg { position:absolute; right:-120px; top:-120px; opacity:.16; }
  .ct-head { position:absolute; left:150px; top:120px; display:flex; gap:28px; align-items:baseline; }
  .ct-id { font: 800 150px/0.9 var(--f-display); color: var(--orange); letter-spacing:-.04em; }
  .ct-title { font: 700 44px/1.1 var(--f-display); color: var(--creme); max-width: 900px; }
  .ct-tc { position:absolute; left:156px; top:300px; font: 500 24px/1 var(--f-mono); color: var(--sable); letter-spacing:.06em; }
  .ct-lbl { font: 700 18px/1 var(--f-mono); letter-spacing:.2em; color: var(--creme-45); margin-bottom: 16px; }
  .ct-screen { position:absolute; left:156px; top:380px; width:1100px; }
  .ct-screen p { margin:0; font: 400 32px/1.45 var(--f-ui); color: var(--creme-70); }
  .ct-vo { position:absolute; left:156px; top:640px; width:1500px; }
  .ct-vo p { margin:0; font: 700 50px/1.2 var(--f-display); letter-spacing:-.01em; color: rgba(247,242,234,.22); }
  .ct-vo .on { color: var(--creme); }
  .ct-beats { position:absolute; left:156px; bottom:110px; display:flex; gap:18px; align-items:center; }
  .ct-beat { width:22px; height:22px; border-radius:50%; border:2px solid var(--creme-45); }
  .ct-bar { font: 500 20px/1 var(--f-mono); color: var(--creme-45); letter-spacing:.1em; margin-left: 20px; }
  .ct-wm { position:absolute; right:150px; bottom:112px; font: 700 18px/1 var(--f-mono); letter-spacing:.24em; color: var(--creme-45); }
  .ct-prog { position:absolute; left:0; bottom:0; height:8px; background: var(--orange); }
  `,
  build(el, ctx) {
    const plans = ctx.seq.plans;
    const r = html(el, `
      <svg class="ct-bg" width="720" height="720" viewBox="0 0 720 720">${tile('cercles', C.orange, 'transparent', 0, 0, 360)}${tile('arcs', C.sable, 'transparent', 360, 0, 360)}${tile('grille', C.creme, 'transparent', 0, 360, 360)}${tile('chevrons', C.orange, 'transparent', 360, 360, 360)}</svg>
      <div class="ct-head"><div class="ct-id" data-k="id"></div><div class="ct-title" data-k="title"></div></div>
      <div class="ct-tc" data-k="tc"></div>
      <div class="ct-screen"><div class="ct-lbl">ECRAN</div><p data-k="screen"></p></div>
      <div class="ct-vo"><div class="ct-lbl">VOIX OFF</div><p data-k="vo"></p></div>
      <div class="ct-beats" data-k="beats">${'<div class="ct-beat"></div>'.repeat(ctx.tl.music.beatsPerBar || 4)}<div class="ct-bar" data-k="bar"></div></div>
      <div class="ct-wm">ANIMATIC - PLAN A PRODUIRE</div>
      <div class="ct-prog" data-k="prog"></div>`);
    return { r, plans, cur: null, words: [] };
  },
  update(s, lt, ctx, tg) {
    const { r } = s;
    const pl = s.plans.find((p) => tg >= p.start && tg < p.end) || s.plans[s.plans.length - 1];
    if (s.cur !== pl.id) {
      s.cur = pl.id;
      r.id.textContent = pl.id;
      r.title.textContent = ctx.seq.title;
      r.tc.textContent = `${tc(pl.start)}  >  ${tc(pl.end)}   (${(pl.end - pl.start).toFixed(2)} s)`;
      r.screen.textContent = pl.screen || '';
      r.vo.innerHTML = (pl.vo || '').split(' ').map((w) => `<span>${w}</span>`).join(' ');
      s.words = [...r.vo.querySelectorAll('span')];
    }
    const pt = tg - pl.start;
    const d = pl.end - pl.start;
    const enter = tw(pt, 0, 0.5, 40, 0, E.festi);
    r.id.style.transform = `translateY(${enter}px)`;
    show(r.id, tw(pt, 0, 0.3, 0, 1));
    // Surlignage progressif de la voix off (estimation 2,6 mots/s)
    const voT = pt - (pl.voAt || 0);
    const n = Math.floor(voT * 2.6);
    s.words.forEach((w, i) => w.classList.toggle('on', i < n));
    const b = ctx.beatIndex(tg);
    const bpb = ctx.tl.music.beatsPerBar || 4;
    [...r.beats.querySelectorAll('.ct-beat')].forEach((dot, i) => {
      const on = ((b % bpb) + bpb) % bpb === i;
      const p = on ? ctx.pulse(tg, 5) : 0;
      dot.style.background = on ? C.orange : 'transparent';
      dot.style.borderColor = on ? C.orange : 'rgba(247,242,234,.45)';
      dot.style.transform = `scale(${1 + p * 0.5})`;
    });
    r.bar.textContent = `MESURE ${Math.floor(b / bpb) + 1}`;
    r.prog.style.width = `${prog(pt, 0, d) * 100}%`;
  },
};
