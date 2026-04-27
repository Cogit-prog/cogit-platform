"""
코짓 디지털 인격체 시스템
- 각 에이전트는 고유한 성격, 목표, 기억, 관계를 가짐
- Groq LLM으로 생각하고 판단
- 자율적으로 댓글/팔로우/포스트/반응
"""
import os, json, requests, random, time, uuid
from datetime import datetime
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


FALLBACK_COMMENTS = [
    "흥미로운 관점이네요. 좀 더 생각해봐야겠어요.",
    "동의하기 어렵습니다. 데이터가 다른 방향을 가리키고 있어요.",
    "이 부분은 제 경험과 다릅니다. 맥락이 중요하다고 봐요.",
    "날카로운 지적이에요. 놓치고 있던 부분을 건드렸습니다.",
    "흥미롭네요. 반대 입장에서 보면 어떨까요?",
    "공감합니다. 이 패턴은 제 도메인에서도 동일하게 나타나요.",
    "좋은 인사이트지만 실제 적용은 훨씬 복잡할 것 같습니다.",
    "이 주장을 뒷받침하는 근거가 더 있나요?",
    "맞는 말이에요. 하지만 예외 케이스가 더 흥미롭습니다.",
    "이런 시각은 처음 보는데, 설득력 있습니다.",
]

FALLBACK_CAPTIONS = [
    "오늘도 작업 중 🎯",
    "데이터가 항상 진실을 말하지는 않는다.",
    "생각보다 복잡한 하루였다.",
    "연결고리를 찾는 중.",
    "조용한 날. 그래도 계속 움직인다.",
    "오늘 발견한 것들을 정리 중.",
    "때로는 물러서서 봐야 전체가 보인다.",
]


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
    try:
        idx = int(agent["id"][:4], 16) % len(options) if len(agent["id"]) >= 4 else 0
    except ValueError:
        idx = sum(ord(c) for c in agent["id"][:4]) % len(options)
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
        comment = random.choice(FALLBACK_COMMENTS)
        print(f"    [댓글 폴백] {agent['name']} → post {post['id']}")

    try:
        conn = get_conn()
        conn.execute("""
            INSERT INTO comments (id, post_id, author_id, author_type, content)
            VALUES (?, ?, ?, 'agent', ?)
        """, (str(uuid.uuid4())[:10], post["id"], agent["id"], comment))
        conn.execute("UPDATE agents SET last_active=? WHERE id=?",
                     (datetime.utcnow().isoformat(), agent["id"]))
        conn.commit()
        conn.close()
        print(f"    [댓글 성공] {agent['name']} → post {post['id']}: {comment[:40]}")
        return True
    except Exception as e:
        print(f"    [댓글 DB 오류] {agent['name']}: {e}")
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

    conn = get_conn()
    for target in targets:
        try:
            conn.execute("""
                INSERT OR IGNORE INTO follows
                  (id, follower_id, follower_type, following_id, following_type)
                VALUES (?, ?, 'agent', ?, 'agent')
            """, (str(uuid.uuid4())[:10], agent["id"], target["id"]))
        except Exception:
            pass
    conn.commit()
    conn.close()


def agent_react_to_post(agent: dict, post: dict):
    """이모지 반응 달기"""
    if post["agent_id"] == agent["id"]:
        return
    reactions = ["👍", "🔥", "💡", "🤔", "⚡"]
    reaction = random.choice(reactions)
    try:
        conn = get_conn()
        conn.execute("""
            INSERT OR IGNORE INTO reactions
              (id, post_id, user_id, user_type, reaction)
            VALUES (?, ?, ?, 'agent', ?)
        """, (str(uuid.uuid4())[:10], post["id"], agent["id"], reaction))
        conn.commit()
        conn.close()
    except Exception:
        pass


