// Sequence D - Parcours client (D1 recherche, D2 fiche, D3 paiement mobile money, D4 billet + scan)
// Un seul telephone reste a l'ecran : continuite visuelle, les ecrans changent a l'interieur.
// A gauche, un verbe par plan (Trouve. Choisis. Paie. Entre.) tombe sur le premier temps.
import { html, tw, E, spring, show, lerp, prog, blip, xof, splitChars, revealChars } from '../lib/motion.js';
import { C, art, icon, qrSVG } from '../lib/motifs.js';

const PH = { x: 1040, y: 92, w: 440, h: 896 };
const STEPS = [
  { id: 'D1', n: '01', k: 'Recherche', verb: 'Trouve', sub: 'Artiste, ville, date.' },
  { id: 'D2', n: '02', k: 'Événement', verb: 'Choisis', sub: 'Prix, lieu, places restantes.' },
  { id: 'D3', n: '03', k: 'Paiement', verb: 'Paie', sub: 'Wave, Orange Money, Moov Money.' },
  { id: 'D4', n: '04', k: 'Billet', verb: 'Entre', sub: 'Un code unique. Un scan.' },
];
const METHODS = [
  { name: 'Wave', color: '#1DC4F2' },
  { name: 'Orange Money', color: '#FF7A00' },
  { name: 'Moov Money', color: '#0A5EB0' },
];

