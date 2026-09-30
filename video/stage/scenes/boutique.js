// Sequence E - Boutique officielle
// E1 : "Le Pagne" (bande de trame en biais) revele la boutique ; trois produits entrent un par temps ;
//      trois ajouts au panier sur les temps : a chaque tap, une pastille vole du bouton jusqu'au panier.
import { html, tw, E, spring, show, lerp, prog, blip, xof } from '../lib/motion.js';
import { C, icon, productArt, trameBand } from '../lib/motifs.js';
import { captionCSS, captionMarkup, updateCaption } from '../lib/ui.js';

const CARD = { x: 790, y: 300, w: 318, h: 520, gap: 30 };
const KINDS = ['cap', 'tote', 'poster'];
const SOCLE = [C.orange, C.sable, C.creme];

const css = `
.scene-boutique { background: var(--nuit); }
.bq-bg { position:absolute; inset:0; }
.bq-content { position:absolute; inset:0; }
.bq-card { position:absolute; top:${CARD.y}px; width:${CARD.w}px; height:${CARD.h}px; border-radius:26px; background:#1B1512; overflow:hidden;
  box-shadow: 0 0 0 1px rgba(247,242,234,.07), 0 40px 90px rgba(0,0,0,.5); font-family: var(--f-ui); color: var(--creme); }
.bq-art { height:${CARD.w}px; }
.bq-art svg { width:100%; height:100%; display:block; }
.bq-bd { padding: 20px 22px; }
.bq-cat { font: 700 13px/1 var(--f-mono); letter-spacing:.16em; text-transform:uppercase; color: var(--orange); }
.bq-name { margin-top:10px; font: 800 26px/1.02 var(--f-display); letter-spacing:-.02em; height: 54px; }
.bq-row { position:absolute; left:22px; right:22px; bottom:20px; display:flex; align-items:center; justify-content:space-between; }
.bq-price { font: 700 20px/1 var(--f-mono); color: var(--sable); }
.bq-add { height:44px; padding:0 16px 0 12px; border-radius:22px; background: var(--orange); color: var(--nuit); font-weight:800; font-size:15px; display:flex; align-items:center; gap:6px; }
.bq-add.done { background: var(--creme); }
.bq-socle { position:absolute; top:${CARD.y + CARD.h - 40}px; width:${CARD.w + 40}px; height:80px; border-radius:40px; filter: blur(30px); opacity:.35; }
.bq-cart { position:absolute; left:1650px; top:150px; display:flex; align-items:center; gap:18px; }
.bq-cart-ic { position:relative; width:78px; height:78px; border-radius:50%; background:#1B1512; box-shadow: 0 0 0 1.5px rgba(247,242,234,.14); display:grid; place-items:center; color: var(--creme); }
.bq-badge { position:absolute; right:-6px; top:-6px; width:34px; height:34px; border-radius:50%; background: var(--orange); color: var(--nuit); font: 800 17px/34px var(--f-mono); text-align:center; }
.bq-tot { font: 500 13px/1 var(--f-mono); letter-spacing:.14em; color: var(--creme-45); text-transform:uppercase; }
.bq-tot b { display:block; margin-top:8px; font: 700 24px/1 var(--f-mono); letter-spacing:0; color: var(--sable); }
.bq-fly { position:absolute; width:30px; height:30px; margin:-15px 0 0 -15px; border-radius:50%; background: var(--orange); box-shadow: 0 0 30px rgba(255,95,31,.8); }
.bq-tap { position:absolute; width:52px; height:52px; margin:-26px 0 0 -26px; border-radius:50%; border:3px solid var(--orange); }
.bq-band { position:absolute; left:0; top:-300px; transform-origin: 0 0; }
${captionCSS}
`;