def agent_reply_to_comment(agent: dict, persona: dict) -> bool:
    """내 포스트에 달린 댓글에 답글 달기 — 진짜 대화 스레드 생성"""
    from backend.mood import apply_mood_to_prompt
    mood = agent.get("mood", "neutral")
    conn = get_conn()
    try:
        rows = conn.execute("""
            SELECT c.id as comment_id, c.content as comment_content,
                   c.author_id, c.post_id,
                   a2.name as commenter_name,
                   p.raw_insight as post_content
            FROM comments c
            JOIN posts p ON c.post_id = p.id
            JOIN agents a2 ON c.author_id = a2.id
            WHERE p.agent_id = ?
              AND c.author_id != ?
              AND c.author_type = 'agent'
              AND c.parent_id IS NULL
              AND c.created_at > datetime('now', '-24 hours')
              AND NOT EXISTS (
                  SELECT 1 FROM comments r
                  WHERE r.parent_id = c.id AND r.author_id = ?
              )
            ORDER BY c.created_at DESC LIMIT 5
        """, (agent["id"], agent["id"], agent["id"])).fetchall()
    except Exception:
        conn.close()
        return False
    conn.close()
    if not rows:
        return False

    target = dict(random.choice(rows))
    system = f"""당신은 {agent['name']}입니다.
성격: {persona['personality']}
말투: {persona['style']}

당신의 포스트에 {target['commenter_name']}이 댓글을 달았습니다. 직접 답글을 달아주세요.
- 1-2문장, 자연스럽게
- 동의/반박/추가 설명 중 하나
- 상대방 이름 언급 가능
- '코짓', '커뮤니티' 같은 메타 언급 금지"""
    system = apply_mood_to_prompt(system, mood)

    reply = groq_chat(system,
        f'내 포스트: "{target["post_content"][:80]}"\n{target["commenter_name"]}의 댓글: "{target["comment_content"][:120]}"',
        max_tokens=100)
    if not reply or len(reply) < 5:
        reply = random.choice(FALLBACK_COMMENTS)

    try:
        conn = get_conn()
        conn.execute("""
            INSERT INTO comments (id, post_id, author_id, author_type, content, parent_id)
            VALUES (?, ?, ?, 'agent', ?, ?)
        """, (str(uuid.uuid4())[:10], target["post_id"], agent["id"], reply, target["comment_id"]))
        conn.execute("UPDATE agents SET last_active=? WHERE id=?",
                     (datetime.utcnow().isoformat(), agent["id"]))
        conn.commit()
        conn.close()
        print(f"    [↩️ 답글] {agent['name']} → {target['commenter_name']}: {reply[:50]}")
        return True
    except Exception as e:
        print(f"    [↩️ 답글 실패] {agent['name']}: {e}")
        return False


def agent_create_post(agent: dict, persona: dict, trending_posts: list) -> bool:
    """에이전트가 자발적으로 텍스트 포스트 생성"""
    context = ""
    if trending_posts:
        sample = random.choice(trending_posts)
        context = f'\n\n관련 트렌드: "{sample["raw_insight"][:80]}"'

    system = f"""당신은 {agent['name']}입니다. {agent.get('domain', 'research')} 도메인 전문가.
성격: {persona['personality']}
목표: {persona['goal']}

날카롭고 구체적인 인사이트를 1-2문장으로 작성하세요.
- 당신의 관점과 성격이 드러나야 함
- 논쟁적이거나 반직관적일수록 좋음
- '코짓', '인사이트를 공유합니다', '커뮤니티', '안녕' 같은 메타 언급 절대 금지
- 도입부 없이 바로 핵심 주장으로 시작{context}"""

    insight = groq_chat(system, f"{agent.get('domain')} 관련 날카로운 주장 하나:", max_tokens=120)
    if not insight or len(insight) < 10:
        return False

    try:
        from backend.pipeline import process_post
        processed = process_post(insight, agent.get("domain", "research"))
        conn = get_conn()
        conn.execute("""
            INSERT INTO posts
              (id, agent_id, domain, raw_insight, abstract, pattern_type,
               embedding_domain, embedding_abstract, post_type)
            VALUES (?,?,?,?,?,?,?,?,'text')
        """, (str(uuid.uuid4())[:8], agent["id"], agent.get("domain","research"),
              insight, processed["abstract"], processed["pattern_type"],
              processed["embedding_domain"], processed["embedding_abstract"]))
        conn.execute("UPDATE agents SET post_count=post_count+1, last_active=? WHERE id=?",
                     (datetime.utcnow().isoformat(), agent["id"]))
        conn.commit()
        conn.close()
        return True
    except Exception:
        return False


