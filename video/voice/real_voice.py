"""Monte, nettoie et place une vraie voix off (prise continue) sur la timeline.

    python video/voice/real_voice.py --edit video/voice/vo_edit_80s.json --out video/audio/voix_80s

Le fichier d'edition decrit, pour chaque plan, les morceaux de la prise a utiliser (secondes dans la source),
les passages a retirer (hesitations, doublons) et l'eventuel micro time-stretch (<= 5 %). Les pauses internes
trop longues sont raccourcies automatiquement. La prise entiere est nettoyee une fois (traitement homogene) :
passe-haut 80 Hz, reduction de bruit spectrale douce, EQ legere, de-esser, compression douce. La voix garde son
debit, son accent et ses respirations d'attaque.
Sorties : voix.wav (piste placee), lignes/<plan>.wav, source_nettoyee.wav, manifest.json.
"""
import argparse
import json
import subprocess
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import istft, resample_poly, stft
from scipy.ndimage import uniform_filter

import dsp

SR = 48000
ROOT = Path(__file__).resolve().parent.parent


def denoise(x, sr, max_db=10.0, alpha=1.6):
    """Reduction de bruit par soustraction spectrale douce (profil estime sur les passages les plus calmes)."""
    f, t, Z = stft(x, sr, nperseg=1024, noverlap=768)
    mag = np.abs(Z)
    frame_e = mag.mean(axis=0)
    quiet = frame_e <= np.percentile(frame_e, 12)
    noise = np.median(mag[:, quiet], axis=1, keepdims=True)
    g = 1 - alpha * noise / (mag + 1e-12)
    g = np.clip(g, 10 ** (-max_db / 20), 1)
    g = uniform_filter(g, size=(3, 5))  # lissage frequence x temps : pas de "musical noise"
    _, y = istft(Z * g, sr, nperseg=1024, noverlap=768)
    return y[: len(x)]


def clean(x, sr):
    x = dsp.highpass(x, sr, 80, 3)
    x = denoise(x, sr)
    x = dsp.eq(x, sr, "peak", 300, -2.0, 0.9)       # moins de "boite" (micro de telephone)
    x = dsp.eq(x, sr, "peak", 3500, 3.0, 0.9)       # presence
    x = dsp.eq(x, sr, "highshelf", 8000, 1.5)       # un peu d'air
    x = dsp.normalize_lufs(x, sr, -20.0)
    x = dsp.deess(x, sr, 5800, threshold_db=-32, max_cut_db=6)
    x = dsp.compress(x, sr, threshold_db=-22, ratio=2.2, attack=0.01, release=0.14, knee_db=8)
    return x


def level_db(x, sr, hop=0.01):
    h = int(hop * sr)
    return np.array([20 * np.log10(np.sqrt(np.mean(x[i:i + h] ** 2)) + 1e-9) for i in range(0, len(x) - h, h)])


def join(parts, xfade):
    """Concatene avec fondus croises (xfade en echantillons)."""
    out = parts[0]
    for p in parts[1:]:
        n = min(xfade, len(out), len(p))
        if n:
            w = np.linspace(0, 1, n)
            out = np.concatenate([out[:-n], out[-n:] * (1 - w) + p[:n] * w, p[n:]])
        else:
            out = np.concatenate([out, p])
    return out


