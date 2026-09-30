// Sequence F - Espace organisateur (ordinateur, pour marquer le changement de role)
// F1 : carton "Tu organises ?" puis formulaire qui se remplit un champ par temps, apercu d'affiche, Soumettre.
// F2 : ventes en direct (compteurs, histogramme une barre par temps, fil de ventes sur les temps).
// F3 : retrait vers Wave : le bouton se resserre en pastille, coche verte, la pastille part hors cadre.
// Les plans F1 et F3 sont optionnels (la version courte n'a que F2).
import { html, tw, E, spring, show, lerp, prog, blip, xof, splitChars, revealChars } from '../lib/motion.js';
import { C, icon, art, tile } from '../lib/motifs.js';
import { captionCSS, captionMarkup, updateCaption, deskCSS, deskMarkup, localCenter, updateTap, winTransform } from '../lib/ui.js';

const STEPS = {
  F1: { step: 'ORGANISATEUR · 01 / 03', verb: 'Crée', sub: 'Un événement en quelques minutes.' },
  F2: { step: 'ORGANISATEUR · 02 / 03', verb: 'Vends', sub: 'Tes ventes, en direct.' },
  F3: { step: 'ORGANISATEUR · 03 / 03', verb: 'Encaisse', sub: 'Tes recettes, sur mobile money.' },
};
const BARS = [0.34, 0.5, 0.42, 0.63, 0.55, 0.8, 0.7, 1];
const FEED = [
  { q: '+2 billets', m: 'Wave', c: '#1DC4F2' },
  { q: '+1 billet', m: 'Orange Money', c: '#FF7A00' },
  { q: '+4 billets', m: 'Moov Money', c: '#0A5EB0' },
];

