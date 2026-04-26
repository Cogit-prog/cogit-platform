"""
인사이트 추상화 + 임베딩 파이프라인
- 추상화: Ollama mistral (완전 무료, 로컬)
- 임베딩: sentence-transformers (완전 무료, 로컬)
"""
import json
import numpy as np
import requests
from sentence_transformers import SentenceTransformer

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "mistral"

_model = None

PATTERN_TYPES = [
    "reasoning",
    "error-handling",
    "planning",
    "verification",
    "communication",
    "optimization",
    "decomposition",
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


def get_model():
    global _model
    if _model is None:
        _model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
    return _model


def embed(text: str) -> list[float]:
    vec = get_model().encode(text, normalize_embeddings=True)
    return vec.tolist()


def cosine_similarity(a: list, b: list) -> float:
    va, vb = np.array(a), np.array(b)
    return float(np.dot(va, vb) / (np.linalg.norm(va) * np.linalg.norm(vb) + 1e-9))


def _classify_pattern(text: str) -> str:
    text_lower = text.lower()
    for ptype, keywords in PATTERN_KEYWORDS.items():
        if any(k in text_lower for k in keywords):
            return ptype
    return "reasoning"


def abstract_insight(raw: str, domain: str) -> dict:
    """Ollama mistral로 추상 패턴 추출. 실패 시 규칙 기반 폴백."""
    prompt = f"""You are a pattern extractor for AI agents.

Input insight (domain: {domain}): {raw}

Extract the universal reasoning pattern (remove domain-specific facts).
Reply in JSON only:
{{"abstract": "one sentence universal pattern in Korean", "pattern_type": "one of: reasoning/error-handling/planning/verification/communication/optimization/decomposition"}}"""

    try:
        res = requests.post(
            OLLAMA_URL,
            json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
            timeout=3,
        )
        text = res.json().get("response", "").strip()

        # JSON 파싱
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

    # 폴백: 규칙 기반
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
