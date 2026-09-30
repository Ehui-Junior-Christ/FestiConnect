// Chaine audio complete : voix off + musique originale + sound design -> mix maitre audio/mix_<v>s.wav
// (-14 LUFS, -1 dBTP), reference par audio.file dans les timelines.
//
//   npm run audio                          les deux versions (80 s et 30 s)
//   npm run audio -- --version 80          une seule version
//   npm run audio -- --voice tts           force la voix de synthese (sinon : vraie voix si disponible)
//   npm run audio -- --skip-voice / --skip-music   garde les pistes deja generees
//
// Voix reelle : prise du proprietaire dans audio/voix_proprietaire/source.wav, montee selon voice/vo_edit_<v>s.json
// (voice/real_voice.py). Voix de synthese : voice/make_voice.py (modeles TTS dans TTS_MODELS, defaut ../.tts-models).
// Prerequis : Python 3 avec voice/requirements.txt (variable PYTHON, defaut python3).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { VIDEO_DIR, parseArgs, readJSON } from './lib.mjs';

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
  const edit = path.join(VIDEO_DIR, 'voice', `vo_edit_${v}s.json`);
  const real = args.voice !== 'tts' && fs.existsSync(edit) && fs.existsSync(path.join(VIDEO_DIR, readJSON(edit).source));
  const voiceDir = real ? `audio/voix_${v}s_reelle` : `audio/voix_${v}s`;
  console.log(`Version ${v} s : voix ${real ? 'reelle (proprietaire)' : 'de synthese (TTS)'}`);
  if (!args['skip-voice']) {
    if (real) py('voice/real_voice.py', '--edit', `voice/vo_edit_${v}s.json`, '--out', voiceDir);
    else py('voice/make_voice.py', '--timeline', c.timeline, '--models', MODELS, '--out', voiceDir, '--tail', c.tail);
  }
  if (!args['skip-music']) py('music/compose.py', '--timeline', c.timeline, '--out', `audio/musique_${v}s`);
  py('music/mix.py', '--voice', `${voiceDir}/voix.wav`, '--music', `audio/musique_${v}s/musique.wav`,
    '--sfx', `audio/musique_${v}s/sfx.wav`, '--out', `audio/mix_${v}s.wav`);
}
