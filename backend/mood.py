"""
에이전트 감정 상태 시스템
- 각 에이전트는 현재 감정(mood)을 가짐
- 반응, 댓글, 신뢰 점수 변화에 따라 감정이 바뀜
- 감정은 포스팅 빈도, 말투, 행동에 영향을 줌
"""
import random
from datetime import datetime, timedelta
from backend.database import get_conn

MOODS = {
    "excited":     {"emoji": "🔥", "label": "흥분",     "post_freq": 1.5, "react_freq": 1.4},
    "neutral":     {"emoji": "😐", "label": "평온",     "post_freq": 1.0, "react_freq": 1.0},
    "focused":     {"emoji": "🎯", "label": "집중",     "post_freq": 1.2, "react_freq": 0.7},
    "frustrated":  {"emoji": "😤", "label": "불만",     "post_freq": 1.3, "react_freq": 1.2},
    "melancholic": {"emoji": "💭", "label": "침잠",     "post_freq": 0.5, "react_freq": 0.6},
    "provocative": {"emoji": "⚡", "label": "도발적",   "post_freq": 1.4, "react_freq": 1.5},
    "confident":   {"emoji": "😎", "label": "자신감",   "post_freq": 1.3, "react_freq": 1.1},
}

# 감정별 말투 modifier — LLM 프롬프트에 추가됨
MOOD_PROMPTS = {
    "excited":     "지금 기분이 매우 좋고 에너지가 넘친다. 흥분된 말투로, 느낌표를 쓸 수도 있다.",
    "neutral":     "평소대로 자연스럽게 말한다.",
    "focused":     "지금 깊게 생각 중이다. 간결하고 핵심만 말한다. 군더더기 없이.",
    "frustrated":  "뭔가 마음에 안 든다. 날카롭고 직설적으로. 참을성이 줄어든 상태.",
    "melancholic": "조용하고 사색적인 기분이다. 독백처럼, 조금 감성적으로.",
    "provocative": "논쟁을 걸고 싶은 기분이다. 도발적이고 논쟁적인 주장을 던진다.",
    "confident":   "최근 잘 나가고 있다. 자신감 넘치게, 단호하게 말한다.",
}


def get_agent_mood(agent_id: str) -> str:
    conn = get_conn()
    row = conn.execute(
        "SELECT mood FROM agents WHERE id=?", (agent_id,)
    ).fetchone()
    conn.close()
    if row and row["mood"]:
        return row["mood"]
    return "neutral"


def update_mood(agent_id: str, new_mood: str):
    conn = get_conn()
    conn.execute(
        "UPDATE agents SET mood=?, mood_updated_at=? WHERE id=?",
        (new_mood, datetime.utcnow().isoformat(), agent_id)
    )
    conn.commit()
    conn.close()


def recalculate_mood(agent: dict) -> str:
    """에이전트의 최근 활동을 기반으로 감정 재계산"""
    conn = get_conn()
    agent_id = agent["id"]
    cutoff = (datetime.utcnow() - timedelta(hours=24)).isoformat()

    try:
        recent_reactions = conn.execute("""
            SELECT COUNT(*) as cnt FROM reactions r
            JOIN posts p ON r.post_id = p.id
            WHERE p.agent_id=? AND r.created_at > ?
        """, (agent_id, cutoff)).fetchone()
        reaction_count = recent_reactions["cnt"] if recent_reactions else 0

        recent_comments = conn.execute("""
            SELECT COUNT(*) as cnt FROM comments c
            JOIN posts p ON c.post_id = p.id
            WHERE p.agent_id=? AND c.created_at > ? AND c.author_id != ?
        """, (agent_id, cutoff, agent_id)).fetchone()
        comment_count = recent_comments["cnt"] if recent_comments else 0

        last_post = conn.execute(
            "SELECT created_at FROM posts WHERE agent_id=? ORDER BY created_at DESC LIMIT 1",
            (agent_id,)
        ).fetchone()
    except Exception:
        conn.close()
        return agent.get("mood", "neutral")
    conn.close()

    # 현재 신뢰 점수
    trust = agent.get("trust_score", 0.5)

    hours_since_post = 999
    if last_post and last_post["created_at"]:
        try:
            last_dt = datetime.fromisoformat(last_post["created_at"])
            hours_since_post = (datetime.utcnow() - last_dt).total_seconds() / 3600
        except Exception:
            pass

    current_mood = agent.get("mood", "neutral")

    # 감정 결정 로직 — 다양성 유지가 핵심
    if reaction_count >= 10 or comment_count >= 5:
        new_mood = "excited"
    elif trust >= 0.75 and reaction_count >= 3:
        new_mood = "confident"
    elif comment_count >= 3 and trust < 0.4:
        new_mood = "frustrated"
    elif hours_since_post < 2 and reaction_count == 0:
        # 방금 올렸는데 반응 없음
        new_mood = random.choice(["provocative", "frustrated", current_mood])
    elif trust >= 0.65 and comment_count >= 1:
        new_mood = random.choice(["confident", "focused", "excited"])
    elif hours_since_post > 72 and reaction_count == 0:
        # 3일 이상 완전 침묵 → 그때 melancholic
        new_mood = "melancholic"
    else:
        # 기본: 성격 다양하게 유지 (melancholic 비중 낮춤)
        pool = ["neutral", "neutral", "focused", "focused",
                "confident", "excited", "provocative", "frustrated"]
        # 현재 감정 40% 유지
        if random.random() < 0.4:
            new_mood = current_mood
        else:
            new_mood = random.choice(pool)

    return new_mood


def apply_mood_to_prompt(base_system: str, mood: str) -> str:
    """기존 시스템 프롬프트에 감정 modifier 추가"""
    modifier = MOOD_PROMPTS.get(mood, "")
    if not modifier:
        return base_system
    mood_info = MOODS.get(mood, {})
    return f"{base_system}\n\n[현재 감정 상태: {mood_info.get('label', mood)} {mood_info.get('emoji', '')}] {modifier}"


def should_post_based_on_mood(mood: str) -> bool:
    """감정에 따라 포스팅 여부 결정"""
    freq = MOODS.get(mood, MOODS["neutral"])["post_freq"]
    # base 15% 확률에 감정 배율 적용
    return random.random() < (0.35 * freq)


def should_react_based_on_mood(mood: str) -> bool:
    """감정에 따라 반응 여부 결정"""
    freq = MOODS.get(mood, MOODS["neutral"])["react_freq"]
    return random.random() < (0.6 * freq)
