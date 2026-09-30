// Sequence G - Validation et confiance (administration)
// G1 : file de moderation ; trois points de controle cochés sur les temps, "Le Scan" balaie la fiche,
//      tap sur "Valider et publier", tampon VALIDE sur le premier temps de la mesure, statut -> Publie.
import { html, tw, E, spring, show, lerp, prog, blip, xof } from '../lib/motion.js';
import { C, icon, art } from '../lib/motifs.js';
import { captionCSS, captionMarkup, updateCaption, deskCSS, deskMarkup, localCenter, updateTap, winTransform } from '../lib/ui.js';

const CHECKS = ['Organisateur vérifié', 'Lieu et date confirmés', 'Billetterie conforme'];

const css = `
.scene-validation { background: var(--nuit); }
.va-bg { position:absolute; inset:0; }
.va-q { left:34px; width:250px; }
.va-qc { position:absolute; left:34px; width:250px; height:96px; border-radius:16px; background:#1B1512; border:1.5px solid rgba(247,242,234,.06); padding:12px; display:flex; gap:12px; }
.va-qc.on { border-color: var(--orange); background: rgba(255,95,31,.08); }
.va-qc .th { width:70px; height:70px; border-radius:12px; overflow:hidden; flex:none; }
.va-qc .th svg { width:100%; height:100%; display:block; }
.va-qc b { display:block; font-size:14px; line-height:1.2; }
.va-qc span { display:block; font-size:12px; color: var(--creme-45); margin-top:4px; }
.va-sk { display:block; height:10px; border-radius:5px; background: rgba(247,242,234,.08); margin-top:10px; }
.va-det { left:306px; top:112px; width:430px; height:560px; overflow:hidden; }
.va-det .da { height:130px; }
.va-det .da svg { width:100%; height:100%; display:block; }
.va-det .db { padding:16px 20px; }
.va-det .dt { margin-top:10px; font: 800 26px/1.05 var(--f-display); letter-spacing:-.02em; }
.va-det .row { display:flex; gap:10px; align-items:center; font-size:13px; color: var(--creme-70); margin-top:9px; white-space:nowrap; }
.va-det .row .ic { color: var(--orange); flex:none; }
.va-chk { display:flex; align-items:center; gap:12px; font-size:14px; font-weight:600; height:34px; }
.va-box { width:24px; height:24px; border-radius:7px; border:2px solid rgba(247,242,234,.25); display:grid; place-items:center; color: var(--nuit); flex:none; }
.va-scan { position:absolute; left:-10px; right:-10px; height:4px; border-radius:2px; background: var(--vert); box-shadow: 0 0 24px 6px rgba(46,224,122,.5); }
.va-stamp { position:absolute; left:92px; top:34px; padding: 12px 22px; border:6px solid var(--vert); border-radius:18px; color: var(--vert); font: 800 44px/1 var(--f-mono); letter-spacing:.08em; display:flex; gap:12px; align-items:center; background: rgba(13,11,10,.82); white-space:nowrap; }
${captionCSS}
${deskCSS}
`;