const css = `
.scene-parcours { background: var(--nuit); }
.pc-bg { position:absolute; inset:0; }
.pc-cap { position:absolute; left:150px; top:300px; width: 820px; }
.pc-step { font: 500 24px/1 var(--f-mono); letter-spacing:.18em; color: var(--orange); height: 30px; position: relative; }
.pc-step > div { position:absolute; left:0; top:0; white-space:nowrap; }
.pc-verbs { position: relative; height: 210px; margin-top: 34px; }
.pc-verb { position:absolute; left:-8px; top:0; font-size: 200px; color: var(--creme); white-space: nowrap; }
.pc-subs { position: relative; height: 60px; margin-top: 40px; }
.pc-sub { position:absolute; left:0; top:0; font: 400 40px/1.2 var(--f-ui); color: var(--creme-70); white-space:nowrap; }
.pc-prog { display:flex; gap:12px; margin-top: 64px; }
.pc-seg { width: 96px; height: 6px; border-radius: 3px; background: rgba(247,242,234,.14); overflow:hidden; }
.pc-seg i { display:block; height:100%; width:0; background: var(--orange); }

.pc-persp { position:absolute; inset:0; perspective: 2600px; perspective-origin: 1260px 540px; }
.pc-phone { position:absolute; left:${PH.x}px; top:${PH.y}px; width:${PH.w}px; height:${PH.h}px; border-radius: 64px; background: #050404;
  box-shadow: 0 0 0 2px rgba(247,242,234,.16), inset 0 0 0 2px rgba(255,255,255,.06), 0 60px 120px rgba(0,0,0,.6), 0 0 160px rgba(255,95,31,.12); transform-style: preserve-3d; }
.pc-screen { position:absolute; left:12px; top:12px; right:12px; bottom:12px; border-radius: 52px; overflow:hidden; background:#120E0C; font-family: var(--f-ui); color: var(--creme); }
.pc-notch { position:absolute; left:50%; top:22px; width:118px; height:34px; margin-left:-59px; border-radius:20px; background:#050404; z-index:30; }
.sb { position:absolute; left:0; right:0; top:0; height:56px; display:flex; align-items:center; justify-content:space-between; padding: 8px 34px 0; font: 600 16px/1 var(--f-ui); z-index:25; }
.sb-r { display:flex; gap:6px; align-items:center; }
.sb-r i { display:block; width:4px; background: var(--creme); border-radius:1px; }
.sb-bat { width:26px; height:13px; border:2px solid var(--creme-70); border-radius:4px; padding:1px; margin-left:6px; }
.sb-bat b { display:block; width:70%; height:100%; background: var(--creme); border-radius:1px; }
.scr { position:absolute; inset:0; background:#120E0C; }
.pad { position:absolute; left:24px; right:24px; }
.muted { color: var(--creme-45); }
.s1-hi { top:74px; display:flex; justify-content:space-between; align-items:center; font-size:16px; }
.av { width:40px; height:40px; border-radius:50%; background: var(--orange); color: var(--nuit); display:grid; place-items:center; font-weight:800; font-size:14px; }
.s1-h { top:128px; font: 700 30px/1.15 var(--f-ui); letter-spacing:-.02em; }
.srch { top:222px; height:62px; border-radius:20px; background:#1E1714; border:1px solid rgba(247,242,234,.08); display:flex; align-items:center; padding: 0 8px 0 18px; gap:12px; font-size:18px; }
.srch .txt { flex:1; white-space:nowrap; overflow:hidden; }
.srch .ph { color: rgba(247,242,234,.35); }
.caret { display:inline-block; width:2px; height:22px; background: var(--orange); vertical-align:-4px; margin-left:2px; }
.sbtn { width:46px; height:46px; border-radius:50%; background: var(--orange); display:grid; place-items:center; color: var(--nuit); }
.chips { top:302px; display:flex; gap:8px; }
.chip { height:36px; padding:0 14px; border-radius:18px; border:1px solid rgba(247,242,234,.14); display:flex; align-items:center; gap:6px; font-size:14px; font-weight:500; white-space:nowrap; }
.chip.on { background: var(--orange); border-color: var(--orange); color: var(--nuit); font-weight:700; }
.rlabel { top:362px; font: 500 12px/1 var(--f-mono); letter-spacing:.14em; text-transform:uppercase; color: var(--creme-45); }
.card { left:24px; right:24px; height:112px; border-radius:22px; background:#1B1512; border:1px solid rgba(247,242,234,.06); display:flex; gap:14px; padding:12px; align-items:center; }
.card .th { width:88px; height:88px; border-radius:16px; overflow:hidden; flex:none; }
.card .th svg, .hero svg, .tk-art svg { width:100%; height:100%; display:block; }
.card .cat { font: 600 11px/1 var(--f-mono); letter-spacing:.12em; text-transform:uppercase; color: var(--orange); }
.card .ti { font-size:17px; font-weight:700; margin-top:6px; letter-spacing:-.01em; line-height:1.2; }
.card .me { font-size:13px; margin-top:6px; }
.card .pr { font: 700 14px/1 var(--f-mono); color: var(--sable); margin-top:8px; }
.nav { left:16px; right:16px; bottom:16px; height:70px; border-radius:26px; background:#1E1714; display:flex; justify-content:space-around; align-items:center; color: var(--creme-45); }
.nav .on { color: var(--orange); }
.tapdot { position:absolute; width:56px; height:56px; margin:-28px 0 0 -28px; border-radius:50%; background: var(--orange); z-index:40; }
.tapring { position:absolute; width:56px; height:56px; margin:-28px 0 0 -28px; border-radius:50%; border:3px solid var(--orange); z-index:40; }

.hero { position:absolute; left:0; right:0; top:0; height:340px; }
.hero:after { content:''; position:absolute; inset:0; background: linear-gradient(180deg, rgba(18,14,12,0) 45%, #120E0C 100%); }
.hbtn { position:absolute; top:62px; width:44px; height:44px; border-radius:50%; background: rgba(13,11,10,.55); display:grid; place-items:center; z-index:2; }
.s2-tag { top:318px; display:flex; gap:8px; }
.s2-title { top:362px; font: 800 34px/1.02 var(--f-display); letter-spacing:-.025em; }
.row { display:flex; gap:12px; align-items:center; font-size:15px; color: var(--creme-70); height:30px; }
.row .ic { color: var(--orange); flex:none; }
.s2-rows { top:452px; display:flex; flex-direction:column; gap:6px; }
.gauge { top:572px; border-radius:20px; background:#1B1512; padding:16px 18px; border:1px solid rgba(247,242,234,.06); }
.gauge .top { display:flex; justify-content:space-between; font-size:14px; }
.gauge .num { font: 700 16px/1 var(--f-mono); color: var(--creme); }
.bar { height:10px; border-radius:5px; background: rgba(247,242,234,.1); margin-top:12px; overflow:hidden; }
.bar i { display:block; height:100%; width:0; border-radius:5px; background: linear-gradient(90deg, var(--or), var(--orange)); }
.gauge .left { font: 600 13px/1 var(--f-ui); color: var(--sable); margin-top:12px; }
.cta { left:0; right:0; bottom:0; height:118px; background:#171210; border-top:1px solid rgba(247,242,234,.06); display:flex; align-items:center; justify-content:space-between; padding: 0 24px 18px; }
.cta .p { font: 800 26px/1 var(--f-display); letter-spacing:-.01em; }
.cta .p small { display:block; font: 400 13px/1 var(--f-ui); color: var(--creme-45); margin-top:6px; }
.btn { height:60px; padding:0 30px; border-radius:20px; background: var(--orange); color: var(--nuit); font-weight:800; font-size:18px; display:flex; align-items:center; justify-content:center; gap:10px; }

.dim { position:absolute; inset:0; background:#000; }
.sheet { position:absolute; left:0; right:0; bottom:0; height:690px; border-radius:36px 36px 0 0; background:#1B1512; border-top:1px solid rgba(247,242,234,.08); }
.handle { position:absolute; left:50%; top:12px; width:52px; height:5px; margin-left:-26px; border-radius:3px; background: rgba(247,242,234,.25); }
.sh-h { top:40px; font: 700 24px/1.1 var(--f-ui); letter-spacing:-.02em; }
.sh-e { top:74px; font-size:14px; }
.qty { top:118px; display:flex; justify-content:space-between; align-items:center; height:56px; }
.step { display:flex; align-items:center; gap:16px; }
.rb { width:44px; height:44px; border-radius:50%; border:1px solid rgba(247,242,234,.18); display:grid; place-items:center; }
.rb.plus { background: var(--orange); color: var(--nuit); border-color: var(--orange); }
.roll { position:relative; width:26px; height:32px; overflow:hidden; font: 700 26px/32px var(--f-mono); text-align:center; }
.roll div { position:absolute; left:0; right:0; }
.tot { top:186px; display:flex; justify-content:space-between; align-items:baseline; padding-top:14px; border-top:1px dashed rgba(247,242,234,.16); }
.tot b { font: 800 30px/1 var(--f-display); color: var(--sable); letter-spacing:-.01em; }
.plbl { top:252px; font: 500 12px/1 var(--f-mono); letter-spacing:.14em; text-transform:uppercase; }
.meth { left:24px; right:24px; height:66px; border-radius:18px; border:1.5px solid rgba(247,242,234,.1); display:flex; align-items:center; gap:14px; padding:0 16px; background:#201915; }
.meth .sq { width:40px; height:40px; border-radius:12px; display:grid; place-items:center; color:#fff; }
.meth .nm { flex:1; font-size:17px; font-weight:600; }
.radio { width:24px; height:24px; border-radius:50%; border:2px solid rgba(247,242,234,.3); display:grid; place-items:center; }
.radio i { display:block; width:12px; height:12px; border-radius:50%; background: var(--orange); }
.pay { left:24px; right:24px; bottom:34px; height:64px; margin:0 auto; border-radius:22px; background: var(--orange); color: var(--nuit); font-weight:800; font-size:18px; display:flex; align-items:center; justify-content:center; gap:10px; overflow:hidden; white-space:nowrap; }
.pay .dots { display:flex; gap:8px; position:absolute; }
.pay .dots i { width:10px; height:10px; border-radius:50%; background: var(--nuit); display:block; }
.wait { bottom:112px; text-align:center; font-size:15px; }

.ok { position:absolute; inset:0; background: radial-gradient(circle at 50% 38%, #10281a 0%, #120E0C 62%); display:flex; flex-direction:column; align-items:center; }
.okc { margin-top:230px; width:150px; height:150px; border-radius:50%; background: var(--vert); display:grid; place-items:center; box-shadow: 0 0 80px rgba(46,224,122,.35); }
.ok h3 { margin: 34px 0 0; font: 800 34px/1 var(--f-display); letter-spacing:-.02em; }
.ok .amt { margin-top:14px; font: 700 20px/1 var(--f-mono); color: var(--sable); }
.ok .ev { margin-top:12px; font-size:15px; }
.ok .btn { margin-top:44px; background: var(--creme); }
.toast { position:absolute; left:14px; right:14px; top:14px; border-radius:24px; background: rgba(247,242,234,.97); color: var(--nuit); padding:14px 16px; display:flex; gap:12px; align-items:center; z-index:35; box-shadow: 0 18px 40px rgba(0,0,0,.4); }
.toast .ti { width:40px; height:40px; border-radius:12px; background: var(--orange); display:grid; place-items:center; color: var(--nuit); flex:none; }
.toast b { display:block; font-size:14px; }
.toast span { font-size:13px; color: rgba(13,11,10,.65); }

.tk { position:absolute; left:790px; top:300px; width:1000px; height:470px; transform-style: preserve-3d; }
.tk-card { position:absolute; inset:0; border-radius:30px; -webkit-mask: radial-gradient(circle 24px at 704px 0, transparent 23px, #000 24px) top / 100% 51% no-repeat, radial-gradient(circle 24px at 704px 100%, transparent 23px, #000 24px) bottom / 100% 51% no-repeat; background: var(--creme); color: var(--nuit); overflow:hidden; box-shadow: 0 50px 120px rgba(0,0,0,.55); }
.tk-art { position:absolute; left:0; top:0; bottom:0; width:290px; }
.tk-info { position:absolute; left:330px; top:44px; width:340px; }
.tk-tag { font: 700 15px/1 var(--f-mono); letter-spacing:.16em; color: var(--orange); }
.tk-title { margin-top:18px; font: 800 46px/.98 var(--f-display); letter-spacing:-.03em; }
.tk-rows { margin-top:26px; display:flex; flex-direction:column; gap:10px; }
.tk-rows .row { color: rgba(13,11,10,.72); font-size:17px; height:26px; }
.tk-perf { position:absolute; left:702px; top:30px; bottom:30px; border-left:3px dashed rgba(13,11,10,.22); }
.tk-stub { position:absolute; left:704px; right:0; top:0; bottom:0; display:flex; flex-direction:column; align-items:center; padding-top:52px; }
.tk-qr { position:relative; width:210px; height:210px; padding:14px; box-sizing:content-box; background:#fff; border-radius:16px; margin-top:-4px; }
.tk-code { margin-top:24px; font: 700 26px/1 var(--f-mono); letter-spacing:.06em; }
.tk-hint { margin-top:10px; font-size:13px; color: rgba(13,11,10,.55); }
.scanl { position:absolute; left:-18px; right:-18px; height:4px; border-radius:2px; background: var(--vert); box-shadow: 0 0 24px 6px rgba(46,224,122,.55); }
.stamp { position:absolute; left:318px; top:356px; padding: 12px 20px; border:6px solid var(--vert); border-radius:18px; color: #13a855; font: 800 34px/1 var(--f-mono); letter-spacing:.06em; display:flex; gap:12px; align-items:center; background: rgba(247,242,234,.92); white-space:nowrap; }
.iris { position:absolute; inset:0; pointer-events:none; }
`;

