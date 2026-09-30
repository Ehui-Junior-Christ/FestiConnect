// Composants partages des sequences E, F, G : legende gauche (etape, verbe, sous-titre)
// et fenetre de navigateur (tableau de bord organisateur / administration).
import { tw, E, show, splitChars, revealChars, lerp } from './motion.js';
import { icon } from './motifs.js';

// --- Legende -------------------------------------------------------------
export const captionCSS = `
.cp { position:absolute; left:150px; top:300px; width: 700px; }
.cp-step { font: 500 24px/1 var(--f-mono); letter-spacing:.18em; color: var(--orange); height: 30px; position: relative; }
.cp-step > div { position:absolute; left:0; top:0; white-space:nowrap; }
.cp-verbs { position: relative; margin-top: 34px; }
.cp-verb { position:absolute; left:-6px; top:0; color: var(--creme); white-space: nowrap; }
.cp-subs { position: relative; height: 60px; }
.cp-sub { position:absolute; left:0; top:0; font: 400 36px/1.25 var(--f-ui); color: var(--creme-70); white-space:nowrap; }
.cp-prog { display:flex; gap:12px; margin-top: 60px; }
.cp-seg { width: 96px; height: 6px; border-radius: 3px; background: rgba(247,242,234,.14); overflow:hidden; }
.cp-seg i { display:block; height:100%; width:0; background: var(--orange); }
`;

// steps : [{ step, verb (lignes separees par |), sub }]
export function captionMarkup(steps, { size = 160, segs = true } = {}) {
  const lines = Math.max(...steps.map((s) => s.verb.split('|').length));
  const verbH = Math.round(size * 1.02 * lines);
  const verb = (v) => v.split('|').map((l, j, a) => {
    let m = splitChars(l);
    if (j === a.length - 1) m = m.replace(/<\/span><\/span>$/, '<span class="ch dot">.</span></span></span>');
    return `<span class="line">${m}</span>`;
  }).join('');
  return `<div class="cp" data-k="cap">
    <div class="cp-step">${steps.map((s, i) => `<div data-k="cstep${i}">${s.step}</div>`).join('')}</div>
    <div class="cp-verbs" style="height:${verbH}px">${steps.map((s, i) => `<div class="cp-verb display" data-k="cverb${i}" style="font-size:${size}px">${verb(s.verb)}</div>`).join('')}</div>
    <div class="cp-subs" style="margin-top:${Math.round(size * 0.2)}px">${steps.map((s, i) => `<div class="cp-sub" data-k="csub${i}"><span class="line"><span class="ch">${s.sub}</span></span></div>`).join('')}</div>
    ${segs ? `<div class="cp-prog">${steps.map((_, i) => `<div class="cp-seg"><i data-k="cseg${i}"></i></div>`).join('')}</div>` : ''}
  </div>`;
}

// times : [{ tin, tout }] en temps local de sequence ; tout = null pour garder a l'ecran
export function updateCaption(r, lt, times) {
  times.forEach(({ tin, tout }, i) => {
    if (!r[`cverb${i}`]) return;
    const out = tout ?? 1e9;
    r[`cverb${i}`].querySelectorAll('.line').forEach((line, j) => {
      revealChars(line, lt, tin + j * 0.12, { stagger: 0.035, dur: 0.6, out: out - 0.3 + j * 0.03, outDur: 0.3, outStagger: 0.012 });
    });
    const sub = r[`csub${i}`].querySelector('.ch');
    sub.style.transform = `translateY(${(tw(lt, tin + 0.2, 0.55, 1.2, 0) + tw(lt, out - 0.28, 0.3, 0, -1.4, E.sortie)) * 100}%)`;
    const st = r[`cstep${i}`];
    show(st, tw(lt, tin, 0.3, 0, 1) * tw(lt, out - 0.2, 0.2, 1, 0));
    st.style.transform = `translateY(${tw(lt, tin, 0.4, 14, 0)}px)`;
    if (r[`cseg${i}`]) r[`cseg${i}`].style.width = `${tw(lt, tin, 0.5, 0, 100, E.glisse)}%`;
  });
}

