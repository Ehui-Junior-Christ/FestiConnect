// Moteur de scene deterministe.
// Le rendu est pilote de l'exterieur : window.__seek(t) dessine l'image exacte au temps t.
// En mode lecture (?play=1) une boucle rAF appelle __seek avec l'horloge reelle, pour la previsualisation.
import { rng, clamp } from './motion.js';

const W = 1920, H = 1080;
const params = new URLSearchParams(location.search);

function planIndex(tl) {
  const plans = [];
  for (const seq of tl.sequences) {
    seq.start = Math.min(...seq.plans.map((p) => p.start));
    seq.end = Math.max(...seq.plans.map((p) => p.end));
    for (const p of seq.plans) plans.push({ ...p, seq: seq.id });
  }
  return plans.sort((a, b) => a.start - b.start);
}

function makeCtx(seq, tl, content) {
  const beat = 60 / tl.music.bpm;
  const offset = tl.music.offset || 0;
  const planMap = Object.fromEntries(seq.plans.map((p) => [p.id, p]));
  const ctx = {
    W, H, tl, seq, content, beat,
    bar: beat * (tl.music.beatsPerBar || 4),
    dur: seq.end - seq.start,
    fps: tl.output.fps,
    // Temps local (sequence) d'un plan : ctx.p('D2') -> { s, e }
    p(id) {
      const pl = planMap[id];
      if (!pl) throw new Error(`Plan inconnu ${id} dans la sequence ${seq.id}`);
      return { s: pl.start - seq.start, e: pl.end - seq.start, d: pl.end - pl.start };
    },
    // Cue locale a la sequence : ctx.c('D1.tap') ; def utilise si la cue manque dans timeline.json
    c(name, def) {
      const [pid, cue] = name.split('.');
      const pl = planMap[pid];
      if (!pl) throw new Error(`Plan inconnu ${pid} (cue ${name})`);
      const v = pl.cues && cue in pl.cues ? pl.cues[cue] : def;
      if (v === undefined) throw new Error(`Cue manquante ${name} dans timeline.json`);
      return pl.start - seq.start + v;
    },
    // Enveloppe de pulsation sur les temps (1 au temps, decroissance exponentielle)
    pulse(tg, decay = 7, every = 1) {
      const period = beat * every;
      const ph = ((tg - offset) % period + period) % period;
      return tg < offset ? 0 : Math.exp(-ph * decay);
    },
    beatIndex(tg) { return Math.floor((tg - offset) / beat + 1e-6); },
  };
  return ctx;
}

async function loadFonts() {
  const specs = [
    '800 100px "Bricolage Grotesque Variable"', '600 100px "Bricolage Grotesque Variable"', '400 100px "Bricolage Grotesque Variable"',
    '400 40px Sora', '500 40px Sora', '600 40px Sora', '700 40px Sora', '800 40px Sora',
    '400 40px "JetBrains Mono"', '500 40px "JetBrains Mono"', '700 40px "JetBrains Mono"',
  ];
  await Promise.all(specs.map((s) => document.fonts.load(s, 'AaÉéèàçôı0123456789')));
  await document.fonts.ready;
}

function makeGrain(root) {
  const layer = document.createElement('div');
  layer.className = 'grain';
  root.appendChild(layer);
  const urls = [];
  const r = rng(1234);
  for (let k = 0; k < 8; k++) {
    const cv = document.createElement('canvas');
    cv.width = 384; cv.height = 384;
    const g = cv.getContext('2d');
    const img = g.createImageData(384, 384);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.floor(r() * 255);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    urls.push(`url(${cv.toDataURL('image/png')})`);
  }
  return (frame) => {
    layer.style.backgroundImage = urls[frame % urls.length];
    layer.style.backgroundPosition = `${(frame * 97) % 384}px ${(frame * 211) % 384}px`;
  };
}