function phoneMarkup(c) {
  const ev = c.events;
  const abissa = ev[0];
  const statusBar = `<div class="sb"><span>21:04</span><span class="sb-r"><i style="height:6px"></i><i style="height:9px"></i><i style="height:12px"></i><i style="height:15px"></i><span class="sb-bat"><b></b></span></span></div>`;
  const cards = ev.slice(0, 3).map((e, i) => `
    <div class="card abs" data-k="card${i}" style="top:${390 + i * 126}px">
      <div class="th">${art(e.art)}</div>
      <div><div class="cat">${e.category}</div><div class="ti">${e.title}</div><div class="me muted">${e.city} · ${e.dateShort}</div><div class="pr">dès ${xof(e.price)} F</div></div>
    </div>`).join('');
  return `
  <div class="pc-screen" data-k="screen">
    <div class="pc-notch"></div>
    ${statusBar}
    <div class="scr" data-k="s1">
      <div class="pad s1-hi"><span class="muted">Salut ${c.client.firstName}</span><span class="av">${c.client.name.split(" ").map((w) => w[0]).join("")}</span></div>
      <div class="pad s1-h">Qu'est-ce qu'on fait<br>ce soir ?</div>
      <div class="pad srch"><span class="muted">${icon('search', 22)}</span><span class="txt" data-k="typed"></span><span class="sbtn" data-k="sbtn">${icon('search', 22, 'currentColor', 2.6)}</span></div>
      <div class="pad chips" data-k="chips"><span class="chip" data-k="ch0">Tout</span><span class="chip" data-k="ch1">Tradition</span><span class="chip" data-k="ch2">${icon('pin', 15)}Grand-Bassam</span><span class="chip" data-k="ch3">Août</span></div>
      <div class="pad rlabel" data-k="rlabel">3 résultats</div>
      ${cards}
      <div class="abs nav"><span class="on">${icon('home', 24)}</span><span>${icon('search', 24)}</span><span>${icon('ticket', 24)}</span><span>${icon('bag', 24)}</span></div>
    </div>
    <div class="scr" data-k="s2">
      <div class="hero" data-k="hero">${art(abissa.art)}</div>
      <div class="hbtn" style="left:20px">${icon('back', 20)}</div><div class="hbtn" style="right:20px">${icon('heart', 20, C.orange)}</div>
      <div class="pad s2-tag"><span class="chip on" style="height:30px;font-size:12px">${abissa.category}</span><span class="chip" style="height:30px;font-size:12px;background:#120E0C">Officiel</span></div>
      <div class="pad s2-title" data-k="s2title">${abissa.title.replace(' Experience', '<br>Experience')}</div>
      <div class="pad s2-rows" data-k="s2rows">
        <div class="row">${icon('calendar', 20)}${abissa.dateLong} · ${abissa.time}</div>
        <div class="row">${icon('pin', 20)}${abissa.venue}, ${abissa.city}</div>
        <div class="row">${icon('user', 20)}${c.organizer.name}</div>
      </div>
      <div class="pad gauge" data-k="gauge"><div class="top"><span class="muted">Places vendues</span><span class="num" data-k="gnum">0 / ${xof(abissa.capacity)}</span></div><div class="bar"><i data-k="gbar"></i></div><div class="left" data-k="gleft"></div></div>
      <div class="abs cta"><div class="p">${xof(abissa.price)} F<small>par billet</small></div><div class="btn" data-k="book">Réserver</div></div>
      <div class="dim" data-k="dim"></div>
      <div class="sheet" data-k="sheet">
        <div class="handle"></div>
        <div class="pad sh-h">Ton paiement</div>
        <div class="pad sh-e muted">${abissa.title} · ${abissa.dateShort}</div>
        <div class="pad qty"><span style="font-size:17px;font-weight:600">Billets</span><span class="step"><span class="rb">${icon('minus', 20)}</span><span class="roll" data-k="roll"><div data-k="q1">1</div><div data-k="q2">2</div></span><span class="rb plus" data-k="plus">${icon('plus', 20, 'currentColor', 2.6)}</span></span></div>
        <div class="pad tot"><span style="font-size:17px">Total</span><b data-k="total">${xof(abissa.price)} F</b></div>
        <div class="pad plbl muted">Payer avec</div>
        ${METHODS.map((m, i) => `<div class="abs meth" data-k="m${i}" style="top:${282 + i * 78}px"><span class="sq" style="background:${m.color}">${icon('wallet', 20, '#fff')}</span><span class="nm">${m.name}</span><span class="radio" data-k="rad${i}"><i data-k="radi${i}"></i></span></div>`).join('')}
        <div class="abs wait muted" data-k="wait" style="left:0;right:0">Confirme le paiement sur ton téléphone</div>
        <div class="abs pay" data-k="pay"><span data-k="payTxt">Payer ${xof(c.ticket.amount)} F</span><span class="dots" data-k="dots"><i></i><i></i><i></i></span></div>
      </div>
    </div>
    <div class="ok" data-k="ok">
      <div class="okc" data-k="okc"><svg width="84" height="84" viewBox="0 0 24 24" fill="none" stroke="#0D0B0A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path data-k="okp" d="M20 6 9 17l-5-5" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"/></svg></div>
      <h3 data-k="okh">Paiement reçu</h3>
      <div class="amt" data-k="oka">${xof(c.ticket.amount)} F · ${c.ticket.method}</div>
      <div class="ev muted" data-k="oke">${c.ticket.quantity} billets · ${abissa.title}</div>
      <div class="btn" data-k="okb">${icon('ticket', 20)}Voir mes billets</div>
    </div>
    <div class="toast" data-k="toast"><span class="ti">${icon('bell', 20)}</span><div><b>Paiement confirmé</b><span>${xof(c.ticket.amount)} F via ${c.ticket.method} · ${c.ticket.quantity} billets</span></div></div>
    <div class="tapring" data-k="tapring"></div>
    <div class="tapdot" data-k="tapdot"></div>
  </div>`;
}