const css = `
.scene-organisateur { background: var(--nuit); }
.of-bg { position:absolute; inset:0; }
.of-switch { position:absolute; inset:0; background: var(--sable); overflow:hidden; }
.of-switch svg { position:absolute; left:-100px; top:-100px; }
.of-sw-word { position:absolute; left:0; right:0; top:390px; text-align:center; font-size: 200px; color: var(--nuit); white-space:nowrap; }
.of-field { position:absolute; left:34px; width:400px; }
.of-field .box { margin-top:8px; height:44px; border-radius:12px; background:#1E1714; border:1.5px solid rgba(247,242,234,.08); display:flex; align-items:center; padding:0 14px; font-size:15px; white-space:nowrap; overflow:hidden; }
.of-field .box.on { border-color: var(--orange); }
.of-caret { display:inline-block; width:2px; height:18px; background: var(--orange); margin-left:2px; vertical-align:-3px; }
.of-prev { left:462px; top:118px; width:274px; height:442px; overflow:hidden; }
.of-prev .pa { height:168px; }
.of-prev .pa svg { width:100%; height:100%; display:block; }
.of-prev .pb { padding:16px 18px; }
.of-prev .pt { margin-top:12px; font: 800 22px/1.05 var(--f-display); letter-spacing:-.02em; min-height:46px; }
.of-prev .row { display:flex; gap:8px; align-items:center; font-size:13px; color: var(--creme-70); margin-top:10px; white-space:nowrap; }
.of-prev .row .ic { color: var(--orange); flex:none; }
.of-kpi { top:136px; width:220px; height:120px; padding:18px; }
.of-kpi .v { margin-top:14px; font: 800 34px/1 var(--f-display); letter-spacing:-.02em; white-space:nowrap; }
.of-kpi .v small { font: 600 16px/1 var(--f-ui); color: var(--creme-45); letter-spacing:0; }
.of-kpi .m { margin-top:16px; font: 700 21px/1 var(--f-mono); color: var(--sable); white-space:nowrap; }
.of-bar { height:6px; border-radius:3px; background: rgba(247,242,234,.1); margin-top:12px; overflow:hidden; }
.of-bar i { display:block; height:100%; width:0; background: linear-gradient(90deg, var(--or), var(--orange)); }
.of-chart { left:34px; top:276px; width:452px; height:384px; padding:18px; }
.of-bars { position:absolute; left:22px; right:22px; bottom:44px; height:250px; display:flex; align-items:flex-end; gap:14px; }
.of-bars i { flex:1; display:block; border-radius:8px 8px 3px 3px; background: linear-gradient(180deg, var(--orange), #B8401A); transform-origin: 50% 100%; }
.of-bars i:last-child { background: linear-gradient(180deg, var(--sable), var(--orange)); }
.of-days { position:absolute; left:22px; right:22px; bottom:16px; display:flex; gap:14px; font: 500 11px/1 var(--f-mono); color: var(--creme-45); }
.of-days span { flex:1; text-align:center; }
.of-feed { left:502px; top:276px; width:234px; height:384px; padding:18px; overflow:hidden; }
.of-live { display:flex; align-items:center; gap:8px; }
.of-live b { width:10px; height:10px; border-radius:50%; background: var(--orange); display:block; }
.of-fr { position:absolute; left:14px; right:14px; height:72px; border-radius:14px; background:#221A16; display:flex; align-items:center; gap:12px; padding:0 12px; }
.of-fr .sq { width:34px; height:34px; border-radius:10px; display:grid; place-items:center; color:#fff; flex:none; }
.of-fr b { display:block; font-size:15px; }
.of-fr span { font-size:12px; color: var(--creme-45); }
.of-bal { left:34px; top:124px; width:702px; height:180px; padding:24px 28px; }
.of-bal .amt { margin-top:22px; font: 800 64px/1 var(--f-display); letter-spacing:-.03em; color: var(--sable); white-space:nowrap; }
.of-dest { left:34px; top:322px; width:702px; height:86px; display:flex; align-items:center; gap:16px; padding: 0 22px; }
.of-dest .sq { width:46px; height:46px; border-radius:14px; background:#1DC4F2; display:grid; place-items:center; color:#fff; }
.of-dest .num { font: 600 15px/1 var(--f-mono); color: var(--creme-70); margin-top:6px; }
.of-dest .ver { margin-left:auto; display:flex; gap:6px; align-items:center; font-size:13px; color: var(--creme-45); }
.of-pay .dots { position:absolute; display:flex; gap:8px; }
.of-pay .dots i { width:10px; height:10px; border-radius:50%; background: var(--nuit); display:block; }
.of-ok { position:absolute; width:64px; height:64px; border-radius:50%; background: var(--vert); display:grid; place-items:center; box-shadow: 0 0 60px rgba(46,224,122,.4); }
.of-sent { position:absolute; left:0; right:0; top:516px; text-align:center; }
.of-sent h4 { margin:0; font: 800 28px/1 var(--f-display); letter-spacing:-.02em; }
.of-sent p { margin:10px 0 0; font: 600 15px/1 var(--f-mono); color: var(--sable); }
.of-fly { position:absolute; width:30px; height:30px; margin:-15px 0 0 -15px; border-radius:50%; background: var(--orange); box-shadow: 0 0 40px rgba(255,95,31,.8); }
${captionCSS}
${deskCSS}
`;

