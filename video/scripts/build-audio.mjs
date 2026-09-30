// Chaine audio complete : voix off TTS + musique originale + sound design -> mix maitre (-14 LUFS, -1 dBTP).
//
//   npm run audio                       les deux versions (80 s et 30 s)
//   npm run audio -- --version 80       une seule version
//   npm run audio -- --skip-voice       garde les voix deja generees (ex. une vraie voix deposee dans audio/voix_80s/voix.wav)
//
// Prerequis : Python 3 avec voice/requirements.txt (variable PYTHON, defaut python3) et les modeles TTS
// (variable TTS_MODELS, defaut ../.tts-models ; telechargement : python voice/fetch_models.py <dossier> kokoro-multi-lang-v1_0).
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { VIDEO_DIR, parseArgs } from './lib.mjs';

const args = parseArgs();
const PY = process.env.PYTHON || 'python3';
const MODELS = process.env.TTS_MODELS || path.join(VIDEO_DIR, '..', '.tts-models');
const versions = args.version ? [String(args.version)] : ['80', '30'];
const cfg = {
  80: { timeline: 'timeline.json', tail: '1.2' },
  30: { timeline: 'timeline-30s.json', tail: '0.7' },
};

function py(script, ...a) {
  console.log(`> ${PY} ${script} ${a.join(' ')}`);
  const r = spawnSync(PY, [path.join(VIDEO_DIR, script), ...a], { stdio: 'inherit', cwd: VIDEO_DIR });
  if (r.status !== 0) process.exit(r.status || 1);
}

for (const v of versions) {
  const c = cfg[v];
  if (!c) { console.error(`Version inconnue : ${v}`); process.exit(1); }
  if (!args['skip-voice']) py('voice/make_voice.py', '--timeline', c.timeline, '--models', MODELS, '--out', `audio/voix_${v}s`, '--tail', c.tail);
  if (!args['skip-music']) py('music/compose.py', '--timeline', c.timeline, '--out', `audio/musique_${v}s`);
  py('music/mix.py', '--voice', `audio/voix_${v}s/voix.wav`, '--music', `audio/musique_${v}s/musique.wav`,
    '--sfx', `audio/musique_${v}s/sfx.wav`, '--out', `audio/mix_${v}s.wav`);
}
