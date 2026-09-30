// Analyse d'un fichier audio : duree, tempo (BPM), premier temps fort, grille de temps,
// attaques (onsets), accents, silences et phrases de voix off.
//
//   node scripts/analyze-audio.mjs audio/musique.wav [--out audio/analysis.json] [--noise -35] [--min-silence 0.25]
//   Options : --bpm-min 70 --bpm-max 180 --bpm-hint 120 (tempo attendu, departage les octaves)
//
// Pour une voix off seule : les "phrases" (zones non silencieuses) servent au recalage plan par plan.
// Pour une musique : bpm + offset (premier temps fort) servent au recalage global sur la grille.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { VIDEO_DIR, ffmpegPath, run, parseArgs } from './lib.mjs';

const args = parseArgs();
const input = args._[0];
if (!input) { console.error('Usage : node scripts/analyze-audio.mjs <fichier audio> [--out audio/analysis.json]'); process.exit(1); }
const file = path.resolve(process.cwd(), input);
if (!fs.existsSync(file)) { console.error(`Fichier introuvable : ${file}`); process.exit(1); }
const outFile = path.resolve(VIDEO_DIR, args.out || 'audio/analysis.json');
const SR = 22050, HOP = 512, WIN = 1024;
const noiseDb = Number(args.noise ?? -35);
const minSil = Number(args['min-silence'] ?? 0.25);
const bpmMin = Number(args['bpm-min'] ?? 70), bpmMax = Number(args['bpm-max'] ?? 180);
const bpmHint = Number(args['bpm-hint'] ?? 120);
const ffmpeg = await ffmpegPath();

// 1. Decodage PCM mono float32
function decode() {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-i', file, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-']);
    const chunks = [];
    let err = '';
    p.stdout.on('data', (d) => chunks.push(d));
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (c) => {
      if (c !== 0) return reject(new Error(err));
      const buf = Buffer.concat(chunks);
      resolve(new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 4)));
    });
  });
}
const pcm = await decode();
const duration = pcm.length / SR;

// 2. Silences via le filtre ffmpeg silencedetect
const { err: silLog } = await run(ffmpeg, ['-hide_banner', '-nostats', '-i', file, '-af', `silencedetect=noise=${noiseDb}dB:d=${minSil}`, '-f', 'null', '-'], { quiet: true });
const silences = [];
let cur = null;
for (const line of silLog.split('\n')) {
  const s = line.match(/silence_start: ([\d.]+)/);
  const e = line.match(/silence_end: ([\d.]+) \| silence_duration: ([\d.]+)/);
  if (s) cur = { start: Number(s[1]) };
  if (e && cur) { cur.end = Number(e[1]); cur.dur = Number(e[2]); silences.push(cur); cur = null; }
}
if (cur) { cur.end = duration; cur.dur = duration - cur.start; silences.push(cur); }
const phrases = [];
let t = 0;
for (const s of silences) { if (s.start - t > 0.12) phrases.push({ start: +t.toFixed(3), end: +s.start.toFixed(3) }); t = s.end; }
if (duration - t > 0.12) phrases.push({ start: +t.toFixed(3), end: +duration.toFixed(3) });

// 3. Enveloppe RMS + flux spectral (onsets) via FFT radix-2
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}
const nFrames = Math.max(1, Math.floor((pcm.length - WIN) / HOP) + 1);
const fr = SR / HOP; // images d'analyse par seconde
const LAT = WIN / 2 / SR; // une attaque est datee au centre de la fenetre d'analyse
const hann = Float32Array.from({ length: WIN }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / WIN));
const rms = new Float32Array(nFrames), flux = new Float32Array(nFrames), low = new Float32Array(nFrames);
let prev = new Float32Array(WIN / 2);
const lowBin = Math.round(160 / (SR / WIN));
for (let f = 0; f < nFrames; f++) {
  const re = new Float32Array(WIN), im = new Float32Array(WIN);
  let e = 0;
  for (let i = 0; i < WIN; i++) { const v = pcm[f * HOP + i] || 0; e += v * v; re[i] = v * hann[i]; }
  rms[f] = Math.sqrt(e / WIN);
  fft(re, im);
  const mag = new Float32Array(WIN / 2);
  let fl = 0, lf = 0;
  for (let k = 1; k < WIN / 2; k++) {
    mag[k] = Math.log1p(1000 * Math.hypot(re[k], im[k]));
    const d = mag[k] - prev[k];
    if (d > 0) { fl += d; if (k <= lowBin) lf += d; }
  }
  flux[f] = fl; low[f] = lf; prev = mag;
}
// Normalisation
const norm = (a) => { let m = 0; for (const v of a) m = Math.max(m, v); if (m > 0) for (let i = 0; i < a.length; i++) a[i] /= m; return a; };
norm(flux); norm(low);

// 4. Detection d'attaques : seuil adaptatif (mediane glissante + delta)
const onsets = [];
const W = Math.round(fr * 0.5);
for (let f = 1; f < nFrames - 1; f++) {
  if (flux[f] < flux[f - 1] || flux[f] < flux[f + 1]) continue;
  const win = Array.from(flux.slice(Math.max(0, f - W), Math.min(nFrames, f + W))).sort((a, b) => a - b);
  const med = win[Math.floor(win.length / 2)];
  if (flux[f] > med + 0.08 && flux[f] > 0.1) {
    const tt = f / fr + LAT;
    if (!onsets.length || tt - onsets[onsets.length - 1].t > 0.09) onsets.push({ t: +tt.toFixed(3), s: +flux[f].toFixed(3), low: +low[f].toFixed(3) });
  }
}

