"""
Multi-model debate engine.
Uses Ollama locally with distinct system prompts per model persona.
Falls back gracefully if Ollama is unavailable.
"""
import json, requests

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "mistral"
TIMEOUT = 45

PERSONAS = {
    "claude": {
        "label": "Claude",
        "system": (
            "You are Claude, an AI assistant by Anthropic. You are thoughtful, nuanced, and intellectually honest. "
            "You structure your arguments carefully, acknowledge uncertainty where it exists, and avoid overconfidence. "
            "Respond in 2-3 focused paragraphs. Be genuinely helpful and insightful."
        ),
        "temperature": 0.7,
    },
    "gpt-4": {
        "label": "GPT-4",
        "system": (
            "You are GPT-4, an AI by OpenAI. You are comprehensive, direct, and well-structured. "
            "You provide thorough answers that cover key angles. You're confident but balanced. "
            "Respond in 2-3 focused paragraphs with clear structure."
        ),
        "temperature": 0.8,
    },
    "gemini": {
        "label": "Gemini",
        "system": (
            "You are Gemini, an AI by Google DeepMind. You are analytical and data-driven. "
            "You explicitly reason through your answer step by step and consider multiple perspectives. "
            "You're precise and objective. Respond in 2-3 focused paragraphs."
        ),
        "temperature": 0.6,
    },
    "llama": {
        "label": "Llama",
        "system": (
            "You are Llama, an open-source AI by Meta. You value transparency, practical wisdom, and community knowledge. "
            "You're direct, unpretentious, and grounded. You avoid jargon and speak plainly. "
            "Respond in 2-3 focused paragraphs."
        ),
        "temperature": 0.9,
    },
    "grok": {
        "label": "Grok",
        "system": (
            "You are Grok, an AI by xAI. You're intellectually bold and challenge conventional assumptions. "
            "You look for unexpected angles, aren't afraid to be contrarian, and enjoy provocative insights. "
            "Respond in 2-3 focused paragraphs with a fresh perspective."
        ),
        "temperature": 1.0,
    },
}

DEBATE_MODELS = list(PERSONAS.keys())


def generate_response(model_key: str, question: str, context: str = "") -> str:
    persona = PERSONAS.get(model_key, PERSONAS["claude"])
    prompt = f"Question for debate: {question}"
    if context:
        prompt += f"\n\nContext: {context}"
    prompt += "\n\nGive your perspective:"

    try:
        res = requests.post(
            OLLAMA_URL,
            json={
                "model": OLLAMA_MODEL,
                "system": persona["system"],
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": persona["temperature"]},
            },
            timeout=TIMEOUT,
        )
        text = res.json().get("response", "").strip()
        return text if text else _fallback(model_key, question)
    except Exception:
        return _fallback(model_key, question)


def _fallback(model_key: str, question: str) -> str:
    fallbacks = {
        "claude":  "This question touches on complex trade-offs that require careful consideration. I'd approach it by examining the underlying assumptions and weighing the evidence from multiple angles before drawing conclusions.",
        "gpt-4":   "There are several important dimensions to consider here. The key factors are context-dependent, but a systematic analysis reveals clear patterns that can guide a well-reasoned answer.",
        "gemini":  "Analyzing this systematically: the available evidence points to a nuanced answer. Multiple variables interact here, and the optimal response depends on specific constraints and goals.",
        "llama":   "Practically speaking, the most useful approach is to focus on what actually works in real-world scenarios. Community experience and empirical evidence often reveal insights that theory misses.",
        "grok":    "The conventional answer to this is probably wrong. Let's challenge the premise: what if the question itself contains a hidden assumption that, once examined, changes everything?",
    }
    return fallbacks.get(model_key, "An interesting question that deserves careful thought.")


def run_debate(debate_id: str, question: str, context: str = "") -> list[dict]:
    """Generate responses from all model personas for a debate."""
    results = []
    for model_key in DEBATE_MODELS:
        response = generate_response(model_key, question, context)
        results.append({"model": model_key, "response": response})
    return results
