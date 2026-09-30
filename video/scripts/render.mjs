// Rendu image par image -> MP4 H.264 (yuv420p), puis mixage de l'audio final.
//
//   node scripts/render.mjs                         film complet 1920x1080, audio de timeline.json si present
//   node scripts/render.mjs --preview               960x540, sans audio, HUD timecode
//   node scripts/render.mjs --from 16 --to 22       extrait
//   node scripts/render.mjs --audio audio/mix.wav   force un fichier audio
//   Options : --width --fps --crf --preset --workers --out --timeline --hud 0|1|2 --mute --frames (garde les PNG dans frames/)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { VIDEO_DIR, startServer, launchBrowser, openStage, capture, ffmpegPath, run, parseArgs, readJSON } from './lib.mjs';

const args = parseArgs();
const timelineFile = args.timeline || 'timeline.json';
const tl = readJSON(path.join(VIDEO_DIR, timelineFile));
const preview = !!args.preview;

const fps = Number(args.fps || tl.output.fps);
const width = Number(args.width || (preview ? 960 : tl.output.width));
const height = Math.round(width * 9 / 16 / 2) * 2;
const crf = Number(args.crf || (preview ? 22 : tl.output.crf));
const preset = args.preset || (preview ? 'veryfast' : tl.output.preset || 'slow');
const from = Number(args.from || 0);
const to = Math.min(Number(args.to || tl.duration), tl.duration);
const hud = Number(args.hud ?? (preview ? 1 : 0));
const workers = Math.max(1, Number(args.workers || Math.min(4, Math.max(1, os.cpus().length - 1))));
const keepFrames = !!args.frames;
// Pistes audio : --audio force un fichier unique ; sinon audio.stems (musique + voix separees) ou audio.file
const stemList = args.audio ? [{ file: args.audio }]
  : tl.audio?.stems?.length ? tl.audio.stems
  : tl.audio?.file ? [{ file: tl.audio.file, offset: tl.audio.offset, gainDb: tl.audio.gainDb }] : [];
const stems = args.mute || (preview && !args.audio) ? [] : stemList;
const audioFile = stems.length ? stems.map((x) => x.file).join(' + ') : null;
const outFile = path.resolve(VIDEO_DIR, args.out || (preview ? `out/preview_${from}-${to}s_${width}.mp4` : `out/festiconnect_${width}x${height}_${fps}fps.mp4`));

const f0 = Math.round(from * fps);
const f1 = Math.round(to * fps);
const total = f1 - f0;
if (total <= 0) { console.error('Plage vide'); process.exit(1); }

const ffmpeg = await ffmpegPath();
const partsDir = path.join(path.dirname(outFile), `.parts_${path.basename(outFile, '.mp4')}`);
fs.rmSync(partsDir, { recursive: true, force: true });
fs.mkdirSync(partsDir, { recursive: true });
const framesDir = path.join(VIDEO_DIR, 'frames');
if (keepFrames) fs.mkdirSync(framesDir, { recursive: true });

console.log(`Rendu ${timelineFile} : ${from}s -> ${to}s, ${total} images, ${width}x${height} @ ${fps} fps, CRF ${crf}, ${workers} worker(s)`);

const encodeArgs = (outPart) => [
  '-hide_banner', '-loglevel', 'error', '-y',
  '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
  '-vf', 'scale=out_color_matrix=bt709:out_range=tv:flags=lanczos+accurate_rnd+full_chroma_int,format=yuv420p',
  '-c:v', 'libx264', '-preset', preset, '-crf', String(crf), '-profile:v', 'high', '-pix_fmt', 'yuv420p',
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
  '-g', String(fps * 2), '-movflags', '+faststart', outPart,
];

const { server, port } = await startServer();
const browser = await launchBrowser();
const started = Date.now();
const done = new Array(workers).fill(0);
const tick = setInterval(() => {
  const n = done.reduce((a, b) => a + b, 0);
  const el = (Date.now() - started) / 1000;
  const eta = n ? (el / n) * (total - n) : 0;
  process.stdout.write(`\r  ${n}/${total} images  ${(n / el).toFixed(1)} img/s  reste ~${Math.ceil(eta)} s   `);
}, 1000);

