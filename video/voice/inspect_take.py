"""Aide au montage d'une prise de voix continue : transcription de chaque segment (Whisper) et carte des pauses.

    python video/voice/inspect_take.py source.wav cuts.json <dossier whisper> [--pad 0.25]
Pour chaque ligne de cuts.json : texte reconnu, niveau, pauses internes (> 150 ms) et silence de part et d'autre
des bornes (pour verifier qu'aucun mot n'est coupe).
"""
import json
import sys
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf

from asr_check import recognizer, transcribe, wer

src, cuts_p, wdir = sys.argv[1:4]
x, sr = sf.read(src, dtype="float64")
cuts = json.loads(Path(cuts_p).read_text())
rec = recognizer(wdir)
hop = int(0.01 * sr)
env = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2)) for i in range(0, len(x) - hop, hop)])
db = 20 * np.log10(env + 1e-9)
floor = np.percentile(db, 5)
thr = floor + 14
print(f"plancher de bruit ~{floor:.1f} dBFS, seuil de parole {thr:.1f} dBFS")
tmp = Path(tempfile.mkdtemp())


def pauses(a, b, min_len=0.15):
    seg = db[int(a * 100):int(b * 100)] < thr
    out, s = [], None
    for i, v in enumerate(seg):
        if v and s is None:
            s = i
        if (not v or i == len(seg) - 1) and s is not None:
            if (i - s) / 100 >= min_len:
                out.append((round(a + s / 100, 2), round(a + i / 100, 2)))
            s = None
    return out


for c in cuts["lines"]:
    a, b = c["in"], c["out"]
    p = tmp / f"{c['id']}.wav"
    sf.write(p, x[int(a * sr):int(b * sr)], sr)
    hyp = transcribe(rec, str(p))
    lv_in = db[max(0, int(a * 100) - 3):int(a * 100) + 3].max()
    lv_out = db[int(b * 100) - 3:int(b * 100) + 3].max()
    ps = [q for q in pauses(a, b) if q[0] > a + 0.02 and q[1] < b - 0.02]
    print(f"{c['id']} [{a:.2f}-{b:.2f}] {b - a:.2f}s  bord in {lv_in:.0f} dB / out {lv_out:.0f} dB  WER {wer(c['text'], hyp):.0%}")
    print(f"     attendu : {c['text']}")
    print(f"     entendu : {hyp}")
    if ps:
        print("     pauses  : " + ", ".join(f"{s:.2f}-{e:.2f} ({e - s:.2f}s)" for s, e in ps))
# zones hors lignes contenant du signal (bruits parasites eventuels)
covered = np.zeros(len(db), bool)
for c in cuts["lines"]:
    covered[int(c["in"] * 100):int(c["out"] * 100)] = True
loud = (db > thr) & ~covered
runs, s = [], None
for i, v in enumerate(loud):
    if v and s is None:
        s = i
    if not v and s is not None:
        if i - s >= 3:
            runs.append((s / 100, i / 100, db[s:i].max()))
        s = None
print("signal hors lignes : " + (", ".join(f"{a:.2f}-{b:.2f} ({m:.0f} dB)" for a, b, m in runs) or "aucun"))