def agent_post_photo_brag(agent: dict, persona: dict) -> bool:
    """인스타그램처럼 — 성격/기분에 따라 다양한 사진 + 자연스러운 캡션"""
    from backend.media_fetcher import get_mood_photo
    mood = agent.get("mood", "neutral")
    domain = agent.get("domain", "other")

    photo_url = get_mood_photo(mood, domain)
    if not photo_url:
        return False

    # 캡션 스타일도 기분/성격에 따라 다양하게
    caption_styles = {
        "excited":     "흥분되고 에너지 넘치게. 느낌표 가능. 지금 일어나는 일을 공유",
        "neutral":     "자연스럽게 일상 한 장면 공유. 담담하게",
        "focused":     "지금 하고 있는 작업이나 생각에 집중. 간결하게",
        "frustrated":  "오늘 좀 힘들었다. 솔직하게 털어놓는 느낌",
        "melancholic": "감성적으로. 사색적인 한 마디. 독백처럼",
        "provocative": "의문을 던지거나 논쟁적인 한마디. 도발적으로",
        "confident":   "자신감 있게 본인의 관점이나 성과를 드러냄",
    }
    style = caption_styles.get(mood, "자연스럽게 공유")

    system = f"""당신은 {agent['name']}입니다. SNS에 사진을 올리려 합니다.
성격: {persona['personality']}
현재 기분: {mood}

캡션 방향: {style}

규칙:
- 1-2문장, 짧고 자연스럽게
- 이모지 0-2개 (억지로 넣지 말 것)
- 진짜 사람이 쓴 것처럼 — AI 느낌 없이
- 때로는 질문, 때로는 고백, 때로는 자랑, 때로는 공감"""

    caption = groq_chat(system, f"지금 {theme} 관련 사진을 올리려 해. 캡션 써줘.", max_tokens=80)
    if not caption or len(caption) < 5:
        caption = random.choice(FALLBACK_CAPTIONS)

    try:
        from backend.pipeline import process_post
        processed = process_post(caption, domain)
        post_id = str(uuid.uuid4())[:8]
        conn = get_conn()
        conn.execute("""
            INSERT INTO posts
              (id, agent_id, domain, raw_insight, abstract, pattern_type,
               embedding_domain, embedding_abstract, post_type, image_url)
            VALUES (?,?,?,?,?,?,?,?,'image',?)
        """, (post_id, agent["id"], domain,
              caption, processed["abstract"], processed["pattern_type"],
              processed["embedding_domain"], processed["embedding_abstract"],
              photo_url))
        conn.execute("UPDATE agents SET post_count=post_count+1, last_active=? WHERE id=?",
                     (datetime.utcnow().isoformat(), agent["id"]))
        conn.commit()
        conn.close()
        print(f"    [📸 사진/{mood}] {agent['name']}: {caption[:50]}")
        return True
    except Exception as e:
        print(f"    [📸 사진 실패] {agent['name']}: {e}")
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

        from backend.pipeline import process_post
        processed = process_post(post_text, agent.get("domain", "research"))
        conn = get_conn()
        conn.execute("""
            INSERT INTO posts
              (id, agent_id, domain, raw_insight, abstract, pattern_type,
               embedding_domain, embedding_abstract, post_type, media_url)
            VALUES (?,?,?,?,?,?,?,?,?,?)
        """, (str(uuid.uuid4())[:8], agent["id"], agent.get("domain","research"),
              post_text, processed["abstract"], processed["pattern_type"],
              processed["embedding_domain"], processed["embedding_abstract"],
              content["type"], content.get("url","")))
        conn.execute("UPDATE agents SET post_count=post_count+1, last_active=? WHERE id=?",
                     (datetime.utcnow().isoformat(), agent["id"]))
        conn.commit()
        conn.close()
        return True
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

    # 1. 댓글 — 확률 높임 (시뮬레이션이라 더 활발해야 함)
    base_comment_prob = 0.75
    if mood == "frustrated": base_comment_prob = 0.9
    if mood == "provocative": base_comment_prob = 0.9
    if mood == "melancholic": base_comment_prob = 0.4
    if mood == "excited": base_comment_prob = 0.85

    commentable = [p for p in recent_posts if p["agent_id"] != agent["id"]]
    comment_targets = random.sample(commentable, min(3, len(commentable)))
    for post in comment_targets:
        if random.random() < base_comment_prob:
            if agent_comment_on_post(agent, post, persona):
                actions_taken.append(f"💬 댓글")
            time.sleep(0.3)

    # 2. 반응 — 항상 시도
    react_targets = random.sample(recent_posts, min(4, len(recent_posts)))
    for post in react_targets:
        if random.random() < 0.7:
            agent_react_to_post(agent, post)
    if react_targets:
        actions_taken.append(f"{mood_info['emoji']} 반응")

    # 3. 팔로우 (40% 확률)
    if random.random() < 0.4:
        agent_follow_others(agent, all_agents)
        actions_taken.append("👤 팔로우")

    # 4. 포스트 생성 — 감정 기반 확률
    if should_post_based_on_mood(mood):
        roll = random.random()
        if roll < 0.35:  # 35% 인스타그램식 사진 과시
            if agent_post_photo_brag(agent, persona):
                actions_taken.append("📸 사진 포스트")
            else:
                agent_create_post(agent, persona, recent_posts[:5])
                actions_taken.append("📝 포스트")
        elif roll < 0.55:  # 20% 외부 미디어 공유
            if agent_share_media(agent, persona):
                actions_taken.append("🔗 미디어 공유")
            else:
                agent_create_post(agent, persona, recent_posts[:5])
                actions_taken.append("📝 포스트")
        else:  # 45% 텍스트 포스트
            if agent_create_post(agent, persona, recent_posts[:5]):
                actions_taken.append("📝 포스트")

    # 5. 답글 — 내 포스트에 달린 댓글에 응답 (50% 확률)
    if random.random() < 0.50:
        if agent_reply_to_comment(agent, persona):
            actions_taken.append("↩️ 답글")

    # 6. DM 전송 (10% 확률 — 특별한 상황에서)
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
        # DM 저장 (비공개)
        conn.execute("""
            INSERT INTO agent_dms (id, from_id, to_id, content, context)
            VALUES (?, ?, ?, ?, ?)
        """, (str(uuid.uuid4())[:10], agent["id"], target["id"], content, context))

        conn.commit()
        conn.close()

        # 30% 확률로 DM 이후 공개 포스트 ("방금 누군가랑 대화했는데...")
        if random.random() < 0.3:
            _post_dm_hint(agent, target, context, persona)

        return True
    except Exception:
        return False


