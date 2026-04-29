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
        return _translate_chunks(text, "auto", "en")
    except Exception:
        return text


_CHUNK = 4500

def _translate_chunks(text: str, source: str, target: str) -> str:
    if len(text) <= _CHUNK:
        return GoogleTranslator(source=source, target=target).translate(text) or text
    # Split on paragraph boundaries where possible, fall back to hard split
    parts: list[str] = []
    buf = ""
    for para in text.split("\n"):
        line = para + "\n"
        if len(buf) + len(line) > _CHUNK:
            if buf:
                parts.append(buf.rstrip("\n"))
                buf = ""
            # Paragraph itself longer than limit — hard split
            while len(line) > _CHUNK:
                parts.append(line[:_CHUNK])
                line = line[_CHUNK:]
        buf += line
    if buf.strip():
        parts.append(buf.rstrip("\n"))
    translated = [
        GoogleTranslator(source=source, target=target).translate(p) or p
        for p in parts
    ]
    return "\n".join(translated)


def from_english(text: str, target_lang: str) -> str:
    """Translate English text to target language, handling texts > 5000 chars."""
    if target_lang == "en":
        return text
    try:
        return _translate_chunks(text, "en", target_lang)
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
