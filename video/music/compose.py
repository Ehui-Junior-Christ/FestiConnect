"""Musique originale FestiConnect, entierement synthetisee (aucun echantillon externe : libre de droits).

Afro-house 120 BPM en 4/4, la mineur : kick, clap, shaker, charleston, clave 3-2, percussions type djembe,
log drum, basse, nappes et accords (Am9 - Fmaj7 - Cmaj7 - G6), riff boise type balafon, arpege, risers,
impacts et son de marque. L'arrangement est pilote par la timeline (sequences, cues) : les deux versions
(80 s et 30 s) se construisent a partir du meme code.

    python video/music/compose.py --timeline video/timeline.json --out video/audio/musique_80s
Sorties : musique.wav (musique seule), sfx.wav (sound design synchronise sur l'image), cues.json.
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import fftconvolve

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "voice"))
import dsp  # noqa: E402

SR = 48000
RNG = np.random.default_rng(2026)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def t_(d):
    return np.arange(int(d * SR)) / SR


def adsr(n, a=0.005, d=0.1, s=0.6, r=0.1, hold=None):
    """Enveloppe ADSR sur n echantillons (hold = duree tenue avant relachement)."""
    a_, d_, r_ = int(a * SR), int(d * SR), int(r * SR)
    hold_ = n - a_ - d_ - r_ if hold is None else int(hold * SR)
    hold_ = max(0, hold_)
    env = np.concatenate([np.linspace(0, 1, max(1, a_)), np.linspace(1, s, max(1, d_)), np.full(hold_, s),
                          np.linspace(s, 0, max(1, r_))])
    return np.pad(env, (0, max(0, n - len(env))))[:n]


# ---------------------------------------------------------------- instruments
def kick(level=1.0):
    t = t_(0.45)
    f = 48 + 90 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 10.5)
    click = RNG.standard_normal(len(t)) * np.exp(-t * 400) * 0.25
    return dsp.saturate((body + dsp.lowpass(click, SR, 5000)) * 1.1, 1.4) * level


def clap(level=1.0):
    t = t_(0.35)
    n = RNG.standard_normal(len(t))
    env = sum(np.exp(-np.clip(t - d, 0, None) * 60) * (t >= d) for d in (0, 0.011, 0.022)) * 0.5
    env += np.exp(-t * 18) * 0.5
    x = dsp.bandpass(n, SR, 900, 5000) * env
    return x * level * 0.9


def shaker(level=1.0, dur=0.07):
    t = t_(dur)
    n = RNG.standard_normal(len(t))
    env = np.minimum(1, t / 0.01) * np.exp(-t * 55)
    return dsp.highpass(n, SR, 6000, 2) * env * level * 0.35


def hat(level=1.0, open_=False):
    t = t_(0.25 if open_ else 0.06)
    n = RNG.standard_normal(len(t))
    env = np.exp(-t * (14 if open_ else 70))
    return dsp.highpass(n, SR, 7500, 2) * env * level * 0.3


def clave(level=1.0):
    t = t_(0.08)
    x = (np.sin(2 * np.pi * 2350 * t) + 0.4 * np.sin(2 * np.pi * 3700 * t)) * np.exp(-t * 70)
    return x * level * 0.28


def djembe(tone="low", level=1.0):
    t = t_(0.3)
    if tone == "low":
        f = 95 + 40 * np.exp(-t * 30)
        x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 11)
        x += dsp.lowpass(RNG.standard_normal(len(t)), SR, 900) * np.exp(-t * 60) * 0.3
    else:  # claque (slap)
        f = 330 + 120 * np.exp(-t * 60)
        x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 26) * 0.6
        x += dsp.bandpass(RNG.standard_normal(len(t)), SR, 1200, 6000) * np.exp(-t * 45) * 0.55
    return x * level * 0.5


def logdrum(note, level=1.0, dur=0.45):
    t = t_(dur)
    f = midi(note) * (1 + 0.35 * np.exp(-t * 35))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR)
    x += 0.35 * np.sin(4 * np.pi * np.cumsum(f) / SR)
    x = dsp.saturate(x * np.exp(-t * 6.5) * 1.3, 1.6)
    return dsp.lowpass(x, SR, 1400) * level * 0.5


def bass(note, dur, level=1.0):
    t = t_(dur)
    f = midi(note)
    x = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t) + 0.12 * np.sign(np.sin(2 * np.pi * f * t))
    x = dsp.lowpass(x, SR, 420, 2) * adsr(len(t), 0.004, 0.08, 0.7, 0.05)
    return dsp.saturate(x * 0.9, 1.3) * level * 0.4


def pad_chord(notes, dur, level=1.0, cutoff=1800):
    """Nappe : scies desaccordees, stereo, filtree, attaque lente."""
    t = t_(dur)
    out = np.zeros((len(t), 2))
    for n in notes:
        f = midi(n)
        for det, pan in ((-0.09, 0), (0.0, None), (0.09, 1)):
            ff = f * 2 ** (det / 12)
            ph = RNG.uniform(0, 1)
            saw = 2 * ((ff * t + ph) % 1) - 1
            if pan is None:
                out += saw[:, None] * 0.5
            else:
                out[:, pan] += saw
    out = dsp.lowpass(out, SR, cutoff, 2)
    env = adsr(len(t), 0.35, 0.3, 0.85, 0.5)
    return out * env[:, None] * level * 0.045 / max(1, len(notes) / 4)


def keys_chord(notes, dur, level=1.0):
    """Accords courts type piano electrique (stabs)."""
    t = t_(dur)
    x = np.zeros(len(t))
    for n in notes:
        f = midi(n)
        mod = np.sin(2 * np.pi * f * 2 * t) * 1.2 * np.exp(-t * 8)
        x += np.sin(2 * np.pi * f * t + mod)
    return x * np.exp(-t * 6) * level * 0.09


def marimba(note, level=1.0):
    """Lame boisee (type balafon) : fondamentale + partiel 4x, attaque seche."""
    t = t_(0.5)
    f = midi(note)
    x = np.sin(2 * np.pi * f * t) * np.exp(-t * 9) + 0.35 * np.sin(2 * np.pi * f * 3.93 * t) * np.exp(-t * 30)
    x += dsp.bandpass(RNG.standard_normal(len(t)), SR, 1500, 5000) * np.exp(-t * 120) * 0.15
    return x * level * 0.32


def pluck(note, level=1.0):
    t = t_(0.22)
    f = midi(note)
    saw = 2 * ((f * t) % 1) - 1
    x = dsp.lowpass(saw, SR, 2600, 2) * np.exp(-t * 18)
    return x * level * 0.12


def bell(note, level=1.0, dur=1.6):
    """Cloche FM pour le son de marque."""
    t = t_(dur)
    f = midi(note)
    mod = 2.2 * np.exp(-t * 3) * np.sin(2 * np.pi * f * 3.5 * t)
    return np.sin(2 * np.pi * f * t + mod) * np.exp(-t * 2.8) * level * 0.22


def riser(dur, level=1.0):
    t = t_(dur)
    n = RNG.standard_normal(len(t))
    out = np.zeros(len(t))
    seg = int(0.05 * SR)
    for i in range(0, len(t), seg):
        c = 400 + 7000 * (i / len(t)) ** 2
        out[i:i + seg] = dsp.bandpass(n[i:i + seg + 2000], SR, c, min(c * 1.8, 20000))[:len(out[i:i + seg])]
    env = (t / dur) ** 2
    return out * env * level * 0.25


def reverse_cymbal(dur, level=1.0):
    t = t_(dur)
    x = dsp.highpass(RNG.standard_normal(len(t)), SR, 4000) * np.exp(-(dur - t) * 4)
    return x * level * 0.3


def impact(level=1.0):
    t = t_(2.2)
    f = 40 + 60 * np.exp(-t * 12)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2)
    crash = dsp.highpass(RNG.standard_normal(len(t)), SR, 3000) * np.exp(-t * 2.5) * 0.35
    return dsp.saturate(boom * 1.2, 1.5) * level * 0.8 + crash * level * 0.5


def blip(note, level=1.0):
    t = t_(0.12)
    return np.sin(2 * np.pi * midi(note) * t) * np.exp(-t * 35) * level * 0.2


def noise_burst(dur, lo, hi, decay, level=1.0):
    t = t_(dur)
    return dsp.bandpass(RNG.standard_normal(len(t)), SR, lo, hi) * np.exp(-t * decay) * level


# ---------------------------------------------------------------- utilitaires de placement
class Bus:
    def __init__(self, dur):
        self.x = np.zeros((int(dur * SR) + 3 * SR, 2))

    def add(self, sig, at, pan=0.0, gain=1.0):
        if at < 0:
            return
        i = int(round(at * SR))
        if sig.ndim == 1:
            l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
            sig = np.stack([sig * l * 1.414, sig * r * 1.414], axis=1)
        j = min(len(self.x), i + len(sig))
        if i < len(self.x):
            self.x[i:j] += sig[: j - i] * gain


def reverb_ir(dur=1.8, predelay=0.02):
    t = t_(dur)
    ir = np.zeros((len(t), 2))
    for c in range(2):
        n = RNG.standard_normal(len(t)) * np.exp(-t * 3.6)
        ir[:, c] = dsp.lowpass(n, SR, 6000)
    ir[: int(predelay * SR)] = 0
    return ir / np.sqrt((ir ** 2).sum(axis=0))


def apply_reverb(x, ir, wet=0.25):
    y = np.stack([fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], axis=1)
    return x + y * wet


# ---------------------------------------------------------------- arrangement
PROG = [[57, 60, 64, 67, 71], [53, 57, 60, 64], [48, 55, 59, 64], [55, 59, 62, 64]]  # Am9 Fmaj7 Cmaj7 G6
ROOTS = [33, 29, 36, 31]  # la, fa, do, sol (octave basse)
SECTION = {"A": "intro", "B": "build", "C": "drop", "D": "main", "E": "riff", "F": "drive", "G": "break", "H": "final"}


def compose(tl):
    bpm = tl["music"]["bpm"]
    off = tl["music"].get("offset", 0)
    beat = 60 / bpm
    dur = tl["duration"]
    seqs = {s["id"]: s for s in tl["sequences"]}
    plans = {p["id"]: p for s in tl["sequences"] for p in s["plans"]}

    def cue(pid, name, default=None):
        p = plans.get(pid)
        if not p:
            return None
        v = (p.get("cues") or {}).get(name, default)
        return None if v is None else p["start"] + v

    def section_at(t):
        for s in tl["sequences"]:
            a = min(p["start"] for p in s["plans"])
            b = max(p["end"] for p in s["plans"])
            if a <= t < b:
                return SECTION.get(s["id"], "main"), s["id"], a, b
        return "final", "H", dur, dur

    drums, bassb, harm, perc, fx, sfx = (Bus(dur) for _ in range(6))
    kick_times = []

    # Impacts et reperes derives des cues
    impacts = []
    if "C1" in plans:
        impacts.append(plans["C1"]["start"])
    for pid, name in (("D4", "valid"), ("G1", "stamp")):
        c = cue(pid, name)
        if c is not None:
            impacts.append(c)
    if "H2" in plans:
        impacts.append(plans["H2"]["start"])
    hits = [cue("B1", f"w{i}") for i in range(1, 5)] + [cue("H1", f"w{i}") for i in range(1, 4)]
    hits = [h for h in hits if h is not None]
    brand = []
    if "C1" in plans:
        brand.append(plans["C1"]["start"] + 0.62)
    if "H2" in plans:
        brand.append(plans["H2"]["start"] + (0.62 if "H1" in plans else 0.4))
    g = seqs.get("G")
    brk = (min(p["start"] for p in g["plans"]), max(p["end"] for p in g["plans"])) if g else None
    dot = cue("A1", "dot", 0.5) or 0.5
    end_music = dur - 0.6

    n16 = int((dur - off) / (beat / 4)) + 1
    for k in range(n16):
        t = off + k * beat / 4
        if t >= end_music:
            break
        step = k % 16
        bar = k // 16
        sec, sid, s0, s1 = section_at(t)
        in_break = brk and brk[0] <= t < brk[1]
        pre_drop = any(0 <= imp - t < beat * 0.5 for imp in impacts[:1] + impacts[-1:])  # coupure avant les drops
        chord = bar % 4
        swing = (beat / 4) * 0.12 if step % 2 else 0.0
        ts = t + swing

        # --- Kick
        if step % 4 == 0 and t >= dot and not in_break and not pre_drop:
            lvl = 0.55 if sec == "intro" else 1.0
            drums.add(kick(lvl), t)
            kick_times.append(t)
        if in_break and step % 8 == 0 and t < brk[1] - beat * 2:
            drums.add(kick(0.35), t)  # pulsation sourde du break
            kick_times.append(t)
        full = sec in ("build", "drop", "main", "riff", "drive", "final") and not in_break
        # --- Clap sur 2 et 4
        if full and step in (4, 12) and not pre_drop:
            drums.add(clap(0.8 if sec != "main" else 0.6), t, pan=0.05)
        # --- Shaker (16e avec accents), charleston ouverte sur les contretemps
        if (full or (sec == "intro" and t >= s0 + 2 * beat * 4)) and not pre_drop:
            acc = 1.0 if step % 4 == 2 else 0.55
            drums.add(shaker(acc * (0.6 if sec == "intro" else 1.0)), ts, pan=0.35)
        if full and step % 4 == 2 and sec != "main" and not pre_drop:
            drums.add(hat(0.7, open_=True), t, pan=-0.25)
        if full and sec == "main" and step % 4 == 2:
            drums.add(hat(0.5), t, pan=-0.25)
        # --- Clave 3-2 (son) sur 2 mesures
        clave_steps = (0, 6, 12) if bar % 2 == 0 else (4, 8)
        if full and step in clave_steps and sec in ("build", "drop", "riff", "final", "drive"):
            perc.add(clave(0.8), t, pan=-0.45)
        # --- Djembe (motif syncopé)
        if full and sec in ("drop", "riff", "final", "build") and not pre_drop:
            if step in (3, 10):
                perc.add(djembe("low", 0.8), ts, pan=0.2)
            if step in (6, 7, 14):
                perc.add(djembe("slap", 0.6 if step != 7 else 0.4), ts, pan=0.3)
        # --- Log drum et basse
        root = ROOTS[chord]
        if full and not pre_drop:
            if step in (0, 3, 6, 10, 14):
                n = root + (12 if step == 6 else 0) + (7 if step == 14 else 0)
                bassb.add(bass(n, beat * 0.55, 0.9 if sec != "main" else 0.75), t)
            if sec in ("drop", "riff", "final") and step in (11, 15):
                bassb.add(logdrum(root + 12 + (3 if step == 15 else 0), 0.7), ts)
        if sec == "intro" and step == 0 and t >= 2 * beat * 4:
            bassb.add(bass(root, beat * 3.5, 0.5), t)
        # --- Harmonie : nappe par mesure, stabs
        if step == 0:
            lvl = {"intro": 0.7, "break": 1.0, "main": 0.8}.get(sec, 1.0)
            cut = 900 + (1400 * min(1, (t - s0) / max(1e-3, s1 - s0)) if sec == "intro" else 900)
            harm.add(pad_chord(PROG[chord], beat * 4 + 0.4, lvl, cutoff=cut), t)
        if full and sec in ("drop", "final", "drive") and step in (2, 7, 10):
            harm.add(keys_chord([n + 12 for n in PROG[chord][:3]], beat * 0.5, 0.8), ts, pan=-0.1)
        # --- Riff boise (boutique) et arpege (organisateur)
        if sec == "riff":
            riff = {0: 69, 3: 72, 6: 76, 8: 74, 10: 72, 13: 69}
            if step in riff:
                perc.add(marimba(riff[step] + (0 if chord in (0, 2) else -2)), ts, pan=-0.2)
        if sec == "drive" and not in_break:
            arp = PROG[chord]
            perc.add(pluck(arp[step % len(arp)] + 12, 0.8), t, pan=0.25 if step % 2 else -0.25)

    # --- Frappes sur les mots (B1, H1)
    for h in hits:
        perc.add(djembe("low", 1.3), h, pan=0)
        perc.add(logdrum(45, 0.9), h)
        fx.add(noise_burst(0.25, 2000, 9000, 20, 0.12), h - 0.2, pan=0.4)  # swish de panneau
    # --- Risers / cymbales inversees avant les drops et les iris
    for imp in impacts:
        fx.add(reverse_cymbal(1.0, 0.8), imp - 1.0)
    if "B2" in plans:
        fx.add(riser(2.0, 1.0), plans["C1"]["start"] - 2.0)
    if brk:
        fx.add(riser(1.0, 0.9), brk[1] - 1.0)
        # roulement de djembe qui relance
        for i in range(8):
            perc.add(djembe("slap", 0.3 + 0.08 * i), brk[1] - 1.0 + i * beat / 4)
    if "H1" in plans:
        fx.add(riser(1.0, 1.0), plans["H2"]["start"] - 1.0)
    # --- Impacts
    for imp in impacts:
        fx.add(impact(1.0 if imp in (impacts[0], impacts[-1]) else 0.75), imp)
    # --- Son de marque (A - E - A, cloche + lame boisee)
    for b in brand:
        for i, n in enumerate((69, 76, 81)):
            fx.add(bell(n, 0.9), b + i * 0.09, pan=(i - 1) * 0.3)
            fx.add(marimba(n, 0.6), b + i * 0.09)
    # --- Accord final tenu
    if "H2" in plans:
        harm.add(pad_chord(PROG[0], 4.5, 1.1, cutoff=1500), plans["H2"]["start"] + 1.0)
        bassb.add(bass(33, 3.0, 0.7), plans["H2"]["start"] + 1.0)

    # ------------------------------------------------ sound design synchronise (piste separee)
    def S(pid, name):
        return cue(pid, name)
    tick = lambda lv=1.0: noise_burst(0.03, 2000, 8000, 250, 0.2 * lv)  # noqa: E731
    events = []
    if "A1" in plans:
        events.append(("pop", S("A1", "dot")))
    for i in range(1, 6):
        c = cue("A2", "cities")
        if c is not None:
            step = plans["A2"]["cues"].get("cityStep", beat)
            events.append(("tic", c + (i - 1) * step))
    for n in range(3):
        c = cue("C2", "promise")
        if c is not None:
            events.append(("blip%d" % n, c + n * 0.18))
    for pid, names in (("D1", ["tap"]), ("D2", ["tap"]), ("D3", ["qty", "select", "pay"]), ("F1", ["submit"]), ("F3", ["tap"])):
        for nm in names:
            events.append(("tap", S(pid, nm)))
    events += [("chime", S("D3", "success")), ("notif", S("D3", "toast")), ("scan", S("D4", "scan")),
               ("stamp", S("D4", "valid")), ("stamp", S("G1", "stamp")), ("chime2", S("F3", "ok"))]
    for i in range(1, 4):
        events.append(("plop", S("E1", f"add{i}")))
        events.append(("ding", S("F2", f"n{i}")))
        events.append(("tic", S("G1", f"c{i}")))
    for i in range(1, 6):
        events.append(("key", S("F1", f"f{i}")))
    if "H2" in plans:
        events.append(("endpop", plans["H2"]["end"] - 0.12))
    for kind, at in events:
        if at is None:
            continue
        if kind == "pop":
            sfx.add(djembe("low", 0.8), at)
        elif kind == "tic":
            sfx.add(tick(1.2), at, pan=0.2)
        elif kind.startswith("blip"):
            sfx.add(blip(81 + 2 * int(kind[-1]), 1.2), at)
        elif kind == "tap":
            sfx.add(tick(1.0) + np.pad(blip(88, 0.6), (0, 0))[:len(tick())], at)
        elif kind == "key":
            for j in range(4):
                sfx.add(tick(0.7), at + j * 0.09, pan=0.1)
        elif kind == "chime":
            sfx.add(bell(76, 0.8, 1.0), at)
            sfx.add(bell(81, 0.8, 1.2), at + 0.11)
        elif kind == "chime2":
            sfx.add(bell(79, 0.7, 1.0), at)
            sfx.add(bell(84, 0.7, 1.2), at + 0.11)
        elif kind == "notif":
            sfx.add(blip(88, 1.4), at)
            sfx.add(blip(93, 1.2), at + 0.08)
        elif kind == "ding":
            sfx.add(bell(84, 0.45, 0.6), at, pan=0.3)
        elif kind == "plop":
            sfx.add(marimba(81, 1.0), at + 0.48)
        elif kind == "scan":
            tt = t_(0.18)
            sfx.add(np.sin(2 * np.pi * 1950 * tt) * np.minimum(1, tt / 0.005) * np.exp(-np.maximum(0, tt - 0.14) * 80) * 0.12, at)
        elif kind == "stamp":
            sfx.add(noise_burst(0.2, 100, 1500, 25, 0.5) + np.pad(djembe("low", 1.4), (0, 0))[:int(0.2 * SR)], at)
        elif kind == "endpop":
            tt = t_(0.12)
            sfx.add(np.sin(2 * np.pi * (300 + 900 * tt / 0.12) * tt) * (tt / 0.12) * 0.25, at - 0.12)

    # ------------------------------------------------ mixage interne de la musique
    ir = reverb_ir()
    # pompage leger des nappes et de la basse par le kick (feeling afro-house)
    pump = np.ones(len(drums.x))
    for kt in kick_times:
        i = int(kt * SR)
        n = int(0.22 * SR)
        seg = 1 - 0.35 * np.exp(-np.arange(n) / SR * 14)
        pump[i:i + n] = np.minimum(pump[i:i + n], seg[: len(pump[i:i + n])])
    harm_x = apply_reverb(harm.x * pump[:, None], ir, 0.35)
    bass_x = bassb.x * (0.5 + 0.5 * pump)[:, None]
    perc_x = apply_reverb(perc.x, ir, 0.18)
    drums_x = apply_reverb(drums.x, ir, 0.08)
    fx_x = apply_reverb(fx.x, ir, 0.3)
    bass_x = dsp.highpass(bass_x, SR, 30, 2)
    music = drums_x * 0.75 + bass_x * 0.6 + harm_x * 2.6 + perc_x * 1.8 + fx_x * 0.8
    music = dsp.highpass(music, SR, 28, 2)
    music = dsp.eq(music, SR, "lowshelf", 90, -3.0)
    music = dsp.eq(music, SR, "peak", 3000, -1.5, 0.8)  # evite le cote criard
    music = dsp.compress(music / (np.abs(music).max() + 1e-9) * 0.8, SR, threshold_db=-12, ratio=2.0, attack=0.01, release=0.15)
    n = int(dur * SR)
    music, sfx_x = music[:n], apply_reverb(sfx.x, ir, 0.2)[:n]
    # fondu de fin
    f = int(1.2 * SR)
    music[-f:] *= np.linspace(1, 0, f)[:, None] ** 2
    return music, sfx_x, {"impacts": impacts, "brand": brand, "hits": hits, "break": brk}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--timeline", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    tl = json.loads(Path(a.timeline).read_text())
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    music, sfx, cues = compose(tl)
    music = dsp.limiter(dsp.normalize_lufs(music, SR, -16.0), SR, ceiling_db=-1.5)
    sfx = sfx / (np.abs(sfx).max() + 1e-9) * 0.5
    sf.write(out / "musique.wav", music.astype(np.float32), SR, subtype="PCM_24")
    sf.write(out / "sfx.wav", sfx.astype(np.float32), SR, subtype="PCM_24")
    (out / "cues.json").write_text(json.dumps(cues, indent=2))
    print(f"musique : {dsp.lufs(music, SR):.1f} LUFS, crete vraie {dsp.true_peak_db(music, SR):.1f} dBTP -> {out}")
    print("impacts :", [round(x, 2) for x in cues["impacts"]], "son de marque :", [round(x, 2) for x in cues["brand"]])


if __name__ == "__main__":
    main()