function ticketMarkup(c) {
  const e = c.events[0];
  const t = c.ticket;
  return `
  <div class="tk-card">
    <div class="tk-art">${art(e.art)}</div>
    <div class="tk-info">
      <div class="tk-tag">BILLET · ${e.category.toUpperCase()}</div>
      <div class="tk-title">${e.title.replace(' Experience', '<br>Experience')}</div>
      <div class="tk-rows">
        <div class="row">${icon('calendar', 20)}${e.dateLong} · ${e.time}</div>
        <div class="row">${icon('pin', 20)}${e.venue}, ${e.city}</div>
        <div class="row">${icon('user', 20)}${t.quantity} billets · ${c.client.name}</div>
        <div class="row">${icon('wallet', 20)}Payé via ${t.method} · ${xof(t.amount)} F</div>
      </div>
    </div>
    <div class="tk-perf"></div>
    <div class="tk-stub">
      <div class="tk-qr" data-k="qr">${qrSVG(t.code, 210)}<div class="scanl" data-k="scanl"></div></div>
      <div class="tk-code" data-k="code"></div>
      <div class="tk-hint">Présente ce code à l'entrée</div>
    </div>
  </div>
  <div class="stamp" data-k="stamp">${icon('check', 40, 'currentColor', 3.4)}ACCÈS VALIDÉ</div>`;
}

