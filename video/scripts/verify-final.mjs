// Controle qualite d'un MP4 final : flux et durees, loudness EBU R128 et crete vraie (apres encodage AAC),
// position reelle des impacts audio par rapport aux temps prevus, images extraites aux impacts.
//
//   node scripts/verify-final.mjs out/festiconnect_80s_1920x1080.mp4 --timeline timeline.json [--frames out/verif]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { VIDEO_DIR, ffmpegPath, parseArgs, readJSON } from './lib.mjs';

const args = parseArgs();
const file = path.resolve(process.cwd(), args._[0]);
const tl = readJSON(path.join(VIDEO_DIR, args.timeline || 'timeline.json'));
const ff = await ffmpegPath();
const run = (a) => spawnSync(ff, ['-hide_banner', ...a], { encoding: 'utf8', maxBuffer: 1 << 28 });

// 1. Flux
const info = run(['-i', file]).stderr;
console.log(info.split('\n').filter((l) => /Duration|Stream/.test(l)).map((l) => l.trim()).join('\n'));

// 2. Loudness et crete vraie
const r = run(['-nostats', '-i', file, '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-']).stderr;
const I = r.match(/I:\s+(-?[\d.]+) LUFS/g)?.pop();
const TP = r.match(/Peak:\s+(-?[\d.]+) dBFS/g)?.pop();
const LRA = r.match(/LRA:\s+(-?[\d.]+) LU/g)?.pop();
console.log(`Loudness integree ${I} ; crete vraie ${TP} ; ${LRA}`);

// 3. Impacts : pic d'energie grave (< 150 Hz) le plus proche de chaque temps prevu
const plans = Object.fromEntries(tl.sequences.flatMap((s) => s.plans).map((p) => [p.id, p]));
const cue = (id, n) => (plans[id] && plans[id].cues && n in plans[id].cues ? plans[id].start + plans[id].cues[n] : null);
const expected = [
  ['logo (drop)', plans.C1?.start], ['billet valide', cue('D4', 'valid')], ['admin valide', cue('G1', 'stamp')], ['final', plans.H2?.start],
].filter(([, t]) => t != null);
const SR = 8000;
const pcm = spawnSync(ff, ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(SR), '-af', 'lowpass=f=150', '-f', 'f32le', '-'], { maxBuffer: 1 << 28 }).stdout;
const x = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length / 4);
const hop = SR / 100;
const env = [];
for (let i = 0; i + hop <= x.length; i += hop) { let e = 0; for (let j = 0; j < hop; j++) e += x[i + j] ** 2; env.push(e); }
for (const [name, t] of expected) {
  // attaque : premiere trame (10 ms) dont l'energie grave depasse de 6 dB la moyenne des 100 ms precedentes
  let bt = null;
  for (let k = Math.round((t - 0.15) * 100); k <= Math.round((t + 0.15) * 100) && bt === null; k++) {
    let prev = 0;
    for (let j = k - 10; j < k; j++) prev += (env[j] || 0) / 10;
    if ((env[k] || 0) > 4 * prev && env[k] > 0) bt = k / 100;
  }
  if (bt === null) { console.log(`Impact ${name.padEnd(14)} prevu ${t.toFixed(2)} s : aucune attaque nette detectee`); continue; }
  console.log(`Impact ${name.padEnd(14)} prevu ${t.toFixed(2)} s, mesure ${bt.toFixed(2)} s (ecart ${Math.round((bt - t) * 1000)} ms)`);
}

// 4. Images aux impacts
if (args.frames) {
  const dir = path.resolve(process.cwd(), args.frames);
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, t] of expected) {
    const out = path.join(dir, `${path.basename(file, '.mp4')}_${t.toFixed(2)}s.png`);
    run(['-v', 'error', '-y', '-ss', String(t + 0.1), '-i', file, '-frames:v', '1', out]);
    console.log(`image : ${out} (${name})`);
  }
}
