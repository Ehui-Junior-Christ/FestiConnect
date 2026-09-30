"""Controle d'intelligibilite : transcrit des WAV avec Whisper (sherpa-onnx) et calcule le taux d'erreur par mot.

    python video/voice/asr_check.py <dossier_whisper> <texte_attendu|@fichier.json> f1.wav [f2.wav ...]
Avec @fichier.json : liste [{ "wav": ..., "text": ... }] (utilise pour verifier toutes les lignes generees).
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

import numpy as np
import sherpa_onnx
import soundfile as sf
from scipy.signal import resample_poly


def norm(t):
    t = unicodedata.normalize("NFD", t.lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    t = re.sub(r"[^a-z0-9 ]+", " ", t.replace("'", " ").replace("-", " "))
    return t.split()


def wer(ref, hyp):
    r, h = norm(ref), norm(hyp)
    d = np.zeros((len(r) + 1, len(h) + 1), dtype=int)
    d[:, 0] = range(len(r) + 1)
    d[0, :] = range(len(h) + 1)
    for i in range(1, len(r) + 1):
        for j in range(1, len(h) + 1):
            d[i, j] = min(d[i - 1, j] + 1, d[i, j - 1] + 1, d[i - 1, j - 1] + (r[i - 1] != h[j - 1]))
    return d[-1, -1] / max(1, len(r))


def recognizer(wdir):
    w = Path(wdir)
    size = w.name.split("-")[-1]  # sherpa-onnx-whisper-<taille>
    return sherpa_onnx.OfflineRecognizer.from_whisper(
        encoder=str(w / f"{size}-encoder.int8.onnx"), decoder=str(w / f"{size}-decoder.int8.onnx"),
        tokens=str(w / f"{size}-tokens.txt"), language="fr", task="transcribe", num_threads=4)


def transcribe(rec, wav):
    x, sr = sf.read(wav, dtype="float32")
    if x.ndim > 1:
        x = x.mean(axis=1)
    if sr != 16000:
        x = resample_poly(x, 16000, sr).astype(np.float32)
    s = rec.create_stream()
    s.accept_waveform(16000, x)
    rec.decode_stream(s)
    return s.result.text.strip()


if __name__ == "__main__":
    rec = recognizer(sys.argv[1])
    if sys.argv[2].startswith("@"):
        items = json.loads(Path(sys.argv[2][1:]).read_text())
    else:
        items = [{"wav": w, "text": sys.argv[2]} for w in sys.argv[3:]]
    tot = []
    for it in items:
        hyp = transcribe(rec, it["wav"])
        e = wer(it["text"], hyp)
        tot.append(e)
        print(f"{Path(it['wav']).name:34s} WER {e:5.1%} | {hyp}")
    print(f"WER moyen : {np.mean(tot):.1%}")