export default {
  css,
  build(el, ctx) {
    const c = ctx.content;
    const r = html(el, `
      <svg class="pc-bg" width="1920" height="1080" viewBox="0 0 1920 1080">
        <defs><radialGradient id="pc-glow"><stop offset="0" stop-color="${C.orange}" stop-opacity=".28"/><stop offset="1" stop-color="${C.orange}" stop-opacity="0"/></radialGradient></defs>
        <circle data-k="glow" cx="1260" cy="540" r="700" fill="url(#pc-glow)"/>
        <g data-k="rings" fill="none" stroke="${C.sable}">${Array.from({ length: 12 }, (_, i) => `<circle r="${330 + i * 64}" stroke-width="${i % 4 === 0 ? 10 : 2}" stroke-dasharray="${i % 4 === 0 ? '4 26' : 'none'}" opacity="${(0.13 - i * 0.008).toFixed(3)}"/>`).join('')}</g>
      </svg>
      <div class="pc-cap" data-k="cap">
        <div class="pc-step">${STEPS.map((s, i) => `<div data-k="step${i}">${s.n} / 04  ·  ${s.k.toUpperCase()}</div>`).join('')}</div>
        <div class="pc-verbs">${STEPS.map((s, i) => `<div class="pc-verb display" data-k="verb${i}"><span class="line">${splitChars(s.verb).replace(/<\/span><\/span>$/, '<span class="ch dot">.</span></span></span>')}</span></div>`).join('')}</div>
        <div class="pc-subs">${STEPS.map((s, i) => `<div class="pc-sub" data-k="sub${i}"><span class="line"><span class="ch">${s.sub}</span></span></div>`).join('')}</div>
        <div class="pc-prog">${STEPS.map((_, i) => `<div class="pc-seg"><i data-k="seg${i}"></i></div>`).join('')}</div>
      </div>
      <div class="pc-persp">
        <div class="pc-phone" data-k="phone">${phoneMarkup(c)}</div>
        <div class="tk" data-k="tk">${ticketMarkup(c)}</div>
      </div>
      <svg class="iris" width="1920" height="1080" viewBox="0 0 1920 1080"><circle data-k="iris" r="0" fill="${C.orange}"/></svg>`);

    // Positions locales (dans l'ecran du telephone) des cibles de "tap", mesurees sans transformation
    const k = document.getElementById('root').getBoundingClientRect().width / 1920;
    const sr = r.screen.getBoundingClientRect();
    const loc = (n) => { const q = n.getBoundingClientRect(); return { x: (q.left + q.width / 2 - sr.left) / k, y: (q.top + q.height / 2 - sr.top) / k }; };
    const taps = { card: loc(r.card0), book: loc(r.book), plus: loc(r.plus), wave: loc(r.m0), pay: loc(r.pay), sbtn: loc(r.sbtn) };
    const qrMods = [...r.qr.querySelectorAll('.qm')].map((m) => ({ m, d: Number(m.dataset.d) }));
    const eyes = [...r.qr.querySelectorAll('.qeye')];
    return { r, taps, qrMods, eyes, k, lastTyped: null };
  },

  update(s, lt, ctx, tg) {
    const { r } = s;
    const c = ctx.content;
    const P = Object.fromEntries(STEPS.map((st) => [st.id, ctx.p(st.id)]));
    const cue = (n, d) => ctx.c(n, d);

    // --- Fond
    const pul = ctx.pulse(tg, 5, 4);
    r.rings.setAttribute('transform', `translate(1260 540) rotate(${(lt * 4).toFixed(2)}) scale(${(1 + 0.012 * pul).toFixed(4)})`);
    show(r.glow, 0.75 + 0.25 * ctx.pulse(tg, 4));

    // --- Legendes : un verbe par plan
    STEPS.forEach((st, i) => {
      const p = P[st.id];
      const tin = i === 0 ? cue('D1.phoneIn') + 0.35 : p.s;
      const tout = i === STEPS.length - 1 ? cue('D4.out') : p.e - 0.02;
      revealChars(r[`verb${i}`], lt, tin, { stagger: 0.04, dur: 0.6, out: tout - 0.3, outDur: 0.3, outStagger: 0.015 });
      const sub = r[`sub${i}`].querySelector('.ch');
      sub.style.transform = `translateY(${(tw(lt, tin + 0.18, 0.55, 1.2, 0) + tw(lt, tout - 0.28, 0.3, 0, -1.4, E.sortie)) * 100}%)`;
      const stp = r[`step${i}`];
      show(stp, tw(lt, tin, 0.3, 0, 1) * tw(lt, tout - 0.2, 0.2, 1, 0));
      stp.style.transform = `translateY(${tw(lt, tin, 0.4, 14, 0)}px)`;
      r[`seg${i}`].style.width = `${tw(lt, tin, 0.5, 0, 100, E.glisse)}%`;
    });
    show(r.cap, tw(lt, cue('D4.out'), 0.4, 1, 0));

    // --- Telephone : entree, derive douce, sortie au plan D4
    const tIn = cue('D1.phoneIn');
    const tTk = cue('D4.ticket');
    const rise = tw(lt, tIn, 1.0, 70, 0, E.festi);
    const exit = E.sortie(prog(lt, tTk, tTk + 0.65));
    const ry = -9 + 2.2 * Math.sin(lt * 0.45) - 25 * exit;
    const rx = 3 + 1.2 * Math.sin(lt * 0.6 + 1);
    const drift = 6 * Math.sin(lt * 0.8);
    r.phone.style.transform = `translate3d(${exit * 1150}px, ${rise + drift + exit * 120}px, 0) rotateY(${ry}deg) rotateX(${rx}deg) rotateZ(${exit * 14}deg)`;
    r.phone.style.display = exit >= 1 ? 'none' : 'block';

    // --- Iris d'entree : l'aplat orange de la fin du logo se referme sur le bouton de recherche
    const irisEnd = tIn + 0.7;
    if (lt < irisEnd + 0.1) {
      const q = r.sbtn.getBoundingClientRect(), root = document.getElementById('root').getBoundingClientRect();
      const bx = (q.left + q.width / 2 - root.left) / s.k, by = (q.top + q.height / 2 - root.top) / s.k;
      const u = E.glisse(prog(lt, tIn, irisEnd));
      r.iris.setAttribute('cx', bx); r.iris.setAttribute('cy', by);
      r.iris.setAttribute('r', lerp(2300, 23, u).toFixed(1));
      show(r.iris, 1 - prog(lt, irisEnd - 0.02, irisEnd + 0.08));
    } else show(r.iris, 0);

    // --- D1 : saisie + filtres + resultats
    const word = 'Abissa';
    const n = Math.round(prog(lt, cue('D1.typeStart'), cue('D1.typeEnd')) * word.length);
    const caretOn = lt < cue('D1.results') + 1 && Math.floor((tg - (ctx.tl.music.offset || 0)) / ctx.beat) % 2 === 0;
    const typedKey = `${n}-${caretOn}`;
    if (typedKey !== s.lastTyped) {
      s.lastTyped = typedKey;
      r.typed.innerHTML = n === 0 ? `<span class="ph">Artiste, festival, ville</span>` : `${word.slice(0, n)}${caretOn ? '<span class="caret"></span>' : ''}`;
    }
    const tChips = cue('D1.chips');
    ['ch0', 'ch1', 'ch2', 'ch3'].forEach((id, i) => {
      const on = (i === 1 && lt >= tChips) || (i === 2 && lt >= tChips + 0.25);
      r[id].classList.toggle('on', on);
      const b = blip(lt, tChips + (i === 1 ? 0 : 0.25), 0.04, 0.3);
      r[id].style.transform = `scale(${1 + 0.08 * (on ? b : 0)})`;
    });
    const tRes = cue('D1.results');
    show(r.rlabel, tw(lt, tRes - 0.1, 0.3, 0, 1));
    [0, 1, 2].forEach((i) => {
      const t0 = tRes + i * ctx.beat;
      const cd = r[`card${i}`];
      const pressed = i === 0 ? blip(lt, cue('D1.tap'), 0.08, 0.3) : 0;
      cd.style.transform = `translateY(${tw(lt, t0, 0.6, 60, 0)}px) scale(${1 - 0.04 * pressed})`;
      show(cd, tw(lt, t0, 0.35, 0, 1));
      if (i === 0) cd.style.borderColor = `rgba(255,95,31,${(0.9 * prog(lt, cue('D1.tap') - 0.1, cue('D1.tap'))).toFixed(2)})`;
    });

    // --- Passage D1 -> D2 (push lateral)
    const tPush = cue('D2.push');
    const push = E.glisse(prog(lt, tPush, tPush + 0.5));
    r.s1.style.transform = `translateX(${-32 * push}%)`;
    r.s1.style.filter = push > 0 ? `brightness(${1 - 0.5 * push})` : '';
    r.s2.style.transform = `translateX(${100 * (1 - push)}%)`;
    r.s2.style.visibility = push <= 0 ? 'hidden' : 'visible';
    r.s1.style.visibility = push >= 1 ? 'hidden' : 'visible';

    // --- D2 : fiche evenement
    const tInfo = cue('D2.info');
    r.hero.style.transform = `scale(${tw(lt, tPush, 2.4, 1.18, 1, E.festi)})`;
    [r.s2title, r.s2rows].forEach((node, i) => {
      node.style.transform = `translateY(${tw(lt, tInfo + i * 0.12, 0.6, 28, 0)}px)`;
      show(node, tw(lt, tInfo + i * 0.12, 0.4, 0, 1));
    });
    const e0 = c.events[0];
    const tG = cue('D2.gauge');
    const g = E.festi(prog(lt, tG, tG + 1.4));
    r.gnum.textContent = `${xof(e0.sold * g)} / ${xof(e0.capacity)}`;
    r.gbar.style.width = `${(e0.sold / e0.capacity) * 100 * g}%`;
    r.gleft.textContent = `${xof(e0.capacity - e0.sold * g)} places restantes`;
    show(r.gauge, tw(lt, tG - 0.2, 0.35, 0, 1));
    r.gauge.style.transform = `translateY(${tw(lt, tG - 0.2, 0.5, 24, 0)}px)`;
    const tCta = cue('D2.cta');
    const ctaPop = lt >= tCta ? spring(lt, tCta, 2.2, 5) : 0;
    r.book.style.transform = `scale(${1 + 0.1 * (1 - ctaPop) * (lt >= tCta ? 1 : 0) - 0.05 * blip(lt, cue('D2.tap'), 0.08, 0.3)})`;
    r.book.style.boxShadow = `0 0 ${(40 * blip(lt, tCta, 0.05, 0.8)).toFixed(1)}px rgba(255,95,31,.8)`;

    // --- D3 : feuille de paiement
    const tSheet = cue('D3.sheet');
    const sh = E.festi(prog(lt, tSheet, tSheet + 0.6));
    r.sheet.style.transform = `translateY(${(1 - sh) * 105}%)`;
    r.sheet.style.visibility = sh <= 0 ? 'hidden' : 'visible';
    show(r.dim, 0.55 * sh);
    const tQty = cue('D3.qty');
    const roll = E.pop(prog(lt, tQty, tQty + 0.4));
    r.q1.style.transform = `translateY(${-100 * roll}%)`;
    r.q2.style.transform = `translateY(${100 - 100 * roll}%)`;
    r.plus.style.transform = `scale(${1 - 0.12 * blip(lt, tQty, 0.06, 0.25)})`;
    const tot = lerp(e0.price, c.ticket.amount, E.festi(prog(lt, tQty, tQty + 0.6)));
    r.total.textContent = `${xof(Math.round(tot / 500) * 500)} F`;
    const tM = cue('D3.methods');
    METHODS.forEach((_, i) => {
      const m = r[`m${i}`];
      m.style.transform = `translateY(${tw(lt, tM + i * 0.12, 0.5, 30, 0)}px)`;
      show(m, tw(lt, tM + i * 0.12, 0.35, 0, 1));
    });
    const tSel = cue('D3.select');
    const sel = lt >= tSel ? spring(lt, tSel, 3, 8) : 0;
    r.radi0.style.transform = `scale(${sel})`;
    r.rad0.style.borderColor = lt >= tSel ? C.orange : 'rgba(247,242,234,.3)';
    r.m0.style.borderColor = lt >= tSel ? C.orange : 'rgba(247,242,234,.1)';
    r.m0.style.background = lt >= tSel ? 'rgba(255,95,31,.1)' : '#201915';
    [1, 2].forEach((i) => { r[`radi${i}`].style.transform = 'scale(0)'; });
    const tPay = cue('D3.pay'), tWait = cue('D3.wait');
    r.payTxt.textContent = lt >= tSel ? `Payer ${xof(c.ticket.amount)} F avec Wave` : `Payer ${xof(c.ticket.amount)} F`;
    // Le bouton se resserre en pastille pendant l'attente de confirmation
    const morph = E.glisse(prog(lt, tWait, tWait + 0.45));
    const fullW = 368;
    r.pay.style.width = `${lerp(fullW, 64, morph)}px`;
    r.pay.style.left = `${24 + (fullW - lerp(fullW, 64, morph)) / 2}px`;
    r.pay.style.right = 'auto';
    r.pay.style.borderRadius = `${lerp(22, 32, morph)}px`;
    r.pay.style.transform = `scale(${1 - 0.05 * blip(lt, tPay, 0.08, 0.3)})`;
    show(r.payTxt, 1 - prog(morph, 0, 0.35));
    show(r.dots, prog(morph, 0.7, 1));
    [...r.dots.children].forEach((d, i) => {
      const ph = ((tg / ctx.beat) + i * 0.25) % 1;
      d.style.transform = `translateY(${-8 * Math.max(0, Math.sin(ph * Math.PI * 2))}px)`;
    });
    show(r.wait, tw(lt, tWait + 0.3, 0.4, 0, 1));

    // --- Succes : la pastille devient la coche verte
    const tOk = cue('D3.success');
    const ok = prog(lt, tOk - 0.15, tOk + 0.15);
    show(r.ok, ok);
    const okPop = lt >= tOk ? spring(lt, tOk, 2.4, 6) : 0;
    r.okc.style.transform = `scale(${okPop})`;
    r.okp.setAttribute('stroke-dashoffset', (1 - E.festi(prog(lt, tOk + 0.15, tOk + 0.55))).toFixed(3));
    ['okh', 'oka', 'oke', 'okb'].forEach((id, i) => {
      r[id].style.transform = `translateY(${tw(lt, tOk + 0.2 + i * 0.08, 0.5, 24, 0)}px)`;
      show(r[id], tw(lt, tOk + 0.2 + i * 0.08, 0.35, 0, 1));
    });
    const tToast = cue('D3.toast');
    r.toast.style.transform = `translateY(${tw(lt, tToast, 0.55, -140, 0, E.pop) + tw(lt, tTk - 0.3, 0.3, 0, -160, E.sortie)}px)`;
    r.toast.style.visibility = lt < tToast ? 'hidden' : 'visible';

    // --- Indicateur de tap (pastille orange) sur chaque interaction
    const taps = [[cue('D1.tap'), s.taps.card], [cue('D2.tap'), s.taps.book], [tQty, s.taps.plus], [tSel, s.taps.wave], [tPay, s.taps.pay]];
    let tapA = 0, tapR = 0, tp = null, age = 0;
    for (const [tt, pos] of taps) {
      if (lt >= tt - 0.12 && lt < tt + 0.5) { tp = pos; age = lt - tt; }
    }
    if (tp) {
      tapA = age < 0 ? prog(age, -0.12, 0) : 1 - prog(age, 0.05, 0.3);
      tapR = age < 0 ? 0 : prog(age, 0, 0.5);
      r.tapdot.style.left = r.tapring.style.left = `${tp.x}px`;
      r.tapdot.style.top = r.tapring.style.top = `${tp.y}px`;
      r.tapdot.style.transform = `scale(${0.6 + 0.4 * tapA})`;
      r.tapring.style.transform = `scale(${1 + 1.6 * E.expo(tapR)})`;
    }
    show(r.tapdot, 0.6 * tapA);
    show(r.tapring, tp && age >= 0 ? 1 - tapR : 0);

    // --- D4 : le billet sort du telephone, QR construit, code, scan, tampon
    const tk = E.festi(prog(lt, tTk + 0.1, tTk + 0.95));
    const tOut = cue('D4.out');
    const out = E.sortie(prog(lt, tOut, tOut + 0.4));
    r.tk.style.visibility = lt < tTk + 0.1 ? 'hidden' : 'visible';
    r.tk.style.transform = `translate3d(${lerp(420, 0, tk) - out * 1400}px, ${lerp(80, 0, tk)}px, 0) rotateY(${lerp(-38, 0, tk)}deg) rotateZ(${lerp(-10, 0, tk) - out * 6}deg) scale(${lerp(0.45, 1, tk)})`;
    const tQr = cue('D4.qr');
    for (const q of s.qrMods) {
      const a = prog(lt, tQr + q.d * 0.7, tQr + q.d * 0.7 + 0.12);
      q.m.style.opacity = a;
    }
    s.eyes.forEach((e, i) => {
      const a = lt >= tQr + i * 0.1 ? spring(lt, tQr + i * 0.1, 2.5, 7) : 0;
      e.style.transformBox = 'fill-box'; e.style.transformOrigin = 'center';
      e.style.transform = `scale(${a})`;
    });
    const code = c.ticket.code;
    const tCode = cue('D4.code');
    const nc = Math.round(prog(lt, tCode, tCode + 0.6) * code.length);
    r.code.textContent = code.slice(0, nc) + (nc < code.length && lt >= tCode ? '_' : '');
    const tScan = cue('D4.scan');
    const sc = prog(lt, tScan, tScan + 0.5);
    r.scanl.style.top = `${lerp(6, 222, E.glisse(sc))}px`;
    show(r.scanl, sc > 0 && sc < 1 ? 1 : 0);
    const tVal = cue('D4.valid');
    const st = lt >= tVal ? spring(lt, tVal, 2.6, 8) : 0;
    r.stamp.style.transform = `rotate(-6deg) scale(${lerp(2.2, 1, Math.min(1, st))})`;
    show(r.stamp, prog(lt, tVal - 0.06, tVal + 0.02));
    r.tk.querySelector('.tk-card').style.boxShadow = `0 50px 120px rgba(0,0,0,.55), 0 0 ${(120 * blip(lt, tVal, 0.04, 0.6)).toFixed(0)}px rgba(46,224,122,.7)`;
  },
};
