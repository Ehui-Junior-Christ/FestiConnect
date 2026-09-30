"""Genere la voix off d'une version du film a partir de la timeline (texte "vo" et "voAt" de chaque plan).

    python video/voice/make_voice.py --timeline video/timeline.json --models <dossier_modeles> --out video/audio/voix_80s

Pour chaque ligne : texte phonetise (prononciation.json), synthese, ajustement de vitesse pour tenir dans la
fenetre (jusqu'a la ligne suivante), retrait des silences, traitement (passe-haut 80 Hz, chaleur, presence,
de-esser, compression douce, saturation legere), normalisation -18 LUFS, 48 kHz.
Sorties : lignes/<plan>.wav, voix.wav (piste placee aux timecodes), manifest.json (debut/fin reels de chaque ligne).
"""
import argparse
import json
import re
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

import dsp
from engines import VOICES, make_tts

SR = 48000
HERE = Path(__file__).parent


def phonetize(text, rules, overrides=None):
    text = (overrides or {}).get(text, text)
    for pat, rep in rules:
        text = re.sub(pat, rep, text)
    text = re.sub(r"\s+", " ", text).strip()
    return re.sub(r"^[,;.\s]+", "", text)


def trim(x, sr, thr_db=-45, pad=0.03):
    env = np.convolve(np.abs(x), np.ones(int(0.01 * sr)) / (0.01 * sr), mode="same")
    idx = np.where(env > 10 ** (thr_db / 20))[0]
    if not len(idx):
        return x
    a, b = max(0, idx[0] - int(pad * sr)), min(len(x), idx[-1] + int(pad * sr))
    y = x[a:b].copy()
    f = int(0.008 * sr)
    y[:f] *= np.linspace(0, 1, f)
    y[-f:] *= np.linspace(1, 0, f)
    return y


def process(x, sr_in):
    x = resample_poly(x, SR, sr_in).astype(np.float64)
    x = dsp.highpass(x, SR, 80, 2)
    x = dsp.eq(x, SR, "lowshelf", 190, 2.0)        # chaleur
    x = dsp.eq(x, SR, "peak", 380, -1.5, 1.0)      # moins de "carton"
    x = dsp.eq(x, SR, "peak", 3200, 2.0, 0.9)      # presence / intelligibilite
    x = dsp.eq(x, SR, "highshelf", 9000, 1.5)      # air
    x = x / (np.abs(x).max() + 1e-9) * 0.7
    x = dsp.deess(x, SR, 6200, threshold_db=-26, max_cut_db=6)
    x = dsp.compress(x, SR, threshold_db=-16, ratio=2.5, attack=0.008, release=0.12, knee_db=6)
    x = dsp.saturate(x * 0.9, 1.3)
    return dsp.normalize_lufs(x, SR, -18.0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--timeline", required=True)
    ap.add_argument("--models", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--voice", default="kokoro-ff_siwis")
    ap.add_argument("--max-speed", type=float, default=1.22)
    ap.add_argument("--tail", type=float, default=1.2, help="marge laissee apres la derniere ligne (s)")
    a = ap.parse_args()

    tl = json.loads(Path(a.timeline).read_text())
    pron = json.loads((HERE / "prononciation.json").read_text())
    rules, overrides = pron["rules"], pron.get("overrides", {})
    plans = sorted((p for s in tl["sequences"] for p in s["plans"] if p.get("vo")), key=lambda p: p["start"])
    out = Path(a.out)
    (out / "lignes").mkdir(parents=True, exist_ok=True)
    say = make_tts(a.voice, Path(a.models))
    dur = tl["duration"]
    track = np.zeros(int(dur * SR) + SR)
    manifest = []
    for i, p in enumerate(plans):
        t0 = p["start"] + p.get("voAt", 0)
        nxt = plans[i + 1]["start"] + plans[i + 1].get("voAt", 0) if i + 1 < len(plans) else dur - a.tail + 0.12
        window = nxt - t0 - 0.12
        text = phonetize(p["vo"], rules, overrides)
        speed = 1.0
        x, sr = say(text, speed)
        x = trim(x, sr)
        d = len(x) / sr
        if d > window:
            speed = min(a.max_speed, d / window * 1.02)
            x, sr = say(text, speed)
            x = trim(x, sr)
        elif d < window * 0.72:
            speed = 0.94  # de la place : debit un peu plus pose
            x2, _ = say(text, speed)
            x2 = trim(x2, sr)
            if len(x2) / sr <= window:
                x = x2
            else:
                speed = 1.0
        y = process(x, sr)
        d = len(y) / SR
        over = d - window
        sf.write(out / "lignes" / f"{p['id']}.wav", y, SR, subtype="PCM_24")
        k = int(t0 * SR)
        track[k:k + len(y)] += y[: len(track) - k]
        manifest.append({"id": p["id"], "start": round(t0, 3), "end": round(t0 + d, 3), "window": round(window, 2),
                         "speed": round(speed, 3), "text": p["vo"], "tts_text": text, "overflow_s": round(max(0, over), 2)})
        flag = f"  DEBORDE de {over:.2f} s" if over > 0 else ""
        print(f"{p['id']:3s} {t0:6.2f}s  {d:4.2f}/{window:4.2f}s  x{speed:.2f}  {text}{flag}")
    track = track[: int(dur * SR)]
    track = dsp.limiter(track, SR, ceiling_db=-3.0)
    sf.write(out / "voix.wav", track.astype(np.float32), SR, subtype="PCM_24")
    (out / "manifest.json").write_text(json.dumps({"voice": a.voice, "licence": VOICES[a.voice][4], "lines": manifest},
                                                  ensure_ascii=False, indent=2))
    print(f"-> {out / 'voix.wav'} ({dur} s)")


if __name__ == "__main__":
    main()