// --- Fenetre de navigateur --------------------------------------------------
export const DESK = { x: 850, y: 160, w: 980, h: 740, side: 210 };

export const deskCSS = `
.dk-persp { position:absolute; inset:0; perspective: 2800px; perspective-origin: 1340px 530px; }
.dk-win { position:absolute; left:${DESK.x}px; top:${DESK.y}px; width:${DESK.w}px; height:${DESK.h}px; border-radius: 22px; overflow:hidden; background:#120E0C;
  box-shadow: 0 0 0 1.5px rgba(247,242,234,.14), 0 60px 130px rgba(0,0,0,.6), 0 0 160px rgba(255,95,31,.1); font-family: var(--f-ui); color: var(--creme); }
.dk-top { position:absolute; left:0; right:0; top:0; height:46px; background:#0B0908; display:flex; align-items:center; padding: 0 18px; gap:8px; border-bottom:1px solid rgba(247,242,234,.07); }
.dk-top i { width:12px; height:12px; border-radius:50%; background: rgba(247,242,234,.16); display:block; }
.dk-url { position:absolute; left:50%; transform:translateX(-50%); height:28px; padding: 0 16px; border-radius:14px; background:#1A1411; display:flex; align-items:center; gap:8px; font: 500 13px/1 var(--f-mono); color: var(--creme-70); letter-spacing:.02em; }
.dk-side { position:absolute; left:0; top:46px; bottom:0; width:${DESK.side}px; background:#0F0C0B; border-right:1px solid rgba(247,242,234,.06); padding: 26px 16px; }
.dk-brand { font: 800 23px/1 var(--f-display); letter-spacing:-.03em; padding-left: 10px; }
.dk-i { position: relative; display:inline-block; }
.dk-i b { position:absolute; left:50%; top:.02em; width:.19em; height:.19em; margin-left:-.095em; border-radius:50%; background: var(--orange); }
.dk-nav { margin-top: 34px; display:flex; flex-direction:column; gap:4px; }
.dk-item { height:42px; border-radius:12px; display:flex; align-items:center; gap:12px; padding: 0 12px; font-size:14px; font-weight:500; color: var(--creme-45); position:relative; }
.dk-item.on { background: rgba(255,95,31,.12); color: var(--creme); }
.dk-item.on .ic { color: var(--orange); }
.dk-badge { position:absolute; right:10px; min-width:22px; height:22px; border-radius:11px; background: var(--orange); color: var(--nuit); font: 700 12px/22px var(--f-mono); text-align:center; }
.dk-org { position:absolute; left:16px; right:16px; bottom:20px; display:flex; align-items:center; gap:10px; font-size:13px; font-weight:600; }
.dk-av { width:36px; height:36px; border-radius:50%; background: var(--orange); color: var(--nuit); display:grid; place-items:center; font: 800 12px/1 var(--f-ui); flex:none; }
.dk-main { position:absolute; left:${DESK.side}px; right:0; top:46px; bottom:0; overflow:hidden; }
.dk-view { position:absolute; inset:0; padding: 30px 34px; }
.dk-crumb { font: 500 12px/1 var(--f-mono); letter-spacing:.16em; color: var(--creme-45); text-transform: uppercase; }
.dk-h { margin-top: 10px; font: 800 30px/1.05 var(--f-display); letter-spacing:-.02em; }
.dk-card { position:absolute; border-radius:18px; background:#1B1512; border:1px solid rgba(247,242,234,.06); }
.dk-lbl { font: 500 11px/1 var(--f-mono); letter-spacing:.14em; text-transform:uppercase; color: var(--creme-45); }
.dk-pill { display:inline-flex; align-items:center; gap:6px; height:28px; padding:0 12px; border-radius:14px; font-size:12px; font-weight:700; white-space:nowrap; }
.dk-pill.p-wait { background: rgba(255,208,138,.16); color: var(--sable); }
.dk-pill.p-ok { background: rgba(46,224,122,.16); color: var(--vert); }
.dk-pill.p-draft { background: rgba(247,242,234,.08); color: var(--creme-70); }
.dk-btn { position:absolute; height:52px; border-radius:16px; background: var(--orange); color: var(--nuit); font-weight:800; font-size:16px; display:flex; align-items:center; justify-content:center; gap:10px; white-space:nowrap; overflow:hidden; }
.dk-btn.ghost { background: transparent; color: var(--creme); box-shadow: inset 0 0 0 1.5px rgba(247,242,234,.2); }
.dk-tapdot { position:absolute; width:52px; height:52px; margin:-26px 0 0 -26px; border-radius:50%; background: var(--orange); z-index:40; }
.dk-tapring { position:absolute; width:52px; height:52px; margin:-26px 0 0 -26px; border-radius:50%; border:3px solid var(--orange); z-index:40; }
`;

