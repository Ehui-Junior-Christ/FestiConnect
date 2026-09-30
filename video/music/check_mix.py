"""Controle du mix : intelligibilite de chaque phrase dans le mix (ASR) comparee a la voix seule,
et rapport voix / musique sur les zones parlees.

    python video/music/check_mix.py <manifest voix> <mix.wav> <voix.wav> <musique.wav> <dossier whisper>
"""
import json
import sys
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "voice"))
from asr_check import recognizer, transcribe, wer  # noqa: E402

man, mixp, voicep, musicp, wdir = sys.argv[1:6]
lines = json.loads(Path(man).read_text())["lines"]
mix, sr = sf.read(mixp, dtype="float64", always_2d=True)
voice, _ = sf.read(voicep, dtype="float64", always_2d=True)
rec = recognizer(wdir)
tmp = Path(tempfile.mkdtemp())
wm, wv = [], []
for l in lines:
    a, b = int((l["start"] - 0.05) * sr), int((l["end"] + 0.1) * sr)
    for name, src, acc in (("mix", mix, wm), ("voix", voice, wv)):
        p = tmp / f"{l.get('id', l.get('plan'))}_{name}.wav"
        sf.write(p, src[a:b].mean(axis=1), sr)
        acc.append(wer(l["text"], transcribe(rec, str(p))))
    # rapport voix/fond sur la phrase : energie du mix moins la voix = fond (musique + sfx apres ducking)
    seg_mix, seg_v = mix[a:b].mean(axis=1), voice[a:b].mean(axis=1)
    gain = np.dot(seg_mix, seg_v) / (np.dot(seg_v, seg_v) + 1e-12)  # gain de la voix dans le mix
    bg = seg_mix - gain * seg_v
    snr = 10 * np.log10(np.mean((gain * seg_v) ** 2) / (np.mean(bg ** 2) + 1e-12))
    print(f"{l.get('id', l.get('plan')):3s} WER voix {wv[-1]:5.1%}  mix {wm[-1]:5.1%}   voix/fond {snr:5.1f} dB")
print(f"WER moyen : voix seule {np.mean(wv):.1%}, dans le mix {np.mean(wm):.1%}")
