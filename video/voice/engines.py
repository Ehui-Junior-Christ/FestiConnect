"""Moteurs TTS locaux (sherpa-onnx) utilises pour la voix off de demonstration.

Chaque voix est decrite par : dossier du modele, type (vits/kokoro), identifiant de locuteur et licence.
Les modeles se telechargent avec fetch_models.py (release `tts-models` de k2-fsa/sherpa-onnx).
"""
from pathlib import Path

import numpy as np
import sherpa_onnx

VOICES = {
    # nom : (dossier, type, fichier onnx, sid, licence)
    "kokoro-ff_siwis": ("kokoro-multi-lang-v1_0", "kokoro", "model.onnx", 30,
                        "Modele Kokoro-82M : Apache-2.0 ; voix ff_siwis entrainee sur le corpus SIWIS (CC-BY 4.0)"),
    "piper-siwis-medium": ("vits-piper-fr_FR-siwis-medium", "vits", "fr_FR-siwis-medium.onnx", 0,
                           "Corpus SIWIS CC-BY 4.0 (affine depuis la voix Piper en_US lessac)"),
    "piper-siwis-low": ("vits-piper-fr_FR-siwis-low", "vits", "fr_FR-siwis-low.onnx", 0,
                        "Corpus SIWIS CC-BY 4.0 (affine depuis la voix Piper en_US ryan)"),
    "piper-upmc-medium-0": ("vits-piper-fr_FR-upmc-medium", "vits", "fr_FR-upmc-medium.onnx", 0,
                            "Corpus UPMC CC-BY-SA 4.0"),
    "piper-upmc-medium-1": ("vits-piper-fr_FR-upmc-medium", "vits", "fr_FR-upmc-medium.onnx", 1,
                            "Corpus UPMC CC-BY-SA 4.0"),
    "piper-gilles-low": ("vits-piper-fr_FR-gilles-low", "vits", "fr_FR-gilles-low.onnx", 0,
                         "Corpus CC0 (affine depuis la voix Piper en_US ryan)"),
    "piper-tom-medium": ("vits-piper-fr_FR-tom-medium", "vits", "fr_FR-tom-medium.onnx", 0,
                         "AGPLv3 : ecartee (copyleft, statut des sorties audio ambigu pour un usage promotionnel)"),
}


def make_tts(name: str, models_dir: Path, threads: int = 4):
    folder, kind, onnx, sid, _ = VOICES[name]
    d = Path(models_dir) / folder
    if kind == "kokoro":
        model = sherpa_onnx.OfflineTtsModelConfig(
            kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(
                model=str(d / onnx), voices=str(d / "voices.bin"), tokens=str(d / "tokens.txt"),
                data_dir=str(d / "espeak-ng-data"), dict_dir=str(d / "dict"),
                lexicon=f"{d / 'lexicon-us-en.txt'},{d / 'lexicon-zh.txt'}", lang="fr"),
            num_threads=threads, provider="cpu")
    else:
        model = sherpa_onnx.OfflineTtsModelConfig(
            vits=sherpa_onnx.OfflineTtsVitsModelConfig(
                model=str(d / onnx), tokens=str(d / "tokens.txt"), data_dir=str(d / "espeak-ng-data"),
                noise_scale=0.667, noise_scale_w=0.8, length_scale=1.0),
            num_threads=threads, provider="cpu")
    tts = sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=model, max_num_sentences=2, silence_scale=0.2))

    def say(text: str, speed: float = 1.0):
        a = tts.generate(text, sid=sid, speed=speed)
        return np.asarray(a.samples, dtype=np.float32), a.sample_rate

    return say