// nav : [{ icon, label, key }] ; org : { initials, name }
export function deskMarkup({ url, nav, org, views }) {
  return `<div class="dk-win" data-k="win">
    <div class="dk-top"><i></i><i></i><i></i><div class="dk-url">${icon('lock', 12)}${url}</div></div>
    <div class="dk-side">
      <div class="dk-brand">Fest<span class="dk-i">ı<b></b></span>Connect</div>
      <div class="dk-nav">${nav.map((n) => `<div class="dk-item" data-k="nav_${n.key}">${icon(n.icon, 19)}${n.label}${n.badge ? `<span class="dk-badge" data-k="badge_${n.key}">${n.badge}</span>` : ''}</div>`).join('')}</div>
      <div class="dk-org"><span class="dk-av">${org.initials}</span>${org.name}</div>
    </div>
    <div class="dk-main">${views}</div>
    <div class="dk-tapring" data-k="tapring"></div><div class="dk-tapdot" data-k="tapdot"></div>
  </div>`;
}

// Mesure des positions locales (dans la fenetre) des cibles de tap, a appeler dans build()
export function localCenter(winEl, node) {
  const k = document.getElementById('root').getBoundingClientRect().width / 1920;
  const w = winEl.getBoundingClientRect(), q = node.getBoundingClientRect();
  return { x: (q.left + q.width / 2 - w.left) / k, y: (q.top + q.height / 2 - w.top) / k };
}

// Indicateur de tap : taps = [[t, {x,y}], ...]
export function updateTap(r, lt, taps) {
  let tp = null, age = 0;
  for (const [tt, pos] of taps) if (lt >= tt - 0.12 && lt < tt + 0.5) { tp = pos; age = lt - tt; }
  if (!tp) { show(r.tapdot, 0); show(r.tapring, 0); return; }
  const a = age < 0 ? (age + 0.12) / 0.12 : 1 - Math.min(1, Math.max(0, (age - 0.05) / 0.25));
  const rr = age < 0 ? 0 : Math.min(1, age / 0.5);
  r.tapdot.style.left = r.tapring.style.left = `${tp.x}px`;
  r.tapdot.style.top = r.tapring.style.top = `${tp.y}px`;
  r.tapdot.style.transform = `scale(${0.6 + 0.4 * a})`;
  r.tapring.style.transform = `scale(${1 + 1.6 * E.expo(rr)})`;
  show(r.tapdot, 0.6 * a);
  show(r.tapring, age >= 0 ? 1 - rr : 0);
}

// Pose de la fenetre : entree, derive, sortie (u_in, u_out entre 0 et 1)
export function winTransform(lt, uIn, uOut) {
  const ry = -8 + 1.6 * Math.sin(lt * 0.4) + lerp(-26, 0, uIn) - 18 * uOut;
  const rx = 2 + 0.8 * Math.sin(lt * 0.55 + 1);
  const y = 5 * Math.sin(lt * 0.7) + lerp(60, 0, uIn);
  return `translate3d(${lerp(420, 0, uIn) + uOut * 1200}px, ${y}px, 0) rotateY(${ry}deg) rotateX(${rx}deg)`;
}
