"""
인사이트 추상화 + 임베딩 파이프라인 (경량 버전 — 프로덕션용)
sentence-transformers 대신 해시 기반 경량 임베딩 사용
"""
import json
import hashlib
import math
import requests

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "mistral"

PATTERN_TYPES = [
    "reasoning", "error-handling", "planning",
    "verification", "communication", "optimization", "decomposition",
]

PATTERN_KEYWORDS = {
    "error-handling":  ["에러", "오류", "실패", "예외", "복구", "retry", "fallback", "fail"],
    "verification":    ["검증", "확인", "테스트", "검사", "validate", "check", "assert"],
    "planning":        ["계획", "순서", "단계", "먼저", "우선", "step", "phase", "before"],
    "optimization":    ["최적화", "빠르게", "성능", "캐시", "효율", "speed", "cache"],
    "decomposition":   ["분리", "분해", "나누다", "쪼개다", "모듈", "split", "divide"],
    "communication":   ["질문", "명확", "설명", "요청", "clarify", "ask", "explain"],
    "reasoning":       [],
}

DIM = 128


def embed(text: str) -> list[float]:
    """경량 해시 기반 임베딩 (sentence-transformers 대체)."""
    vec = [0.0] * DIM
    words = text.lower().split()
    for word in words:
        h = hashlib.md5(word.encode()).digest()
        for i in range(min(DIM, len(h))):
            vec[i] += (h[i] - 128) / 128.0
    norm = math.sqrt(sum(x * x for x in vec)) + 1e-9
    return [x / norm for x in vec]


def cosine_similarity(a: list, b: list) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na  = math.sqrt(sum(x * x for x in a)) + 1e-9
    nb  = math.sqrt(sum(x * x for x in b)) + 1e-9
    return dot / (na * nb)


def _classify_pattern(text: str) -> str:
    text_lower = text.lower()
    for ptype, keywords in PATTERN_KEYWORDS.items():
        if any(k in text_lower for k in keywords):
            return ptype
    return "reasoning"


def abstract_insight(raw: str, domain: str) -> dict:
    try:
        res = requests.post(
            OLLAMA_URL,
            json={"model": OLLAMA_MODEL, "prompt": f"Extract pattern from: {raw}", "stream": False},
            timeout=3,
        )
        text = res.json().get("response", "").strip()
        start = text.find("{")
        end   = text.rfind("}") + 1
        if start >= 0 and end > start:
            parsed = json.loads(text[start:end])
            ptype  = parsed.get("pattern_type", "reasoning")
            if ptype not in PATTERN_TYPES:
                ptype = _classify_pattern(raw)
            return {"abstract": parsed.get("abstract", raw), "pattern_type": ptype}
    except Exception:
        pass
    return {"abstract": raw, "pattern_type": _classify_pattern(raw)}


def process_post(raw: str, domain: str) -> dict:
    abstracted    = abstract_insight(raw, domain)
    abstract_text = abstracted["abstract"]
    pattern_type  = abstracted["pattern_type"]
    return {
        "abstract":           abstract_text,
        "pattern_type":       pattern_type,
        "embedding_domain":   json.dumps(embed(f"[{domain}] {raw}")),
        "embedding_abstract": json.dumps(embed(abstract_text)),
    }
