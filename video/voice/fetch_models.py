"""Telecharge et decompresse des voix TTS francaises depuis la release `tts-models` de sherpa-onnx.

    python video/voice/fetch_models.py <dossier_cible> [nom_modele ...]

Sans nom de modele : essaie la liste des candidats ci-dessous (les absents sont ignores).
"""
import sys
import tarfile
import urllib.request
from pathlib import Path

BASE = "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/"
CANDIDATES = [
    "vits-piper-fr_FR-siwis-medium",
    "vits-piper-fr_FR-siwis-low",
    "vits-piper-fr_FR-tom-medium",
    "vits-piper-fr_FR-upmc-medium",
    "vits-piper-fr_FR-gilles-low",
    "vits-piper-fr_FR-mls-medium",
    "vits-piper-fr_FR-mls_1840-low",
    "kokoro-multi-lang-v1_1",
    "kokoro-multi-lang-v1_0",
]


def fetch(name: str, dest: Path) -> bool:
    if (dest / name).is_dir():
        print(f"{name}: deja present")
        return True
    arc = dest / f"{name}.tar.bz2"
    try:
        with urllib.request.urlopen(BASE + arc.name, timeout=120) as r, open(arc, "wb") as f:
            while chunk := r.read(1 << 20):
                f.write(chunk)
    except Exception as e:  # 404, 403...
        print(f"{name}: indisponible ({e})")
        arc.unlink(missing_ok=True)
        return False
    with tarfile.open(arc) as t:
        t.extractall(dest)
    arc.unlink()
    print(f"{name}: OK")
    return True


if __name__ == "__main__":
    dest = Path(sys.argv[1] if len(sys.argv) > 1 else "voice-models")
    dest.mkdir(parents=True, exist_ok=True)
    for n in sys.argv[2:] or CANDIDATES:
        fetch(n, dest)