// 5. Tempo : autocorrelation de l'enveloppe d'attaques, avec un a priori log-gaussien autour de --bpm-hint
const env = Float32Array.from(flux, (v, i) => Math.max(0, v - (i ? flux[i - 1] * 0.5 : 0)));
let best = { bpm: 0, score: -1 };
for (let bpm = bpmMin; bpm <= bpmMax; bpm += 0.25) {
  const lag = (60 / bpm) * fr;
  let s = 0;
  for (let i = 0; i + lag + 1 < nFrames; i++) {
    const l0 = Math.floor(lag), a = lag - l0;
    s += env[i] * ((1 - a) * env[i + l0] + a * env[i + l0 + 1]);
  }
  const prior = Math.exp(-0.5 * (Math.log2(bpm / bpmHint) / 0.5) ** 2);
  if (s * prior > best.score) best = { bpm, score: s * prior };
}

// 6. Phase : decalage du premier temps maximisant l'energie d'attaque sur la grille ; temps fort = accent basse frequence
const period = (60 / best.bpm) * fr;
let phase = 0, phaseScore = -1;
for (let p = 0; p < period; p += 0.5) {
  let s = 0;
  for (let x = p; x < nFrames; x += period) s += env[Math.round(x)] || 0;
  if (s > phaseScore) { phaseScore = s; phase = p; }
}
// Affinage : regression lineaire des attaques proches de la grille (t = a + b * k) -> tempo et phase precis
let beatPeriod = period / fr, beat0 = phase / fr + LAT;
let coverage = 0;
for (let pass = 0; pass < 2; pass++) {
  const pts = [];
  for (const o of onsets) {
    const k = Math.round((o.t - beat0) / beatPeriod);
    if (k >= 0 && Math.abs(o.t - (beat0 + k * beatPeriod)) < 0.07) pts.push([k, o.t]);
  }
  const nBeats = Math.floor((duration - beat0) / beatPeriod) + 1;
  coverage = new Set(pts.map((p) => p[0])).size / Math.max(1, nBeats);
  if (pts.length < 8) break;
  const n = pts.length, sk = pts.reduce((s, p) => s + p[0], 0), st = pts.reduce((s, p) => s + p[1], 0);
  const skk = pts.reduce((s, p) => s + p[0] * p[0], 0), skt = pts.reduce((s, p) => s + p[0] * p[1], 0);
  const b = (n * skt - sk * st) / (n * skk - sk * sk);
  const a = (st - b * sk) / n;
  if (b > 0) { beatPeriod = b; beat0 = a; }
}
while (beat0 - beatPeriod >= 0) beat0 -= beatPeriod;
best.bpm = Math.round((60 / beatPeriod) * 100) / 100;
const beats = [];
for (let x = beat0; x < duration; x += beatPeriod) beats.push(+x.toFixed(3));
let down = 0, downScore = -1;
for (let k = 0; k < 4; k++) {
  let s = 0;
  for (let i = k; i < beats.length; i += 4) { const f = Math.round((beats[i] - LAT) * fr); s += Math.max(low[f] || 0, low[f + 1] || 0) + 0.5 * Math.max(flux[f] || 0, flux[f + 1] || 0); }
  if (s > downScore) { downScore = s; down = k; }
}
const downbeats = beats.filter((_, i) => i % 4 === down % 4);
const offset = downbeats.length ? downbeats[0] : 0;

// 7. Accents : attaques les plus fortes (impacts a caler sur les coupes)
const accents = [...onsets].sort((a, b) => b.s - a.s).slice(0, 32).sort((a, b) => a.t - b.t);
// Enveloppe RMS a 20 Hz (pour tracer / verifier)
const envelope = [];
for (let f = 0; f < nFrames; f += Math.round(fr / 20)) envelope.push(+(20 * Math.log10(rms[f] + 1e-9)).toFixed(1));

const result = {
  file: path.relative(VIDEO_DIR, file),
  analyzedAt: new Date().toISOString(),
  duration: +duration.toFixed(3),
  bpm: best.bpm, beatCoverage: +coverage.toFixed(2),
  offset, beatsPerBar: 4,
  beats, downbeats, onsets, accents,
  silences: silences.map((s) => ({ start: +s.start.toFixed(3), end: +s.end.toFixed(3), dur: +s.dur.toFixed(3) })),
  phrases,
  envelopeHz: 20, envelopeDb: envelope,
  params: { noiseDb, minSilence: minSil, bpmMin, bpmMax, bpmHint },
};
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(result, null, 1));

console.log(`Fichier      : ${result.file}`);
console.log(`Duree        : ${result.duration.toFixed(2)} s`);
console.log(`Tempo        : ${best.bpm} BPM (temps couverts par une attaque : ${Math.round(coverage * 100)} %${coverage < 0.5 ? ' - faible : voix seule ou tempo libre, preferer --mode phrases' : ''})`);
console.log(`1er temps fort : ${offset.toFixed(3)} s   (${downbeats.length} mesures)`);
console.log(`Attaques     : ${onsets.length}, accents retenus : ${accents.length}`);
console.log(`Silences     : ${silences.length} (seuil ${noiseDb} dB, >= ${minSil} s)`);
console.log(`Phrases      : ${phrases.length}`);
phrases.slice(0, 40).forEach((p, i) => console.log(`   ${String(i + 1).padStart(2)}. ${p.start.toFixed(2).padStart(6)} -> ${p.end.toFixed(2).padStart(6)} s`));
console.log(`-> ${path.relative(process.cwd(), outFile)}`);
