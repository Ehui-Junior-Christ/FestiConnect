"""Mixage final : voix off + musique + sound design, ducking de la musique sous la voix, master -14 LUFS / -1 dBTP.

    python video/music/mix.py --voice video/audio/voix_80s/voix.wav --music video/audio/musique_80s/musique.wav \
        --sfx video/audio/musique_80s/sfx.wav --out video/audio/mix_80s.wav

Le ducking (sidechain) suit l'enveloppe de la voix avec une anticipation de 60 ms : la musique baisse juste avant
chaque phrase et remonte en 350 ms. Le master est verifie en crete vraie (sur-echantillonnage x4).
"""
import argparse
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "voice"))
import dsp  # noqa: E402

SR = 48000


def load(p, n=None):
    x, sr = sf.read(p, dtype="float64", always_2d=True)
    assert sr == SR, f"{p} : {sr} Hz (48 kHz attendu)"
    if x.shape[1] == 1:
        x = np.repeat(x, 2, axis=1)
    if n is not None:
        x = np.pad(x, ((0, max(0, n - len(x))), (0, 0)))[:n]
    return x


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", required=True)
    ap.add_argument("--music", required=True)
    ap.add_argument("--sfx")
    ap.add_argument("--out", required=True)
    ap.add_argument("--duck-db", type=float, default=7.0)
    ap.add_argument("--music-lufs", type=float, default=-21.0, help="niveau de la musique avant ducking")
    ap.add_argument("--voice-lufs", type=float, default=-15.5)
    ap.add_argument("--sfx-db", type=float, default=-9.0, help="gain du sound design par rapport a la voix")
    ap.add_argument("--target", type=float, default=-14.0)
    ap.add_argument("--ceiling", type=float, default=-1.2)
    a = ap.parse_args()

    v = load(a.voice)
    n = len(v)
    m = load(a.music, n)
    fx = load(a.sfx, n) if a.sfx else np.zeros_like(m)

    v = dsp.normalize_lufs(v, SR, a.voice_lufs)
    m = dsp.normalize_lufs(m, SR, a.music_lufs)
    fx = fx * 10 ** (a.sfx_db / 20) * (np.abs(v).max() / (np.abs(fx).max() + 1e-9))

    # Sidechain : enveloppe RMS de la voix -> reduction de gain de la musique (et un peu du sound design)
    vm = v.mean(axis=1)
    win = int(0.03 * SR)
    rms = np.sqrt(np.convolve(vm ** 2, np.ones(win) / win, mode="same"))
    active = np.clip((20 * np.log10(rms + 1e-9) + 45) / 15, 0, 1)  # 0 sous -45 dB, 1 au-dessus de -30 dB
    look = int(0.06 * SR)
    active = np.concatenate([active[look:], np.zeros(look)])
    target_gain = 10 ** (-a.duck_db * active / 20)
    g = dsp.smooth_gain(target_gain, SR, attack=0.04, release=0.35)
    m = m * g[:, None]
    fx = fx * (0.5 + 0.5 * g)[:, None]

    mix = v + m + fx
    # Master : legere compression de bus, normalisation, limiteur crete vraie (2 passes pour tenir la cible)
    mix = dsp.compress(mix, SR, threshold_db=-14, ratio=1.8, attack=0.015, release=0.2, knee_db=8)
    for _ in range(3):
        mix = dsp.normalize_lufs(mix, SR, a.target)
        mix = dsp.limiter(mix, SR, ceiling_db=a.ceiling)
    lufs, tp = dsp.lufs(mix, SR), dsp.true_peak_db(mix, SR)
    sf.write(a.out, mix.astype(np.float32), SR, subtype="PCM_24")
    print(f"mix : {lufs:.2f} LUFS integres, crete vraie {tp:.2f} dBTP, {n / SR:.2f} s -> {a.out}")


if __name__ == "__main__":
    main()