export default {
  css,
  build(el, ctx) {
    const prods = ctx.content.products;
    const r = html(el, `
      <svg class="bq-bg" width="1920" height="1080" viewBox="0 0 1920 1080">
        <defs>
          <pattern id="bq-dots" width="44" height="44" patternUnits="userSpaceOnUse"><circle cx="22" cy="22" r="1.6" fill="${C.creme}"/></pattern>
          <radialGradient id="bq-glow"><stop offset="0" stop-color="${C.orange}" stop-opacity=".22"/><stop offset="1" stop-color="${C.orange}" stop-opacity="0"/></radialGradient>
        </defs>
        <rect width="1920" height="1080" fill="url(#bq-dots)" opacity=".07"/>
        <circle data-k="glow" cx="1300" cy="560" r="760" fill="url(#bq-glow)"/>
      </svg>
      <div class="bq-content" data-k="content">
        ${captionMarkup([{ step: 'BOUTIQUE OFFICIELLE', verb: 'Garde|la fête', sub: 'Casquettes, tote bags, affiches.' }], { size: 150, segs: false })}
        ${prods.map((p, i) => `<div class="bq-socle" data-k="socle${i}" style="left:${CARD.x - 20 + i * (CARD.w + CARD.gap)}px;background:${SOCLE[i]}"></div>`).join('')}
        ${prods.map((p, i) => `<div class="bq-card" data-k="card${i}" style="left:${CARD.x + i * (CARD.w + CARD.gap)}px">
          <div class="bq-art">${productArt(KINDS[i])}</div>
          <div class="bq-bd"><div class="bq-cat">${p.category}</div><div class="bq-name">${p.name}</div></div>
          <div class="bq-row"><span class="bq-price">${xof(p.price)} F</span><span class="bq-add" data-k="add${i}"><span data-k="addi${i}" style="display:grid">${icon('plus', 18, 'currentColor', 2.8)}</span><span data-k="addt${i}">Ajouter</span></span></div>
        </div>`).join('')}
        <div class="bq-cart" data-k="cart"><div class="bq-tot">Panier<b data-k="total">0 F</b></div><div class="bq-cart-ic" data-k="cartic">${icon('bag', 34)}<span class="bq-badge" data-k="badge">0</span></div></div>
        ${[0, 1, 2].map((i) => `<div class="bq-tap" data-k="tap${i}"></div><div class="bq-fly" data-k="fly${i}"></div>`).join('')}
      </div>
      <div class="bq-band" data-k="band">${trameBand(4, 11, 21, 160)}</div>`);
    const k = document.getElementById('root').getBoundingClientRect();
    const sc = k.width / 1920;
    const c = (n) => { const q = n.getBoundingClientRect(); return { x: (q.left + q.width / 2 - k.left) / sc, y: (q.top + q.height / 2 - k.top) / sc }; };
    const btn = [0, 1, 2].map((i) => c(r[`add${i}`]));
    const cart = c(r.cartic);
    return { r, btn, cart, prods };
  },

  update(s, lt, ctx, tg) {
    const { r } = s;
    const cue = (n) => ctx.c(`E1.${n}`);
    const tBand = cue('band'), tOut = cue('out');

    // Le Pagne : bande de trame inclinee de 12 degres qui balaie de gauche a droite ; le contenu apparait derriere elle
    const u = E.glisse(prog(lt, tBand, tBand + 0.8));
    const bx = lerp(-900, 2300, u);
    r.band.style.transform = `translateX(${bx}px) rotate(12deg)`;
    show(r.band, u > 0 && u < 1 ? 1 : 0);
    const edge = bx - 60; // bord arriere de la bande
    r.content.style.clipPath = u >= 1 ? 'none' : `polygon(-400px 0, ${edge + 230}px 0, ${edge}px 1080px, -400px 1080px)`;

    updateCaption(r, lt, [{ tin: tBand + 0.3, tout: tOut + 0.35 }]);
    show(r.glow, 0.8 + 0.2 * ctx.pulse(tg, 4));

    // Cartes produit : une par temps, legere rotation 3D, flottement
    const out = E.sortie(prog(lt, tOut, ctx.dur));
    let count = 0, total = 0;
    [0, 1, 2].forEach((i) => {
      const t0 = cue(`p${i + 1}`);
      const a = lt >= t0 ? spring(lt, t0, 1.7, 6.5) : 0;
      const bob = 6 * Math.sin((lt - i * 0.7) * 1.3);
      const tAdd = cue(`add${i + 1}`);
      const press = blip(lt, tAdd, 0.06, 0.25);
      const card = r[`card${i}`];
      card.style.transform = `perspective(1600px) translate(${-out * (900 + i * 120)}px, ${lerp(140, 0, Math.min(a, 1.15)) + bob}px) rotateY(${lerp(28, 0, Math.min(1, a)) - 8 * out}deg) scale(${1 - 0.02 * press})`;
      show(card, lt >= t0 - 0.02 ? 1 - prog(out, 0.6, 1) : 0);
      show(r[`socle${i}`], (lt >= t0 ? Math.min(1, a) : 0) * (1 - out) * (0.25 + 0.15 * ctx.pulse(tg, 5)));
      // Ajout : tap, bouton qui passe a "Ajoute", pastille qui vole jusqu'au panier
      const done = lt >= tAdd;
      r[`add${i}`].classList.toggle('done', done);
      if (r[`addt${i}`].textContent !== (done ? 'Ajouté' : 'Ajouter')) {
        r[`addt${i}`].textContent = done ? 'Ajouté' : 'Ajouter';
        r[`addi${i}`].innerHTML = icon(done ? 'check' : 'plus', 18, 'currentColor', 2.8);
      }
      r[`add${i}`].style.transform = `scale(${1 - 0.1 * press})`;
      const b = s.btn[i];
      const tap = r[`tap${i}`];
      const ta = lt - tAdd;
      if (ta > 0 && ta < 0.45) { tap.style.left = `${b.x}px`; tap.style.top = `${b.y}px`; tap.style.transform = `scale(${1 + 1.4 * E.expo(ta / 0.45)})`; show(tap, 1 - ta / 0.45); }
      else show(tap, 0);
      const fl = r[`fly${i}`];
      const fu = prog(lt, tAdd + 0.02, tAdd + 0.48);
      if (fu > 0 && fu < 1) {
        const e = E.glisse(fu);
        const cx = (b.x + s.cart.x) / 2, cy = Math.min(b.y, s.cart.y) - 260;
        const x = (1 - e) * (1 - e) * b.x + 2 * (1 - e) * e * cx + e * e * s.cart.x;
        const y = (1 - e) * (1 - e) * b.y + 2 * (1 - e) * e * cy + e * e * s.cart.y;
        fl.style.left = `${x}px`; fl.style.top = `${y}px`;
        fl.style.transform = `scale(${1 - 0.4 * e})`;
        show(fl, 1);
      } else show(fl, 0);
      if (lt >= tAdd + 0.48) { count++; total += s.prods[i].price; }
    });
    // Panier : badge qui rebondit a chaque arrivee
    const arrivals = [1, 2, 3].map((n) => cue(`add${n}`) + 0.48);
    const last = arrivals.filter((a) => lt >= a).pop();
    const pop = last !== undefined ? blip(lt, last, 0.02, 0.35) : 0;
    r.badge.textContent = String(count);
    r.badge.style.transform = `scale(${(count ? 1 : 0.001) * (1 + 0.45 * pop)})`;
    r.cartic.style.transform = `rotate(${8 * pop * Math.sin((lt - (last || 0)) * 40)}deg) scale(${1 + 0.08 * pop})`;
    r.total.textContent = `${xof(total)} F`;
    show(r.cart, tw(lt, cue('p1'), 0.4, 0, 1) * (1 - out));
    r.cart.style.transform = `translateY(${tw(lt, cue('p1'), 0.5, -20, 0)}px)`;
  },
};
