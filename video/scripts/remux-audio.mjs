// Remplace l'audio d'un MP4 deja rendu sans refaire le rendu video (copie du flux H.264).
//   node scripts/remux-audio.mjs out/festiconnect_80s_1920x1080.mp4 --timeline timeline.json [--audio audio/mix_80s.wav]
// L'audio par defaut est audio.file de la timeline ; le fondu de fin audio.fadeOut est applique comme au rendu.
import fs from 'node:fs';
import path from 'node:path';
import { VIDEO_DIR, ffmpegPath, run, parseArgs, readJSON } from './lib.mjs';

const args = parseArgs();
const mp4 = path.resolve(process.cwd(), args._[0]);
const tl = readJSON(path.join(VIDEO_DIR, args.timeline || 'timeline.json'));
const audio = path.resolve(VIDEO_DIR, args.audio || tl.audio.file);
const dur = tl.duration;
const fo = tl.audio.fadeOut || 0;
const ff = await ffmpegPath();
const tmp = mp4.replace(/\.mp4$/, '.remux.mp4');
const af = ['apad', fo ? `afade=t=out:st=${(dur - fo).toFixed(3)}:d=${fo}` : null].filter(Boolean).join(',');
await run(ff, ['-hide_banner', '-loglevel', 'error', '-y', '-i', mp4, '-i', audio, '-map', '0:v:0', '-map', '1:a:0',
  '-c:v', 'copy', '-af', af, '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-t', String(dur), '-movflags', '+faststart', tmp]);
fs.renameSync(tmp, mp4);
console.log(`OK ${mp4} (audio : ${path.relative(VIDEO_DIR, audio)})`);