async function init() {
  const tlPath = params.get('timeline') || '../timeline.json';
  const tl = await (await fetch(tlPath, { cache: 'no-store' })).json();
  const content = await (await fetch('../content.json', { cache: 'no-store' })).json();
  const outW = Number(params.get('w')) || tl.output.width;
  const outH = Number(params.get('h')) || Math.round(outW * H / W);
  const hud = Number(params.get('hud') || 0);

  document.documentElement.style.setProperty('--out-w', `${outW}px`);
  document.documentElement.style.setProperty('--out-h', `${outH}px`);
  const root = document.getElementById('root');
  root.style.transform = `scale(${outW / W})`;
  const scenesEl = document.getElementById('scenes');

  await loadFonts();
  const plans = planIndex(tl);
  const seqs = [];
  for (const seq of tl.sequences) {
    // Un module absent retombe sur "carton" (animatic) ; une erreur dans un module existant remonte.
    const url = new URL(`../scenes/${seq.module}.js`, import.meta.url);
    const exists = (await fetch(url, { method: 'HEAD', cache: 'no-store' })).ok;
    const mod = (await import(exists ? url.href : new URL('../scenes/carton.js', import.meta.url).href)).default;
    const modName = exists ? seq.module : 'carton';
    if (mod.css && !document.getElementById(`css-${modName}`)) {
      const st = document.createElement('style');
      st.id = `css-${modName}`;
      st.textContent = mod.css;
      document.head.appendChild(st);
    }
    const el = document.createElement('div');
    el.className = `scene scene-${modName}`;
    el.dataset.seq = seq.id;
    scenesEl.appendChild(el);
    const ctx = makeCtx(seq, tl, content);
    el.style.display = 'block';
    const state = mod.build(el, ctx) || {};
    el.style.display = 'none';
    seqs.push({ seq, mod, el, ctx, state });
  }

  const grain = params.get('grain') === '0' ? null : makeGrain(root);
  const hudEl = document.getElementById('hud');
  const subEl = document.getElementById('sub');
  hudEl.style.display = hud ? 'block' : 'none';
  subEl.style.display = hud >= 2 ? 'block' : 'none';

  const fmt = (t) => {
    const f = Math.round((t % 1) * tl.output.fps);
    const s = Math.floor(t) % 60, m = Math.floor(t / 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
  };

  window.__seek = (t) => {
    for (const s of seqs) {
      const vis = t >= s.seq.start && t < s.seq.end;
      if (vis) {
        s.el.style.display = 'block';
        s.mod.update(s.state, t - s.seq.start, s.ctx, t);
      } else if (s.el.style.display !== 'none') {
        s.el.style.display = 'none';
      }
    }
    const frame = Math.round(t * tl.output.fps);
    if (grain) grain(frame);
    if (hud) {
      const pl = plans.find((p) => t >= p.start && t < p.end);
      const beat = 60 / tl.music.bpm;
      const b = Math.floor((t - (tl.music.offset || 0)) / beat);
      const bpb = tl.music.beatsPerBar || 4;
      hudEl.textContent = `${fmt(t)}  f${String(frame).padStart(4, '0')}  ${pl ? pl.id : '--'}  mes. ${Math.floor(b / bpb) + 1}.${(b % bpb) + 1}`;
      if (hud >= 2) {
        const voOn = pl && pl.vo && t >= pl.start + (pl.voAt || 0);
        subEl.textContent = voOn ? pl.vo : '';
        subEl.style.opacity = voOn ? 1 : 0;
      }
    }
    return true;
  };

  window.__timeline = { duration: tl.duration, fps: tl.output.fps, width: tl.output.width, height: tl.output.height, audio: tl.audio, crf: tl.output.crf, preset: tl.output.preset };
  window.__seek(Number(params.get('t') || 0));
  window.__ready = true;

  if (params.get('play')) startPlayer(tl, clamp(Number(params.get('t') || 0), 0, tl.duration));
}

// Lecteur temps reel pour relecture dans un navigateur (non utilise pour le rendu).
function startPlayer(tl, t0) {
  let playing = true, base = performance.now(), from = t0;
  const audioSrc = params.get('audio') || (tl.audio && tl.audio.file ? `../${tl.audio.file}` : null);
  const audio = audioSrc ? new Audio(audioSrc) : null;
  const aOff = (tl.audio && tl.audio.offset) || 0;
  const now = () => (playing ? from + (performance.now() - base) / 1000 : from);
  const syncAudio = () => { if (!audio) return; audio.currentTime = Math.max(0, now() - aOff); if (playing) audio.play().catch(() => {}); else audio.pause(); };
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { from = now(); playing = !playing; base = performance.now(); syncAudio(); }
    if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') { from = clamp(now() + (e.code === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 0.1 : 2), 0, tl.duration); base = performance.now(); syncAudio(); }
  });
  syncAudio();
  const loop = () => { let t = now(); if (t >= tl.duration) { from = 0; base = performance.now(); t = 0; syncAudio(); } window.__seek(t); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}

init().catch((err) => {
  window.__error = String(err && err.stack || err);
  document.body.insertAdjacentHTML('beforeend', `<pre style="color:#f55;position:fixed;inset:0;z-index:99;padding:20px">${window.__error}</pre>`);
});
