"""Mesures objectives d'une piste : equilibre spectral par bandes, loudness court terme par fenetre, crete vraie.

    python video/music/measure.py fichier.wav [--win 2]
"""
import sys
from pathlib import Path

import numpy as np
import pyloudnorm as pyln
import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "voice"))
import dsp  # noqa: E402

BANDS = [("sub <60", 20, 60), ("grave 60-250", 60, 250), ("bas-medium 250-800", 250, 800),
         ("medium 0,8-2,5k", 800, 2500), ("presence 2,5-6k", 2500, 6000), ("aigu 6-16k", 6000, 16000)]

if __name__ == "__main__":
    x, sr = sf.read(sys.argv[1], dtype="float64")
    win = float(sys.argv[sys.argv.index("--win") + 1]) if "--win" in sys.argv else 2.0
    mono = x.mean(axis=1) if x.ndim > 1 else x
    spec = np.abs(np.fft.rfft(mono)) ** 2
    f = np.fft.rfftfreq(len(mono), 1 / sr)
    tot = spec[(f > 20) & (f < 16000)].sum()
    print("Equilibre spectral (part de l'energie) :")
    for name, lo, hi in BANDS:
        e = spec[(f >= lo) & (f < hi)].sum() / tot
        print(f"  {name:20s} {10 * np.log10(e + 1e-12):6.1f} dB  {'#' * int(e * 60)}")
    m = pyln.Meter(sr)
    print(f"Loudness integree : {m.integrated_loudness(x):.1f} LUFS ; crete vraie : {dsp.true_peak_db(x, sr):.2f} dBTP ; "
          f"crete echantillon : {20 * np.log10(np.abs(x).max()):.2f} dBFS")
    print(f"Loudness par fenetre de {win:g} s :")
    row = []
    for i in range(0, int(len(x) / sr / win)):
        seg = x[int(i * win * sr):int((i + 1) * win * sr)]
        try:
            l = m.integrated_loudness(seg)
        except Exception:
            l = -70
        row.append(f"{i * win:4.0f}s {l:6.1f}")
    for i in range(0, len(row), 8):
        print("  " + " | ".join(row[i:i + 8]))