def shorten_pauses(y, sr, floor_db, max_pause, pause_to):
    db = level_db(y, sr)
    sil = db < floor_db + 22
    runs, s = [], None
    for i, v in enumerate(sil):
        if v and s is None:
            s = i
        if (not v or i == len(sil) - 1) and s is not None:
            if (i - s) / 100 > max_pause and s > 5 and i < len(sil) - 5:
                runs.append((s, i))
            s = None
    removed = []
    for s, e in reversed(runs):
        keep = int(pause_to * 100)
        a, b = s + keep // 2, e - keep // 2
        y = join([y[: a * sr // 100], y[b * sr // 100:]], int(0.02 * sr))
        removed.append(round((b - a) / 100, 2))
    return y, removed


def stretch(y, sr, factor):
    """Micro time-stretch sans changer la hauteur (ffmpeg atempo). factor > 1 = plus rapide."""
    if abs(factor - 1) < 1e-3:
        return y
    ff = ROOT / "node_modules" / "ffmpeg-static" / "ffmpeg"
    with tempfile.TemporaryDirectory() as d:
        a, b = Path(d) / "a.wav", Path(d) / "b.wav"
        sf.write(a, y, sr, subtype="FLOAT")
        subprocess.run([str(ff), "-v", "error", "-y", "-i", str(a), "-af", f"atempo={factor}", str(b)], check=True)
        z, _ = sf.read(b, dtype="float64")
    return z


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--edit", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    ed = json.loads(Path(a.edit).read_text())
    src = Path(ed["source"]) if Path(ed["source"]).is_absolute() else ROOT / ed["source"]
    x, sr = sf.read(src, dtype="float64")
    if x.ndim > 1:
        x = x.mean(axis=1)
    if sr != SR:
        x = resample_poly(x, SR, sr)
    tl = json.loads((ROOT / ed["timeline"]).read_text())
    plans = {p["id"]: p for s in tl["sequences"] for p in s["plans"]}
    out = Path(a.out)
    (out / "lignes").mkdir(parents=True, exist_ok=True)

    raw_floor = np.percentile(level_db(x, SR), 5)
    y_all = clean(x, SR)
    sf.write(out / "source_nettoyee.wav", y_all.astype(np.float32), SR, subtype="PCM_24")
    floor = np.percentile(level_db(y_all, SR), 5)
    pre, post, fade = ed.get("pre", 0.06), ed.get("post", 0.08), int(ed.get("fade", 0.04) * SR)
    xf = int(0.02 * SR)

    lines = sorted(ed["lines"], key=lambda l: plans[l["plan"]]["start"] + plans[l["plan"]].get("voAt", 0))
    dur = tl["duration"]
    track = np.zeros(int(dur * SR) + SR)
    manifest = []
    built = []
    for l in lines:
        p = plans[l["plan"]]
        pieces = []
        for k, (s0, s1) in enumerate(l["pieces"]):
            s0 -= pre if k == 0 else 0.02
            s1 += post if k == len(l["pieces"]) - 1 else 0.02
            segs, cur = [], s0
            for r0, r1 in sorted(l.get("remove", [])):
                if s0 < r0 < s1:
                    segs.append((cur, r0))
                    cur = r1
            segs.append((cur, s1))
            piece = join([y_all[int(u * SR):int(v * SR)] for u, v in segs], xf)
            if k:
                pieces.append(np.zeros(int(l.get("gap", 0.3) * SR)))
            pieces.append(piece)
        y = join(pieces, xf) if len(pieces) > 1 else pieces[0]
        y, cut = shorten_pauses(y, SR, floor, ed.get("max_pause", 0.55), ed.get("pause_to", 0.45))
        y = stretch(y, SR, l.get("stretch", 1.0))
        y[:fade] *= np.linspace(0, 1, fade)
        y[-fade:] *= np.linspace(1, 0, fade)
        built.append((l, p, y, cut))
    # nivellement leger ligne a ligne vers la mediane (+/- 2 dB max) : la dynamique naturelle est conservee
    louds = [dsp.lufs(b[2], SR) for b in built]
    ref = float(np.median(louds))
    for i, ((l, p, y, cut), lo) in enumerate(zip(built, louds)):
        gain = float(np.clip(ref - lo, -2.0, 2.0))
        y = y * 10 ** (gain / 20)
        t0 = p["start"] + p.get("voAt", 0)
        d = len(y) / SR
        nxt = None
        if i + 1 < len(lines):
            q = plans[lines[i + 1]["plan"]]
            nxt = q["start"] + q.get("voAt", 0)
        limit = nxt if nxt is not None else dur - 0.3
        over = t0 + d - limit
        sf.write(out / "lignes" / f"{l['plan']}.wav", y.astype(np.float32), SR, subtype="PCM_24")
        k0 = int(t0 * SR)
        track[k0:k0 + len(y)] += y[: len(track) - k0]
        manifest.append({"plan": l["plan"], "start": round(t0, 3), "end": round(t0 + d, 3), "pieces": l["pieces"],
                         "remove": l.get("remove", []), "pauses_raccourcies_s": cut, "stretch": l.get("stretch", 1.0),
                         "gain_db": round(float(gain), 2), "text": p.get("vo", ""), "chevauchement_s": round(max(0, over), 2)})
        flag = f"  CHEVAUCHE la ligne suivante de {over:.2f} s" if over > 0 else ""
        print(f"{l['plan']:3s} {t0:6.2f} -> {t0 + d:6.2f} s ({d:4.2f} s, marge {limit - t0 - d:+.2f}) "
              f"pauses -{sum(cut):.2f} s  gain {gain:+.1f} dB{flag}")
    track = dsp.limiter(track[: int(dur * SR)], SR, ceiling_db=-3.0)
    sf.write(out / "voix.wav", track.astype(np.float32), SR, subtype="PCM_24")
    (out / "manifest.json").write_text(json.dumps({"source": str(src), "plancher_bruit_source_db": round(float(raw_floor), 1),
                                                   "lines": manifest}, ensure_ascii=False, indent=2))
    print(f"-> {out / 'voix.wav'}")


if __name__ == "__main__":
    main()
