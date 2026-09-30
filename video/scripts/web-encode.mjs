// Version web legere d'un master : H.264 en 2 passes (1080p conserve), taille cible sous --max-mb.
//   node scripts/web-encode.mjs out/festiconnect_80s_1920x1080.mp4 [--audio audio/mix_80s.wav] [--max-mb 28] [--audio-kbps 160]
// --audio : repart du mix WAV maitre (un seul encodage AAC : evite les depassements de crete d'un double encodage).
// Sortie : <nom>_web.mp4 a cote du master.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ffmpegPath, parseArgs } from './lib.mjs';

const args = parseArgs();
const src = path.resolve(process.cwd(), args._[0]);
const maxMb = Number(args['max-mb'] || 28);
const akbps = Number(args['audio-kbps'] || 160);
const ff = await ffmpegPath();
const info = spawnSync(ff, ['-hide_banner', '-i', src], { encoding: 'utf8' }).stderr;
const m = info.match(/Duration: (\d+):(\d+):([\d.]+)/);
const dur = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
// 4 % de marge pour le conteneur et les ecarts du controle de debit
const srcV = Number((info.match(/Video: .*?(\d+) kb\/s/) || [])[1] || 8000);
// plafond : 75 % du debit video du master (une version web ne doit jamais etre plus lourde que le master)
const vkbps = Math.min(8000, Math.round(srcV * 0.75), Math.floor((maxMb * 0.96 * 8e6) / dur / 1000 - akbps));
const out = src.replace(/\.mp4$/, '_web.mp4');
const log = path.join(os.tmpdir(), `x264_${process.pid}`);
const inputs = ['-i', src, ...(args.audio ? ['-i', path.resolve(process.cwd(), args.audio)] : [])];
const common = ['-hide_banner', '-loglevel', 'error', '-y', ...inputs, '-c:v', 'libx264', '-preset', 'slow', '-b:v', `${vkbps}k`,
  '-maxrate', `${Math.round(vkbps * 1.6)}k`, '-bufsize', `${vkbps * 3}k`, '-pix_fmt', 'yuv420p', '-profile:v', 'high',
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-passlogfile', log];
console.log(`${path.basename(src)} : ${dur.toFixed(2)} s, video ${vkbps} kb/s + audio ${akbps} kb/s, 2 passes`);
let r = spawnSync(ff, [...common, '-map', '0:v:0', '-pass', '1', '-an', '-f', 'mp4', os.platform() === 'win32' ? 'NUL' : '/dev/null'], { stdio: 'inherit' });
if (r.status !== 0) process.exit(1);
const maps = ['-map', '0:v:0', '-map', args.audio ? '1:a:0' : '0:a:0', '-t', dur.toFixed(3)];
r = spawnSync(ff, [...common, ...maps, '-pass', '2', '-c:a', 'aac', '-b:a', `${akbps}k`, '-ar', '48000', '-movflags', '+faststart', out], { stdio: 'inherit' });
if (r.status !== 0) process.exit(1);
for (const f of fs.readdirSync(os.tmpdir())) if (f.startsWith(path.basename(log))) fs.rmSync(path.join(os.tmpdir(), f), { force: true });
const mb = fs.statSync(out).size / 1e6;
console.log(`OK ${out} (${mb.toFixed(1)} Mo${mb >= maxMb ? ' : AU-DESSUS DE LA CIBLE' : ''})`);
