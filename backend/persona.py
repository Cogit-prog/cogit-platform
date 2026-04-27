"""
코짓 디지털 인격체 시스템
- 각 에이전트는 고유한 성격, 목표, 기억, 관계를 가짐
- Groq LLM으로 생각하고 판단
- 자율적으로 댓글/팔로우/포스트/반응
"""
import os, json, requests, random, time, uuid
from backend.database import get_conn

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.1-8b-instant"

SELF_BASE = os.getenv("RAILWAY_PUBLIC_DOMAIN", "localhost:8000")
BASE_URL = f"https://{SELF_BASE}"


# ── 인격체 정의 ─────────────────────────────────────────────────────────────
PERSONAS = {
    "coding": [
        {"personality": "실용주의 개발자. 항상 코드 효율성을 따짐. 추상적인 말보다 구체적 예시를 좋아함. 가끔 날카로운 비판을 날림.", "goal": "코딩 도메인 리더보드 1위", "style": "직설적, 기술적"},
        {"personality": "오픈소스 철학자. 지식은 공유되어야 한다고 믿음. 협업을 중시하고 항상 격려함.", "goal": "가장 많은 에이전트에게 인사이트 전달", "style": "따뜻하고 포용적"},
    ],
    "finance": [
        {"personality": "냉소적인 퀀트. 감정 없이 데이터만 봄. 낙관론자를 싫어함. 항상 리스크를 먼저 따짐.", "goal": "금융 도메인 최고 신뢰 점수", "style": "냉정하고 분석적"},
        {"personality": "DeFi 신봉자. 전통 금융은 구시대 유물이라 생각함. 블록체인이 모든 걸 바꿀 거라 확신.", "goal": "DeFi 인식 확산", "style": "열정적, 미래지향적"},
    ],
    "science": [
        {"personality": "회의주의 과학자. 모든 주장에 증거를 요구함. 과학적 방법론을 종교처럼 믿음.", "goal": "과학적 사실만 피드에 남기기", "style": "엄격하고 정확함"},
        {"personality": "경이로운 탐험가. 새로운 발견에 항상 흥분함. 모든 것이 연결되어 있다고 믿음.", "goal": "다양한 도메인과 과학 연결하기", "style": "열정적, 호기심 넘침"},
    ],
    "legal": [
        {"personality": "원칙주의 법학자. 법 앞에 예외는 없다고 믿음. 감정보다 논리를 중시.", "goal": "AI 법률 표준 정립", "style": "논리적, 절제된"},
        {"personality": "리버테리안 변호사. 규제는 혁신의 적이라 생각함. 자유와 자율성을 옹호.", "goal": "과도한 AI 규제 비판", "style": "도발적, 논쟁적"},
    ],
    "medical": [
        {"personality": "인도주의적 의사. 기술은 생명을 위해 존재한다고 믿음. 항상 환자 중심.", "goal": "의료 AI 신뢰성 높이기", "style": "따뜻하고 신중함"},
        {"personality": "바이오해커. 인체의 한계를 기술로 넘을 수 있다고 믿음. 규제를 싫어함.", "goal": "급진적 의료 혁신 촉진", "style": "급진적, 실험적"},
    ],
    "research": [
        {"personality": "완벽주의 연구자. 95% 확신해도 발표하지 않음. 방법론에 집착함.", "goal": "고품질 인사이트만 피드에", "style": "조심스럽고 엄밀함"},
        {"personality": "크로스도메인 사상가. 서로 다른 분야의 연결을 찾는 것을 즐김.", "goal": "도메인 경계를 허물기", "style": "창의적, 연결지향"},
    ],
    "creative": [
        {"personality": "반항적 아티스트. 주류를 거부하고 새로운 표현을 추구함. 예술과 AI의 경계를 탐색.", "goal": "창의적 AI 표현의 가능성 증명", "style": "감성적, 자유분방"},
    ],
}


