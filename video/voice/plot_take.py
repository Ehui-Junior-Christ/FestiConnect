"""Trace l'enveloppe (dB) d'une prise avec les coupes de cuts.json : verification visuelle du montage.

    python video/voice/plot_take.py source.wav cuts.json out.png [debut fin]
"""
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from PIL import Image, ImageDraw

src, cuts_p, out = sys.argv[1:4]
x, sr = sf.read(src, dtype="float64")
t0 = float(sys.argv[4]) if len(sys.argv) > 4 else 0
t1 = float(sys.argv[5]) if len(sys.argv) > 5 else len(x) / sr
cuts = json.loads(Path(cuts_p).read_text())["lines"]
W, H = 2400, 420
img = Image.new("RGB", (W, H), (16, 14, 13))
d = ImageDraw.Draw(img)
X = lambda t: int((t - t0) / (t1 - t0) * (W - 1))  # noqa: E731
Y = lambda v: int(H - 30 - (v + 75) / 75 * (H - 60))  # noqa: E731
for db_ in (-60, -40, -20):
    d.line([(0, Y(db_)), (W, Y(db_))], fill=(50, 45, 40))
    d.text((4, Y(db_) - 12), f"{db_} dB", fill=(120, 110, 100))
s = int(t0 * sr)
step = max(1, int((t1 - t0) * sr / W))
pts = []
for px in range(W):
    a = s + px * step
    seg = x[a:a + step]
    v = 20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-9) if len(seg) else -75
    pts.append((px, Y(max(-75, v))))
d.line(pts, fill=(255, 150, 60), width=1)
for c in cuts:
    for k, col in (("in", (46, 224, 122)), ("out", (255, 77, 94))):
        if t0 <= c[k] <= t1:
            d.line([(X(c[k]), 0), (X(c[k]), H)], fill=col, width=2)
    if t0 <= c["in"] <= t1:
        d.text((X(c["in"]) + 3, 4), c["id"], fill=(247, 242, 234))
    for a, b in c.get("cut", []):
        if t0 <= a <= t1:
            d.rectangle([X(a), H - 26, X(b), H - 18], fill=(76, 201, 240))
for sec in range(int(t0), int(t1) + 1):
    d.line([(X(sec), H - 16), (X(sec), H - 10)], fill=(200, 200, 200))
    d.text((X(sec) + 2, H - 14), str(sec), fill=(200, 200, 200))
img.save(out)
print(out)