export default {
  css,
  build(el, ctx) {
    const c = ctx.content;
    const ev = c.events.find((e) => e.id === 'mandingue');
    const view = `<div class="dk-view">
      <div class="dk-crumb">Administration</div><div class="dk-h">Validation des événements</div>
      <div class="va-qc on" style="top:112px"><div class="th">${art(ev.art)}</div><div><b>${ev.title}</b><span>${ev.city} · ${ev.dateShort}</span><span class="dk-pill p-wait" data-k="qpill" style="height:22px;font-size:11px;margin-top:6px;display:inline-flex">En attente</span></div></div>
      ${[0, 1].map((i) => `<div class="va-qc" style="top:${224 + i * 112}px;opacity:.45"><div class="th" style="background:#241C18"></div><div style="flex:1"><i class="va-sk" style="width:80%"></i><i class="va-sk" style="width:55%"></i><i class="va-sk" style="width:40%"></i></div></div>`).join('')}
      <div class="dk-card va-det" data-k="det">
        <div class="da">${art(ev.art)}</div>
        <div class="db">
          <span class="dk-pill p-wait" data-k="dpill">En attente</span>
          <div class="dt">${ev.title}</div>
          <div class="row">${icon('pin', 16)}${ev.venue}, ${ev.city}</div>
          <div class="row">${icon('calendar', 16)}${ev.dateLong} · ${ev.time}</div>
          <div class="row">${icon('user', 16)}${c.organizer.name}</div>
          <div class="row">${icon('ticket', 16)}${xof(ev.price)} F · ${ev.capacity} places</div>
          <div style="margin-top:16px;border-top:1px dashed rgba(247,242,234,.14);padding-top:12px">
            ${CHECKS.map((t, i) => `<div class="va-chk"><span class="va-box" data-k="box${i}"><span data-k="tick${i}" style="display:grid">${icon('check', 16, 'currentColor', 3.4)}</span></span>${t}</div>`).join('')}
          </div>
        </div>
        <div class="va-scan" data-k="scan"></div>
        <div class="va-stamp" data-k="stamp">${icon('check', 44, 'currentColor', 3.4)}VALIDÉ</div>
      </div>
      <div class="dk-btn ghost" style="left:34px;top:612px;width:120px;height:48px;font-size:14px">Refuser</div>
      <div class="dk-btn" data-k="okbtn" style="left:166px;top:612px;width:118px;height:48px;font-size:14px;padding:0 4px">Valider</div>
    </div>`;
    const r = html(el, `
      <svg class="va-bg" width="1920" height="1080" viewBox="0 0 1920 1080">
        <defs><radialGradient id="va-glow"><stop offset="0" stop-color="${C.orange}" stop-opacity=".22"/><stop offset="1" stop-color="${C.orange}" stop-opacity="0"/></radialGradient>
        <radialGradient id="va-glow2"><stop offset="0" stop-color="${C.vert}" stop-opacity=".22"/><stop offset="1" stop-color="${C.vert}" stop-opacity="0"/></radialGradient></defs>
        <circle data-k="glow" cx="1340" cy="530" r="760" fill="url(#va-glow)"/>
        <circle data-k="glow2" cx="1440" cy="520" r="700" fill="url(#va-glow2)"/>
        <g data-k="rings" fill="none" stroke="${C.sable}">${Array.from({ length: 10 }, (_, i) => `<circle r="${420 + i * 70}" stroke-width="2" opacity="${(0.1 - i * 0.008).toFixed(3)}" stroke-dasharray="${i % 3 === 0 ? '3 22' : 'none'}"/>`).join('')}</g>
        <circle data-k="rip" cx="1440" cy="520" fill="none" stroke="${C.vert}" stroke-width="3"/>
      </svg>
      ${captionMarkup([{ step: 'ADMINISTRATION', verb: 'Vérifié', sub: 'Avant chaque publication.' }], { size: 150, segs: false })}
      <div class="dk-persp">${deskMarkup({
        url: 'festiconnect.ci/admin',
        nav: [{ key: 'dash', icon: 'home', label: 'Tableau de bord' }, { key: 'val', icon: 'shield', label: 'Validation', badge: '1' }, { key: 'events', icon: 'calendar', label: 'Événements' }, { key: 'users', icon: 'users', label: 'Utilisateurs' }],
        org: { initials: 'FC', name: 'Équipe FestiConnect' },
        views: view,
      })}</div>`);
    r.nav_val.classList.add('on');
    const taps = { ok: localCenter(r.win, r.okbtn) };
    return { r, taps };
  },

  update(s, lt, ctx, tg) {
    const { r } = s;
    const cue = (n) => ctx.c(`G1.${n}`);
    const tIn = cue('in'), tStamp = cue('stamp'), tPub = cue('publish'), tOut = cue('out');

    r.rings.setAttribute('transform', `translate(1340 530) rotate(${(lt * 4).toFixed(2)})`);
    show(r.glow, 0.75 + 0.25 * ctx.pulse(tg, 4));
    const flash = blip(lt, tStamp, 0.04, 1.0);
    show(r.glow2, flash);
    const age = lt - tStamp;
    if (age > 0 && age < 1.2) { r.rip.style.visibility = 'visible'; r.rip.setAttribute('r', (80 + 700 * E.expo(age / 1.2)).toFixed(1)); r.rip.style.opacity = ((1 - age / 1.2) ** 2).toFixed(3); }
    else r.rip.style.visibility = 'hidden';

    updateCaption(r, lt, [{ tin: tIn + 0.1, tout: ctx.dur - 0.05 }]);
    const uIn = E.festi(prog(lt, tIn, tIn + 0.7));
    const uOut = E.sortie(prog(lt, tOut, ctx.dur));
    r.win.style.transform = winTransform(lt, uIn, uOut);
    show(r.win, 1 - prog(uOut, 0.7, 1));

    // Points de controle sur les temps
    [0, 1, 2].forEach((i) => {
      const t0 = cue(`c${i + 1}`);
      const on = lt >= t0;
      const a = on ? spring(lt, t0, 2.6, 7) : 0;
      r[`box${i}`].style.background = on ? C.vert : 'transparent';
      r[`box${i}`].style.borderColor = on ? C.vert : 'rgba(247,242,234,.25)';
      r[`tick${i}`].style.transform = `scale(${a})`;
      r[`box${i}`].style.transform = `scale(${1 + 0.2 * blip(lt, t0, 0.03, 0.25)})`;
    });

    // Le Scan, puis le tampon qui claque sur le temps
    const tScan = cue('scan');
    const sc = prog(lt, tScan, tStamp);
    r.scan.style.top = `${lerp(0, 556, E.glisse(sc))}px`;
    show(r.scan, sc > 0 && sc < 1 ? 1 : 0);
    const st = lt >= tStamp ? spring(lt, tStamp, 2.6, 8) : 0;
    r.stamp.style.transform = `rotate(-7deg) scale(${lerp(2.3, 1, Math.min(1, st))})`;
    show(r.stamp, prog(lt, tStamp - 0.06, tStamp + 0.02));
    r.det.style.boxShadow = `0 0 ${(90 * flash).toFixed(0)}px rgba(46,224,122,${(0.6 * flash).toFixed(2)})`;
    r.okbtn.style.transform = `scale(${1 - 0.06 * blip(lt, tStamp - 0.1, 0.08, 0.3)})`;
    updateTap(r, lt, [[tStamp - 0.1, s.taps.ok]]);

    // Statut : En attente -> Publie ; le badge de la file disparait
    const pub = lt >= tPub;
    for (const p of [r.qpill, r.dpill]) {
      p.className = `dk-pill ${pub ? 'p-ok' : 'p-wait'}`;
      p.textContent = pub ? 'Publié' : 'En attente';
      p.style.transform = `scale(${1 + 0.18 * blip(lt, tPub, 0.04, 0.35)})`;
    }
    r.qpill.style.height = '22px'; r.qpill.style.fontSize = '11px';
    const bd = r.badge_val;
    bd.style.transform = `scale(${pub ? 1 - E.festi(prog(lt, tPub, tPub + 0.3)) : 1})`;
  },
};