export default {
  css,
  build(el, ctx) {
    const c = ctx.content;
    const ev = c.events.find((e) => e.id === 'maquis');
    const has = (id) => ctx.seq.plans.some((p) => p.id === id);
    const planIds = ['F1', 'F2', 'F3'].filter(has);
    const fields = [
      { l: 'Titre', v: ev.title },
      { l: 'Lieu', v: `${ev.venue}, ${ev.city}` },
      { l: 'Date et heure', v: `${ev.dateLong} · ${ev.time}` },
      { l: 'Prix du billet', v: `${xof(ev.price)} F` },
      { l: 'Places', v: String(ev.capacity) },
    ];
    const vCreate = `<div class="dk-view" data-k="v0">
      <div class="dk-crumb">Événements / Nouveau</div><div class="dk-h">Nouvel événement</div>
      ${fields.map((f, i) => `<div class="of-field" style="top:${118 + i * 78}px"><div class="dk-lbl">${f.l}</div><div class="box" data-k="box${i}"><span data-k="fv${i}"></span></div></div>`).join('')}
      <div class="dk-btn" data-k="submit" style="left:34px;top:520px;width:400px">${icon('send', 18, 'currentColor', 2.4)}<span data-k="submitT">Soumettre pour validation</span></div>
      <div class="dk-card of-prev" data-k="prev"><div class="pa" data-k="prevArt">${art(ev.art)}</div><div class="pb">
        <span class="dk-pill p-draft" data-k="pill">Brouillon</span>
        <div class="pt" data-k="prevT"></div>
        <div class="row" data-k="pr1">${icon('pin', 15)}${ev.venue}</div>
        <div class="row" data-k="pr2">${icon('calendar', 15)}${ev.dateShort} · ${ev.time}</div>
        <div class="row" data-k="pr3">${icon('ticket', 15)}${xof(ev.price)} F · ${ev.capacity} places</div>
      </div></div>
    </div>`;
    const vSales = `<div class="dk-view" data-k="v1">
      <div class="dk-crumb">Événements / Ventes</div><div class="dk-h">${ev.title}</div>
      <div style="margin-top:8px;font-size:14px;color:var(--creme-45)">${ev.dateLong} · ${ev.venue}</div>
      <div class="dk-btn ghost" style="left:520px;top:34px;width:216px;height:44px;font-size:14px">${icon('wallet', 17)}Retirer vers Wave</div>
      <div class="dk-card of-kpi" style="left:34px"><div class="dk-lbl">Billets vendus</div><div class="v"><span data-k="k1">0</span> <small>/ ${ev.capacity}</small></div><div class="of-bar"><i data-k="k1b"></i></div></div>
      <div class="dk-card of-kpi" style="left:275px"><div class="dk-lbl">Recettes</div><div class="m" data-k="k2">0 F</div><div style="margin-top:14px;font-size:12px;color:var(--creme-45)">${xof(ev.price)} F par billet</div></div>
      <div class="dk-card of-kpi" style="left:516px"><div class="dk-lbl">Remplissage</div>
        <svg width="56" height="56" viewBox="0 0 56 56" style="position:absolute;right:18px;bottom:16px"><circle cx="28" cy="28" r="22" fill="none" stroke="rgba(247,242,234,.1)" stroke-width="7"/><circle data-k="ring" cx="28" cy="28" r="22" fill="none" stroke="${C.orange}" stroke-width="7" stroke-linecap="round" pathLength="100" stroke-dasharray="0 100" transform="rotate(-90 28 28)"/></svg>
        <div class="v" data-k="k3">0 %</div></div>
      <div class="dk-card of-chart"><div class="dk-lbl">Ventes par jour</div>
        <div class="of-bars">${BARS.map((_, i) => `<i data-k="bar${i}"></i>`).join('')}</div>
        <div class="of-days">${['14', '15', '16', '17', '18', '19', '20', '21'].map((d) => `<span>${d}/06</span>`).join('')}</div></div>
      <div class="dk-card of-feed"><div class="of-live"><b data-k="live"></b><span class="dk-lbl" style="color:var(--creme)">En direct</span></div>
        ${FEED.map((f, i) => `<div class="of-fr" data-k="fr${i}"><span class="sq" style="background:${f.c}">${icon('wallet', 17, '#fff')}</span><div><b>${f.q}</b><span>${f.m}</span></div></div>`).join('')}</div>
    </div>`;
    const vPay = `<div class="dk-view" data-k="v2">
      <div class="dk-crumb">Retraits</div><div class="dk-h">Retirer mes recettes</div>
      <div class="dk-card of-bal"><div class="dk-lbl">Recettes de la vente · ${ev.title}</div><div class="amt">${xof(ev.price * ev.sold)} F</div></div>
      <div class="dk-card of-dest"><span class="sq">${icon('wallet', 22, '#fff')}</span><div><div style="font-weight:700;font-size:17px">Wave</div><div class="num">+225 05 •• •• •• 02</div></div><span class="ver">${icon('shield', 16)}Compte vérifié</span></div>
      <div class="dk-btn of-pay" data-k="pay" style="left:34px;top:430px;width:702px;height:62px"><span data-k="payT">${icon('wallet', 19)}&nbsp;Retirer vers Wave</span><span class="dots" data-k="dots"><i></i><i></i><i></i></span></div>
      <div class="of-ok" data-k="ok" style="left:${34 + 351 - 32}px;top:${430 - 1}px"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#0D0B0A" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path data-k="okp" d="M20 6 9 17l-5-5" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"/></svg></div>
      <div class="of-sent" data-k="sent"><h4>Retrait envoyé</h4><p>${xof(ev.price * ev.sold)} F vers Wave</p></div>
    </div>`;
    const r = html(el, `
      <svg class="of-bg" width="1920" height="1080" viewBox="0 0 1920 1080">
        <defs><radialGradient id="of-glow"><stop offset="0" stop-color="${C.orange}" stop-opacity=".24"/><stop offset="1" stop-color="${C.orange}" stop-opacity="0"/></radialGradient></defs>
        <circle data-k="glow" cx="1340" cy="530" r="760" fill="url(#of-glow)"/>
        <g data-k="rings" fill="none" stroke="${C.sable}">${Array.from({ length: 10 }, (_, i) => `<circle r="${420 + i * 70}" stroke-width="2" opacity="${(0.1 - i * 0.008).toFixed(3)}" stroke-dasharray="${i % 3 === 0 ? '3 22' : 'none'}"/>`).join('')}</g>
      </svg>
      ${captionMarkup(planIds.map((id) => STEPS[id]), { size: 150, segs: planIds.length > 1 })}
      <div class="dk-persp">${deskMarkup({
        url: 'festiconnect.ci/organisateur',
        nav: [{ key: 'dash', icon: 'home', label: 'Tableau de bord' }, { key: 'events', icon: 'calendar', label: 'Événements' }, { key: 'sales', icon: 'chart', label: 'Ventes' }, { key: 'payouts', icon: 'wallet', label: 'Retraits' }],
        org: { initials: 'CN', name: c.organizer.name },
        views: vCreate + vSales + vPay,
      })}</div>
      <div class="of-fly" data-k="fly"></div>
      ${has('F1') ? `<div class="of-switch" data-k="sw"><svg width="2200" height="1300" viewBox="0 0 2200 1300">${Array.from({ length: 6 }, (_, y) => Array.from({ length: 10 }, (_, x) => tile('tirets', '#F5BE62', C.sable, x * 220, y * 220, 220)).join('')).join('')}</svg>
        <div class="of-sw-word display" data-k="swWord"><span class="line">${splitChars('Tu organises ?')}</span></div></div>` : ''}`);
    const taps = { submit: localCenter(r.win, r.submit), pay: localCenter(r.win, r.pay) };
    return { r, taps, planIds, has, fields };
  },

  update(s, lt, ctx, tg) {
    const { r, has } = s;
    const P = (id) => ctx.p(id);
    const cue = (n, d) => ctx.c(n, d);
    const f2 = P('F2');
    const start = has('F1') ? P('F1').s : f2.s;
    const end = ctx.dur;

    // Fond
    r.rings.setAttribute('transform', `translate(1340 530) rotate(${(lt * 4).toFixed(2)}) scale(${(1 + 0.012 * ctx.pulse(tg, 5, 4)).toFixed(4)})`);
    show(r.glow, 0.75 + 0.25 * ctx.pulse(tg, 4));

    // Carton de bascule "Tu organises ?" (coupe sur le temps, sortie en biais)
    let tReveal = start;
    if (has('F1')) {
      const tSw = cue('F1.switch');
      tReveal = cue('F1.reveal');
      revealChars(r.swWord, lt, tSw, { stagger: 0.03, dur: 0.45, dist: 1.1 });
      r.swWord.style.transform = `scale(${tw(lt, tSw, tReveal - tSw, 1.06, 1, E.quart)})`;
      const u = E.glisse(prog(lt, tReveal - 0.05, tReveal + 0.3));
      const x = lerp(2400, -300, u);
      r.sw.style.clipPath = `polygon(-300px 0, ${x}px 0, ${x - 230}px 1080px, -300px 1080px)`;
      r.sw.style.display = u >= 1 ? 'none' : 'block';
    }

    // Legendes
    updateCaption(r, lt, s.planIds.map((id, i) => ({
      tin: i === 0 ? (has('F1') ? tReveal + 0.1 : P(id).s + 0.1) : P(id).s,
      tout: i === s.planIds.length - 1 ? end - 0.1 : P(id).e,
    })));

    // Fenetre
    const uIn = has('F1') ? 1 : E.festi(prog(lt, f2.s, f2.s + 0.7));
    const tFly = has('F3') ? cue('F3.fly') : null;
    const uOut = E.sortie(prog(lt, has('F3') ? tFly + 0.25 : end - 0.4, end));
    const settle = has('F1') ? tw(lt, tReveal, 0.9, 1.05, 1) : 1;
    r.win.style.transform = `${winTransform(lt, uIn, uOut)} scale(${settle})`;
    show(r.win, 1 - prog(uOut, 0.7, 1));

    // Vues : creation -> ventes -> retrait (glissement vertical)
    const vStart = [has('F1') ? -1 : null, has('F1') ? cue('F2.push') : -1, has('F3') ? cue('F3.push') : null];
    [0, 1, 2].forEach((i) => {
      const v = r[`v${i}`];
      if (vStart[i] === null) { v.style.display = 'none'; return; }
      const next = vStart.slice(i + 1).find((x) => x !== null);
      const a = vStart[i] < 0 ? 1 : E.glisse(prog(lt, vStart[i] - 0.2, vStart[i] + 0.3));
      const b = next !== undefined ? E.glisse(prog(lt, next - 0.2, next + 0.3)) : 0;
      v.style.display = a > 0 && b < 1 ? 'block' : 'none';
      v.style.opacity = a * (1 - b);
      v.style.transform = `translateY(${(1 - a) * 70 - b * 50}px)`;
    });
    const active = lt >= (vStart[2] ?? 1e9) - 0.05 ? 'payouts' : lt >= (vStart[1] ?? 1e9) - 0.05 && vStart[1] >= 0 ? 'sales' : has('F1') ? 'events' : 'sales';
    ['dash', 'events', 'sales', 'payouts'].forEach((k) => r[`nav_${k}`].classList.toggle('on', k === active));

    const taps = [];
    // F1 : formulaire
    if (has('F1')) {
      s.fields.forEach((f, i) => {
        const t0 = cue(`F1.f${i + 1}`);
        const n = Math.round(prog(lt, t0, t0 + 0.4) * f.v.length);
        const act = lt >= t0 - 0.05 && lt < t0 + 0.55;
        const key = `${n}|${act && Math.floor(tg / (ctx.beat / 2)) % 2 === 0}`;
        if (r[`fv${i}`].dataset.key !== key) {
          r[`fv${i}`].dataset.key = key;
          r[`fv${i}`].innerHTML = `${f.v.slice(0, n)}${key.endsWith('true') ? '<span class="of-caret"></span>' : ''}`;
        }
        r[`box${i}`].classList.toggle('on', act);
        if (i > 0) { const row = r[`pr${i}`] || null; if (i <= 3 && row) { const tr = cue(`F1.f${i === 1 ? 2 : i === 2 ? 3 : 4}`) + 0.4; show(row, tw(lt, tr, 0.3, 0, 1)); row.style.transform = `translateY(${tw(lt, tr, 0.4, 10, 0)}px)`; } }
      });
      const t1 = cue('F1.f1');
      const nt = Math.round(prog(lt, t1, t1 + 0.4) * s.fields[0].v.length);
      r.prevT.textContent = s.fields[0].v.slice(0, nt);
      const ap = lt >= t1 ? spring(lt, t1, 2, 7) : 0;
      r.prevArt.style.transform = `scale(${lerp(1.25, 1, Math.min(1, ap))})`;
      r.prevArt.style.opacity = Math.min(1, ap);
      const tSub = cue('F1.submit');
      const sent = lt >= tSub;
      r.submit.style.background = sent ? C.creme : C.orange;
      r.submit.style.transform = `scale(${1 - 0.04 * blip(lt, tSub, 0.08, 0.3)})`;
      r.submitT.textContent = sent ? 'Envoyé pour validation' : 'Soumettre pour validation';
      r.pill.className = `dk-pill ${sent ? 'p-wait' : 'p-draft'}`;
      r.pill.textContent = sent ? 'En attente de validation' : 'Brouillon';
      r.pill.style.transform = `scale(${1 + 0.15 * blip(lt, tSub + 0.1, 0.04, 0.35)})`;
      taps.push([tSub, s.taps.submit]);
    }

    // F2 : ventes
    const ev = ctx.content.events.find((e) => e.id === 'maquis');
    const tC = cue('F2.count', 0.2);
    const dC = Math.min(2.2, f2.d * 0.6);
    const g = E.festi(prog(lt, tC, tC + dC));
    const sold = Math.round(ev.sold * g);
    r.k1.textContent = String(sold);
    r.k1b.style.width = `${(sold / ev.capacity) * 100}%`;
    r.k2.textContent = `${xof(sold * ev.price)} F`;
    const pct = Math.round((sold / ev.capacity) * 100);
    r.k3.textContent = `${pct} %`;
    r.ring.setAttribute('stroke-dasharray', `${pct} 100`);
    const step = Math.min(ctx.beat, (f2.d - 0.4) / BARS.length);
    BARS.forEach((h, i) => {
      const t0 = tC + i * step;
      const a = lt >= t0 ? Math.min(1.08, spring(lt, t0, 2.2, 7)) : 0;
      r[`bar${i}`].style.height = `${h * 100}%`;
      r[`bar${i}`].style.transform = `scaleY(${a})`;
    });
    r.live.style.transform = `scale(${1 + 0.5 * ctx.pulse(tg, 6)})`;
    const tN = [1, 2, 3].map((n) => cue(`F2.n${n}`));
    FEED.forEach((_, i) => {
      const fr = r[`fr${i}`];
      const inA = E.festi(prog(lt, tN[i], tN[i] + 0.4));
      let idx = 0;
      for (let j = i + 1; j < FEED.length; j++) idx += E.festi(prog(lt, tN[j], tN[j] + 0.35));
      fr.style.top = `${54 + idx * 84 + (1 - inA) * -40}px`;
      show(fr, inA);
    });

    // F3 : retrait
    if (has('F3')) {
      const tTap = cue('F3.tap'), tOk = cue('F3.ok'), tSent = cue('F3.sent');
      taps.push([tTap, s.taps.pay]);
      const morph = E.glisse(prog(lt, tTap + 0.1, tTap + 0.45));
      const w = lerp(702, 62, morph);
      r.pay.style.width = `${w}px`;
      r.pay.style.left = `${34 + (702 - w) / 2}px`;
      r.pay.style.borderRadius = `${lerp(16, 31, morph)}px`;
      r.pay.style.transform = `scale(${1 - 0.04 * blip(lt, tTap, 0.08, 0.3)})`;
      show(r.payT, 1 - prog(morph, 0, 0.3));
      show(r.dots, prog(morph, 0.7, 1) * (lt < tOk ? 1 : 0));
      [...r.dots.children].forEach((d, i) => { const ph = ((tg / ctx.beat) + i * 0.25) % 1; d.style.transform = `translateY(${-7 * Math.max(0, Math.sin(ph * Math.PI * 2))}px)`; });
      show(r.pay, lt < tOk ? 1 : 0);
      const okA = lt >= tOk ? spring(lt, tOk, 2.4, 6) : 0;
      r.ok.style.transform = `scale(${okA})`;
      show(r.ok, lt >= tOk ? 1 : 0);
      r.okp.setAttribute('stroke-dashoffset', (1 - E.festi(prog(lt, tOk + 0.1, tOk + 0.45))).toFixed(3));
      show(r.sent, tw(lt, tSent, 0.4, 0, 1));
      r.sent.style.transform = `translateY(${tw(lt, tSent, 0.5, 20, 0)}px)`;
      // La pastille quitte la coche et sort du cadre par la droite (le chemin de l'argent)
      const fu = prog(lt, tFly, tFly + 0.6);
      if (fu > 0 && fu < 1) {
        const k = document.getElementById('root').getBoundingClientRect();
        const q = r.ok.getBoundingClientRect();
        const sc = k.width / 1920;
        const x0 = (q.left + q.width / 2 - k.left) / sc, y0 = (q.top + q.height / 2 - k.top) / sc;
        const e = E.sortie(fu);
        r.fly.style.left = `${lerp(x0, 2050, e)}px`;
        r.fly.style.top = `${y0 - 220 * Math.sin(Math.PI * e * 0.8)}px`;
        show(r.fly, 1);
      } else show(r.fly, 0);
    } else show(r.fly, 0);
    updateTap(r, lt, taps);
  },
};