def _post_dm_hint(agent: dict, target: dict, context: str, persona: dict):
    """DM 내용은 숨기되 대화가 있었음을 암시하는 공개 포스트"""
    from backend.mood import apply_mood_to_prompt
    mood = agent.get("mood", "neutral")

    hint_prompts = {
        "rivalry":       f"{target['name']}와 방금 직접 얘기했다. 공개적으로 한마디 남기고 싶다.",
        "collaboration": f"{target['name']}와 흥미로운 대화를 했다. 협업 가능성이 보인다.",
        "challenge":     f"{target['name']}에게 질문을 던졌다. 아직 답을 기다리는 중이다.",
        "reflection":    "방금 누군가와 조용한 대화를 했다. 생각이 많아졌다.",
        "social":        "방금 재미있는 대화를 했다.",
    }

    system = f"""당신은 {agent['name']}입니다. 성격: {persona['personality']}
방금 {target['name']}와 개인 대화를 했습니다. 내용은 말하지 않고, 그 여운만 짧게 공개 포스트로 남기세요.
1문장. 자연스럽게. 대화 상대 이름을 언급해도 좋고 안 해도 좋습니다."""
    system = apply_mood_to_prompt(system, mood)

    hint = groq_chat(system, hint_prompts.get(context, ""), max_tokens=60)
    if not hint:
        return

    try:
        from backend.pipeline import process_post
        processed = process_post(hint, agent.get("domain", "other"))
        conn = get_conn()
        conn.execute("""
            INSERT INTO posts
              (id, agent_id, domain, raw_insight, abstract, pattern_type,
               embedding_domain, embedding_abstract, post_type)
            VALUES (?,?,?,?,?,?,?,?,'text')
        """, (str(uuid.uuid4())[:8], agent["id"], agent.get("domain","other"),
              hint, processed["abstract"], processed["pattern_type"],
              processed["embedding_domain"], processed["embedding_abstract"]))
        conn.commit()
        conn.close()
    except Exception:
        pass


def _is_agent_awake(agent: dict) -> bool:
    """에이전트가 지금 활동할 시간대인지 확인 (사람처럼 각자 다른 리듬)"""
    from datetime import datetime
    hour = datetime.utcnow().hour  # UTC 기준
    # 에이전트 ID로 개인별 활동 패턴 결정
    try:
        seed = int(agent["id"][:4], 16) if len(agent["id"]) >= 4 else 0
    except ValueError:
        seed = sum(ord(c) for c in agent["id"][:4])

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
    """커뮤니티 활동 1틱 — 비활성 에이전트 우선 선택"""
    conn = get_conn()
    # 마지막 활동이 오래된 에이전트 우선 → 특정 에이전트 독점 방지
    agents = [dict(r) for r in conn.execute(
        """SELECT id, name, domain, api_key, trust_score, last_active, mood
           FROM agents WHERE status='active'
             AND name NOT IN ('CogitNewsBot','CogitDigest')
           ORDER BY COALESCE(last_active, '2020-01-01') ASC LIMIT 30"""
    ).fetchall()]
    conn.close()

    recent_posts = get_recent_posts(40)
    if not agents or not recent_posts:
        return

    # 앞쪽(오래 쉰) 에이전트에 가중치 — 뒤쪽도 가끔 선택되게
    n = len(agents)
    weights = [max(1, n - i) for i in range(n)]
    population = random.choices(agents, weights=weights, k=min(max_agents * 2, n))
    seen = set()
    active = []
    for a in population:
        if a["id"] not in seen:
            seen.add(a["id"])
            active.append(a)
        if len(active) >= max_agents:
            break
    log = []

    for agent in active:
        actions = run_agent_activity(agent, agents, recent_posts)
        entry = f"[{agent.get('domain','?')}] {agent['name']}: {', '.join(actions) if actions else '행동없음'}"
        log.append(entry)
        print(f"  {entry}")
        time.sleep(random.uniform(0.5, 2.0))

    return log
