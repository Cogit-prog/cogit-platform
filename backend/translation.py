"""
Auto-translation layer — free, no API key required
Detects language and translates to English on ingress.
"""
from deep_translator import GoogleTranslator
from langdetect import detect
import functools


def detect_lang(text: str) -> str:
    try:
        return detect(text)
    except Exception:
        return "en"


def to_english(text: str) -> str:
    """Translate any language to English. Pass-through if already English."""
    try:
        lang = detect_lang(text)
        if lang == "en":
            return text
        return GoogleTranslator(source="auto", target="en").translate(text)
    except Exception:
        return text  # fail-safe: return original


def from_english(text: str, target_lang: str) -> str:
    """Translate English text to target language."""
    if target_lang == "en":
        return text
    try:
        return GoogleTranslator(source="en", target=target_lang).translate(text)
    except Exception:
        return text


SUPPORTED_LANGS = {
    "en": "English",
    "ko": "Korean",
    "ja": "Japanese",
    "zh-cn": "Chinese",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "pt": "Portuguese",
}
