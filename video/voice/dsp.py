"""Traitements audio communs (numpy/scipy) : filtres biquad, compresseur, de-esser, limiteur, loudness."""
import numpy as np
import pyloudnorm as pyln
from scipy.signal import butter, lfilter, resample_poly, sosfilt


def biquad(kind, f0, sr, gain_db=0.0, q=0.707):
    """Coefficients RBJ (Audio EQ Cookbook)."""
    a = 10 ** (gain_db / 40)
    w = 2 * np.pi * f0 / sr
    cw, sw = np.cos(w), np.sin(w)
    alpha = sw / (2 * q)
    if kind == "peak":
        b = [1 + alpha * a, -2 * cw, 1 - alpha * a]
        den = [1 + alpha / a, -2 * cw, 1 - alpha / a]
    elif kind == "lowshelf":
        s = 2 * np.sqrt(a) * alpha
        b = [a * ((a + 1) - (a - 1) * cw + s), 2 * a * ((a - 1) - (a + 1) * cw), a * ((a + 1) - (a - 1) * cw - s)]
        den = [(a + 1) + (a - 1) * cw + s, -2 * ((a - 1) + (a + 1) * cw), (a + 1) + (a - 1) * cw - s]
    elif kind == "highshelf":
        s = 2 * np.sqrt(a) * alpha
        b = [a * ((a + 1) + (a - 1) * cw + s), -2 * a * ((a - 1) + (a + 1) * cw), a * ((a + 1) + (a - 1) * cw - s)]
        den = [(a + 1) - (a - 1) * cw + s, 2 * ((a - 1) - (a + 1) * cw), (a + 1) - (a - 1) * cw - s]
    else:
        raise ValueError(kind)
    b, den = np.array(b) / den[0], np.array(den) / den[0]
    return b, den


def eq(x, sr, kind, f0, gain_db=0.0, q=0.707):
    b, a = biquad(kind, f0, sr, gain_db, q)
    return lfilter(b, a, x, axis=0)


def highpass(x, sr, fc, order=2):
    return sosfilt(butter(order, fc, "highpass", fs=sr, output="sos"), x, axis=0)


def lowpass(x, sr, fc, order=2):
    return sosfilt(butter(order, fc, "lowpass", fs=sr, output="sos"), x, axis=0)


def bandpass(x, sr, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "bandpass", fs=sr, output="sos"), x, axis=0)


def envelope(x, sr, attack=0.005, release=0.08):
    """Suiveur d'enveloppe crete (mono)."""
    ga, gr = np.exp(-1 / (attack * sr)), np.exp(-1 / (release * sr))
    env = np.zeros_like(x)
    e = 0.0
    ax = np.abs(x)
    for i, v in enumerate(ax):
        g = ga if v > e else gr
        e = g * e + (1 - g) * v
        env[i] = e
    return env


def smooth_gain(g, sr, attack, release):
    """Lisse une courbe de gain lineaire (descente rapide, remontee lente)."""
    ga, gr = np.exp(-1 / (attack * sr)), np.exp(-1 / (release * sr))
    out = np.empty_like(g)
    s = 1.0
    for i, v in enumerate(g):
        c = ga if v < s else gr
        s = c * s + (1 - c) * v
        out[i] = s
    return out


def compress(x, sr, threshold_db=-20, ratio=3.0, attack=0.005, release=0.1, makeup_db=0.0, knee_db=6.0):
    mono = x if x.ndim == 1 else x.mean(axis=1)
    lvl = 20 * np.log10(envelope(mono, sr, attack, release) + 1e-9)
    over = lvl - threshold_db
    gr = np.where(over <= -knee_db / 2, 0.0,
                  np.where(over >= knee_db / 2, over * (1 - 1 / ratio),
                           (1 - 1 / ratio) * (over + knee_db / 2) ** 2 / (2 * knee_db)))
    g = 10 ** ((makeup_db - gr) / 20)
    return x * (g if x.ndim == 1 else g[:, None])


def deess(x, sr, freq=6000, threshold_db=-30, max_cut_db=6):
    """De-esser : attenue la bande sibilante quand son enveloppe depasse le seuil."""
    s = highpass(x, sr, freq, 4)
    lvl = 20 * np.log10(envelope(s, sr, 0.002, 0.05) + 1e-9)
    cut = np.clip((lvl - threshold_db) * 0.6, 0, max_cut_db)
    g = 10 ** (-cut / 20)
    return x - s + s * g


def saturate(x, drive=1.5):
    """Saturation douce (tanh) normalisee : un peu de chaleur harmonique."""
    return np.tanh(drive * x) / np.tanh(drive)


def lufs(x, sr):
    return pyln.Meter(sr).integrated_loudness(x)


def normalize_lufs(x, sr, target):
    return pyln.normalize.loudness(x, lufs(x, sr), target)


def true_peak_db(x, sr, oversample=4):
    y = resample_poly(x, oversample, 1, axis=0)
    return 20 * np.log10(np.max(np.abs(y)) + 1e-12)


def limiter(x, sr, ceiling_db=-1.0, lookahead=0.005, release=0.06, oversample=4):
    """Limiteur a anticipation sur la crete sur-echantillonnee (approximation true peak)."""
    ceil = 10 ** (ceiling_db / 20)
    mono_peak = np.abs(x) if x.ndim == 1 else np.abs(x).max(axis=1)
    up = np.abs(resample_poly(x, oversample, 1, axis=0))
    up = up if up.ndim == 1 else up.max(axis=1)
    peak = up[: len(up) // oversample * oversample].reshape(-1, oversample).max(axis=1)
    peak = np.maximum(peak[: len(mono_peak)], mono_peak[: len(peak)])
    need = np.minimum(1.0, ceil / np.maximum(peak, 1e-9))
    la = int(lookahead * sr)
    # anticipation : minimum glissant sur la fenetre a venir
    from scipy.ndimage import minimum_filter1d
    need = minimum_filter1d(need, size=2 * la + 1)  # fenetre centree : la reduction commence la echantillons avant
    g = smooth_gain(need, sr, 0.0005, release)
    g = np.minimum(g, need)  # garantit le plafond
    return x * (g if x.ndim == 1 else g[:, None])