async function renderChunk(w, a, b) {
  const stage = await openStage(browser, port, { width, height, timeline: timelineFile, hud });
  const part = path.join(partsDir, `part_${String(w).padStart(2, '0')}.mp4`);
  const enc = spawn(ffmpeg, encodeArgs(part), { stdio: ['pipe', 'ignore', 'pipe'] });
  let encErr = '';
  enc.stderr.on('data', (d) => { encErr += d; });
  const closed = new Promise((res, rej) => enc.on('close', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg (part ${w}) : ${encErr}`)))));
  for (let f = a; f < b; f++) {
    const png = await capture(stage, f / fps);
    if (keepFrames) fs.writeFileSync(path.join(framesDir, `f_${String(f).padStart(5, '0')}.png`), png);
    if (!enc.stdin.write(png)) await new Promise((r) => enc.stdin.once('drain', r));
    done[w]++;
  }
  enc.stdin.end();
  await closed;
  await stage.context.close();
  return part;
}

let parts;
try {
  const size = Math.ceil(total / workers);
  const jobs = [];
  for (let w = 0; w < workers; w++) {
    const a = f0 + w * size, b = Math.min(f1, a + size);
    if (a < b) jobs.push(renderChunk(w, a, b));
  }
  parts = await Promise.all(jobs);
} finally {
  clearInterval(tick);
  await browser.close();
  server.close();
}
process.stdout.write('\n');

// Assemblage des segments (copie sans re-encodage)
const list = path.join(partsDir, 'list.txt');
fs.writeFileSync(list, parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'));
const videoOnly = audioFile ? path.join(partsDir, 'video.mp4') : outFile;
fs.mkdirSync(path.dirname(outFile), { recursive: true });
await run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', videoOnly]);

if (stems.length) {
  // Chaque piste : decalage (offset > 0 = l'audio demarre plus tard dans le film), gain ; puis mixage, fondus, loudness.
  const a = tl.audio || {};
  const dur = to - from;
  const inputs = [];
  const chains = [];
  stems.forEach((st, i) => {
    const p = path.resolve(VIDEO_DIR, st.file);
    if (!fs.existsSync(p)) throw new Error(`Audio introuvable : ${p}`);
    inputs.push('-i', p);
    const shift = (st.offset ?? 0) - from;
    const f = ['aformat=sample_rates=48000:channel_layouts=stereo'];
    if (shift > 0) f.push(`adelay=${Math.round(shift * 1000)}:all=1`);
    if (shift < 0) f.push(`atrim=start=${(-shift).toFixed(3)}`, 'asetpts=PTS-STARTPTS');
    if (st.gainDb) f.push(`volume=${st.gainDb}dB`);
    chains.push(`[${i + 1}:a]${f.join(',')}[s${i}]`);
  });
  const post = [];
  if (a.gainDb && stems.length > 1) post.push(`volume=${a.gainDb}dB`);
  if (a.loudnorm) post.push(`loudnorm=I=${a.loudnorm}:TP=-1:LRA=11`);
  post.push('apad');
  if (a.fadeIn) post.push(`afade=t=in:st=0:d=${a.fadeIn}`);
  if (a.fadeOut) post.push(`afade=t=out:st=${Math.max(0, dur - a.fadeOut).toFixed(3)}:d=${a.fadeOut}`);
  const mixIn = stems.map((_, i) => `[s${i}]`).join('');
  const graph = [...chains, `${mixIn}amix=inputs=${stems.length}:normalize=0:duration=longest,${post.join(',')}[aout]`].join(';');
  await run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', videoOnly, ...inputs,
    '-filter_complex', graph, '-map', '0:v:0', '-map', '[aout]', '-c:v', 'copy',
    '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-t', dur.toFixed(3), '-movflags', '+faststart', outFile]);
}
fs.rmSync(partsDir, { recursive: true, force: true });

const secs = ((Date.now() - started) / 1000).toFixed(1);
const mb = (fs.statSync(outFile).size / 1e6).toFixed(1);
console.log(`OK ${outFile} (${mb} Mo, ${secs} s de rendu${audioFile ? `, audio : ${audioFile}` : ', muet'})`);
