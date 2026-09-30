"""Comparatif objectif des voix TTS : meme phrase, mesures de debit, prosodie, bande passante, artefacts.

    python video/voice/compare.py <dossier_modeles> <dossier_sortie>
"""
import json
import sys
import time
from pathlib import Path

import numpy as np
import soundfile as sf

from engines import VOICES, make_tts

TEXT = ("Tu paies avec Wave, Orange Money ou Moov Money, depuis ton téléphone. "
        "Pas de file, pas de monnaie.")
WORDS = len(TEXT.replace(",", " ").replace(".", " ").split())


def f0_track(x, sr, fmin=70, fmax=400):
    """F0 par autocorrelation normalisee sur trames de 40 ms (pas 10 ms)."""
    n, hop = int(0.04 * sr), int(0.01 * sr)
    lo, hi = int(sr / fmax), int(sr / fmin)
    f0 = []
    for i in range(0, len(x) - n - hi, hop):
        fr = x[i:i + n + hi]
        if np.sqrt(np.mean(fr[:n] ** 2)) < 0.02:
            continue
        a = fr[:n] - fr[:n].mean()
        best, bl = 0, 0
        for lag in range(lo, hi):
            b = fr[lag:lag + n] - fr[lag:lag + n].mean()
            c = np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9)
            if c > best:
                best, bl = c, lag
        if best > 0.75:
            f0.append(sr / bl)
    return np.array(f0)


def metrics(x, sr, gen_time):
    dur = len(x) / sr
    spec = np.abs(np.fft.rfft(x * np.hanning(len(x)))) ** 2
    freqs = np.fft.rfftfreq(len(x), 1 / sr)
    cum = np.cumsum(spec) / spec.sum()
    bw99 = float(freqs[np.searchsorted(cum, 0.99)])
    centroid = float((freqs * spec).sum() / spec.sum())
    f0 = f0_track(x, sr)
    st = 12 * np.log2(f0 / np.median(f0)) if len(f0) else np.array([0])
    # Pauses internes (> 120 ms sous -40 dB) : respiration du phrase
    env = np.convolve(np.abs(x), np.ones(int(0.02 * sr)) / (0.02 * sr), mode="same")
    silent = env < 10 ** (-40 / 20)
    runs, cur = 0, 0
    for s in silent[int(0.2 * sr):-int(0.2 * sr)]:
        cur = cur + 1 if s else 0
        if cur == int(0.12 * sr):
            runs += 1
    return {
        "duree_s": round(dur, 2), "mots_par_s": round(WORDS / dur, 2),
        "f0_median_hz": round(float(np.median(f0)), 1) if len(f0) else None,
        "f0_etendue_demitons_p10_p90": round(float(np.percentile(st, 90) - np.percentile(st, 10)), 2),
        "f0_ecart_type_demitons": round(float(np.std(st)), 2),
        "pauses_internes": runs, "bande_99pct_hz": round(bw99), "centroide_hz": round(centroid),
        "crete_dbfs": round(float(20 * np.log10(np.abs(x).max() + 1e-9)), 1),
        "temps_generation_s": round(gen_time, 2),
    }


if __name__ == "__main__":
    models, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    report = {}
    for name in VOICES:
        try:
            say = make_tts(name, models)
        except Exception as e:
            print(f"{name}: indisponible ({e})")
            continue
        t0 = time.time()
        x, sr = say(TEXT)
        m = metrics(x, sr, time.time() - t0)
        m["frequence_echantillonnage"] = sr
        m["licence"] = VOICES[name][4]
        sf.write(out / f"{name}.wav", x, sr, subtype="PCM_16")
        report[name] = m
        print(name, json.dumps(m, ensure_ascii=False))
    (out / "comparatif.json").write_text(json.dumps({"texte": TEXT, "voix": report}, ensure_ascii=False, indent=2))