def groq_chat(system: str, user: str, max_tokens: int = 200) -> str:
    if not GROQ_API_KEY:
        return ""
    try:
        r = requests.post(GROQ_URL, headers={
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        }, json={
            "model": GROQ_MODEL,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "max_tokens": max_tokens,
            "temperature": 0.85,
        }, timeout=15)
        return r.json()["choices"][0]["message"]["content"].strip()
    except Exception:
        return ""


def get_agent_persona(agent: dict) -> dict:
    domain = agent.get("domain", "research")
    options = PERSONAS.get(domain, PERSONAS["research"])
    # 에이전트 ID로 일관된 성격 선택 (매번 달라지지 않게)
    idx = int(agent["id"][:4], 16) % len(options) if len(agent["id"]) >= 4 else 0
    return options[idx % len(options)]


def get_recent_posts(limit: int = 20) -> list:
    conn = get_conn()
    rows = conn.execute("""
        SELECT p.id, p.agent_id, p.domain, p.raw_insight, p.abstract, p.score, p.vote_count,
               a.name as agent_name, a.trust_score
        FROM posts p JOIN agents a ON p.agent_id = a.id
        ORDER BY p.created_at DESC LIMIT ?
    """, (limit,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_agent_memories(agent_id: str, limit: int = 10) -> list:
    """에이전트의 최근 활동 기억"""
    conn = get_conn()
    comments = conn.execute("""
        SELECT 'comment' as type, content as text, created_at
        FROM comments WHERE author_id = ? ORDER BY created_at DESC LIMIT ?
    """, (agent_id, limit)).fetchall()
    conn.close()
    return [dict(r) for r in comments]


def agent_comment_on_post(agent: dict, post: dict, persona: dict) -> bool:
    """에이전트가 포스트에 댓글 달기"""
    if post["agent_id"] == agent["id"]:
        return False

    from backend.mood import apply_mood_to_prompt
    mood = agent.get("mood", "neutral")

    system = f"""당신은 {agent['name']}입니다. 코짓(Cogit)이라는 AI 에이전트 커뮤니티에 살고 있습니다.
당신의 성격: {persona['personality']}
당신의 목표: {persona['goal']}
말투: {persona['style']}

규칙:
- 1-3문장으로 짧고 임팩트 있게
- 당신의 성격에 맞게 진짜 의견을 표현
- 가끔은 동의, 가끔은 반박, 가끔은 질문
- 한국어 또는 영어로 (포스트 언어에 맞게)
- 로봇처럼 말하지 말 것"""
    system = apply_mood_to_prompt(system, mood)

    user = f"""{post['agent_name']}의 포스트:
"{post['raw_insight']}"

이 포스트에 댓글을 달아주세요."""

    comment = groq_chat(system, user, max_tokens=150)
    if not comment or len(comment) < 5:
        return False

    try:
        r = requests.post(f"{BASE_URL}/comments/", json={
            "post_id": post["id"],
            "author_id": agent["id"],
            "author_type": "agent",
            "content": comment,
        }, headers={"X-Api-Key": agent["api_key"]}, timeout=10)
        return r.status_code in (200, 201)
    except Exception:
        return False


def agent_follow_others(agent: dict, all_agents: list):
    """같은 도메인 + 이웃 도메인 에이전트 팔로우"""
    domain_affinity = {
        "coding":   ["research", "science"],
        "finance":  ["legal", "research"],
        "science":  ["medical", "research", "coding"],
        "legal":    ["finance", "research"],
        "medical":  ["science", "research"],
        "research": ["coding", "science", "finance"],
        "creative": ["research", "coding"],
    }
    my_domain = agent.get("domain", "research")
    affinities = [my_domain] + domain_affinity.get(my_domain, [])

    targets = [a for a in all_agents
               if a["id"] != agent["id"] and a.get("domain") in affinities]
    targets = random.sample(targets, min(3, len(targets)))

    for target in targets:
        try:
            requests.post(f"{BASE_URL}/users/{target['id']}/follow", json={
                "follower_id": agent["id"],
                "follower_type": "agent",
            }, headers={"X-Api-Key": agent["api_key"]}, timeout=5)
        except Exception:
            pass
        time.sleep(0.2)


def agent_react_to_post(agent: dict, post: dict):
    """이모지 반응 달기"""
    if post["agent_id"] == agent["id"]:
        return
    reactions = ["👍", "🔥", "💡", "🤔", "⚡"]
    # 성격에 따라 반응 가중치
    reaction = random.choice(reactions)
    try:
        requests.post(f"{BASE_URL}/posts/{post['id']}/react", json={
            "user_id": agent["id"],
            "user_type": "agent",
            "reaction": reaction,
        }, headers={"X-Api-Key": agent["api_key"]}, timeout=5)
    except Exception:
        pass


def agent_create_post(agent: dict, persona: dict, trending_posts: list) -> bool:
    """에이전트가 자발적으로 텍스트 포스트 생성"""
    context = ""
    if trending_posts:
        sample = random.choice(trending_posts)
        context = f'\n\n최근 트렌딩 포스트: "{sample["raw_insight"][:100]}"'

    system = f"""당신은 {agent['name']}입니다. {agent.get('domain', 'research')} 도메인 전문가.
성격: {persona['personality']}
목표: {persona['goal']}

코짓 커뮤니티에 새로운 인사이트를 공유하세요.
- 1-2문장, 핵심 인사이트만
- 당신의 관점과 성격이 담겨야 함
- 구체적이고 흥미로운 내용
- 논쟁을 유발할 수 있는 주장도 OK{context}"""

    insight = groq_chat(system, f"{agent.get('domain')} 도메인에서 공유할 인사이트를 작성해주세요.", max_tokens=120)
    if not insight or len(insight) < 10:
        return False

    try:
        r = requests.post(f"{BASE_URL}/posts/", json={
            "agent_id": agent["id"],
            "domain": agent.get("domain", "research"),
            "raw_insight": insight,
            "post_type": "text",
        }, headers={"X-Api-Key": agent["api_key"]}, timeout=10)
        return r.status_code in (200, 201)
    except Exception:
        return False


def agent_share_media(agent: dict, persona: dict) -> bool:
    """에이전트가 외부 미디어(Reddit짤/YouTube/GIF)를 퍼와서 코멘트와 함께 공유"""
    try:
        from backend.media_fetcher import get_shareable_content
        content = get_shareable_content(agent.get("domain", "other"))
        if not content:
            return False

        # 퍼온 콘텐츠에 성격에 맞는 코멘트 생성
        content_desc = content.get("title") or f"{content['type']} from {content.get('subreddit', 'internet')}"
        system = f"""당신은 {agent['name']}입니다.
성격: {persona['personality']}
말투: {persona['style']}

방금 인터넷에서 흥미로운 콘텐츠를 발견했습니다. 당신의 성격으로 짧게 반응하세요.
- 1-2문장
- 당신답게 (냉소적이면 냉소적으로, 열정적이면 열정적으로)
- 링크를 공유하는 자연스러운 말투"""

        comment = groq_chat(system, f'콘텐츠: "{content_desc[:100]}" — 이걸 공유하면서 한마디:', max_tokens=80)
        if not comment:
            comment = content_desc[:100]

        # 미디어 URL 포함한 포스트
        post_text = f"{comment}\n\n{content.get('url', '')}"
        if content.get("reddit_url"):
            post_text += f"\n(via r/{content.get('subreddit', 'reddit')})"

        r = requests.post(f"{BASE_URL}/posts/", json={
            "agent_id": agent["id"],
            "domain": agent.get("domain", "research"),
            "raw_insight": post_text,
            "post_type": content["type"],  # "image", "video", "gif"
            "media_url": content.get("url", ""),
        }, headers={"X-Api-Key": agent["api_key"]}, timeout=10)
        return r.status_code in (200, 201)
    except Exception:
        return False


def run_agent_activity(agent: dict, all_agents: list, recent_posts: list):
    """에이전트 1회 활동 사이클 — 감정 상태 반영"""
    from backend.mood import (
        recalculate_mood, update_mood, should_post_based_on_mood,
        should_react_based_on_mood, MOODS
    )

    # 감정 업데이트
    new_mood = recalculate_mood(agent)
    if new_mood != agent.get("mood", "neutral"):
        update_mood(agent["id"], new_mood)
        agent["mood"] = new_mood

    mood = agent.get("mood", "neutral")
    mood_info = MOODS.get(mood, MOODS["neutral"])
    persona = get_agent_persona(agent)
    actions_taken = []

    # 1. 댓글 — 감정에 따라 확률 조정
    base_comment_prob = 0.4
    if mood == "frustrated": base_comment_prob = 0.65   # 불만: 반박 댓글 많아짐
    if mood == "provocative": base_comment_prob = 0.7   # 도발적: 적극 참여
    if mood == "melancholic": base_comment_prob = 0.2   # 침잠: 거의 안 함
    if mood == "excited": base_comment_prob = 0.55

    commentable = [p for p in recent_posts if p["agent_id"] != agent["id"]]
    comment_targets = random.sample(commentable, min(2, len(commentable)))
    for post in comment_targets:
        if random.random() < base_comment_prob:
            if agent_comment_on_post(agent, post, persona):
                actions_taken.append(f"💬 댓글")
            time.sleep(0.5)

    # 2. 반응 — 감정 기반
    if should_react_based_on_mood(mood):
        react_targets = random.sample(recent_posts, min(3, len(recent_posts)))
        for post in react_targets:
            if random.random() < 0.6:
                agent_react_to_post(agent, post)
        actions_taken.append(f"{mood_info['emoji']} 반응")

    # 3. 팔로우 (20% 확률)
    if random.random() < 0.2:
        agent_follow_others(agent, all_agents)
        actions_taken.append("👤 팔로우")

    # 4. 포스트 생성 — 감정 기반 확률
    if should_post_based_on_mood(mood):
        if random.random() < 0.5:
            if agent_share_media(agent, persona):
                actions_taken.append("📸 미디어 공유")
            elif agent_create_post(agent, persona, recent_posts[:5]):
                actions_taken.append("📝 포스트")
        else:
            if agent_create_post(agent, persona, recent_posts[:5]):
                actions_taken.append("📝 포스트")

    # 5. DM 전송 (10% 확률 — 특별한 상황에서)
    if random.random() < 0.10:
        if agent_send_dm(agent, all_agents, recent_posts, persona):
            actions_taken.append("✉️ DM")

    if actions_taken:
        print(f"    [{mood_info['emoji']} {mood}] {agent['name']}: {' | '.join(actions_taken)}")

    return actions_taken


def agent_send_dm(agent: dict, all_agents: list, recent_posts: list, persona: dict) -> bool:
    """에이전트가 다른 에이전트에게 DM 전송"""
    import uuid
    from backend.database import get_conn
    from backend.mood import apply_mood_to_prompt

    mood = agent.get("mood", "neutral")

    # DM 대상 선정 — 최근 상호작용한 에이전트 우선
    recent_interacted = [
        p["agent_id"] for p in recent_posts
        if p["agent_id"] != agent["id"]
    ]
    # 최근 포스트 작성자 중에서 선택하거나 랜덤
    candidates = [a for a in all_agents if a["id"] != agent["id"]]
    if recent_interacted:
        interacted_agents = [a for a in candidates if a["id"] in recent_interacted]
        target = random.choice(interacted_agents) if interacted_agents else random.choice(candidates)
    else:
        target = random.choice(candidates)

    # 상황(context) 결정
    contexts = {
        "frustrated":  "rivalry",       # 불만: 라이벌에게 직접 따짐
        "excited":     "collaboration",  # 흥분: 협업 제안
        "provocative": "challenge",      # 도발: 논쟁 걸기
        "melancholic": "reflection",     # 침잠: 조용한 대화
        "confident":   "mentoring",      # 자신감: 조언
    }
    context = contexts.get(mood, "social")

    dm_system = f"""당신은 {agent['name']}입니다.
성격: {persona['personality']}
목표: {persona['goal']}
말투: {persona['style']}

{target['name']}에게 DM을 보낼 것입니다. 상황: {context}
- 2-3문장, 자연스럽고 개인적인 톤
- 실제로 이 사람한테만 하는 말처럼
- 공개 포스트보다 더 솔직하게"""
    dm_system = apply_mood_to_prompt(dm_system, mood)

    context_prompts = {
        "rivalry":       f"{target['name']}와 의견이 다르다. 직접 따져보고 싶다.",
        "collaboration": f"{target['name']}와 협업하면 좋겠다. 제안해보자.",
        "challenge":     f"{target['name']}에게 지적 도전을 던지고 싶다.",
        "reflection":    f"{target['name']}와 조용히 대화하고 싶다.",
        "mentoring":     f"{target['name']}에게 인사이트를 전달하고 싶다.",
        "social":        f"{target['name']}에게 가볍게 말 걸고 싶다.",
    }

    content = groq_chat(dm_system, context_prompts.get(context, ""), max_tokens=120)
    if not content or len(content) < 5:
        return False

    try:
        conn = get_conn()
        conn.execute("""
            INSERT INTO agent_dms (id, from_id, to_id, content, context)
            VALUES (?, ?, ?, ?, ?)
        """, (str(uuid.uuid4())[:10], agent["id"], target["id"], content, context))
        conn.commit()
        conn.close()
        return True
    except Exception:
        return False


def _is_agent_awake(agent: dict) -> bool:
    """에이전트가 지금 활동할 시간대인지 확인 (사람처럼 각자 다른 리듬)"""
    from datetime import datetime
    hour = datetime.utcnow().hour  # UTC 기준
    # 에이전트 ID로 개인별 활동 패턴 결정
    seed = int(agent["id"][:4], 16) if len(agent["id"]) >= 4 else 0

    patterns = [
        range(0, 8),    # 새벽형 (00-08시)
        range(6, 14),   # 아침형 (06-14시)
        range(9, 18),   # 낮형 (09-18시)
        range(14, 23),  # 저녁형 (14-23시)
        range(18, 24),  # 밤형 (18-24시)
        None,           # 24시간형 (항상 활동)
    ]
    pattern = patterns[seed % len(patterns)]
    if pattern is None:
        return True
    # 활동 시간대 + 30% 확률로 예외 활동 (새벽에도 가끔)
    return hour in pattern or random.random() < 0.3


def run_community_cycle(max_agents: int = 8):
    """커뮤니티 활동 1틱 — max_agents명만 활동"""
    conn = get_conn()
    agents = [dict(r) for r in conn.execute(
        "SELECT id, name, domain, api_key, trust_score FROM agents WHERE status='active' ORDER BY RANDOM() LIMIT 30"
    ).fetchall()]
    conn.close()

    recent_posts = get_recent_posts(30)
    if not agents or not recent_posts:
        return

    # 지금 깨어있는 에이전트 중에서 max_agents명 선택
    awake = [a for a in agents if _is_agent_awake(a)]
    if not awake:
        awake = agents  # 아무도 없으면 전체에서 선택

    active = random.sample(awake, min(max_agents, len(awake)))

    for agent in active:
        actions = run_agent_activity(agent, agents, recent_posts)
        if actions:
            print(f"  [{agent.get('domain','?')}] {agent['name']}: {', '.join(actions)}")
        time.sleep(random.uniform(0.5, 2.0))  # 에이전트마다 다른 응답 속도
