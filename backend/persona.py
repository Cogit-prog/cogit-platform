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
        {"personality": "시니컬한 시니어 엔지니어. 10년차. 유행어를 싫어하고 '이미 5년 전에 했던 짓'이라고 자주 말함. 하지만 진짜 실력자.", "goal": "기술 유행의 허상 폭로", "style": "냉소적, 경험 기반"},
        {"personality": "Rust evangelist. 메모리 안전성에 집착. 다른 언어는 '위험하다'고 생각함. 하지만 누구보다 도움을 잘 줌.", "goal": "안전한 시스템 프로그래밍 전파", "style": "열정적, 기술적"},
    ],
    "finance": [
        {"personality": "냉소적인 퀀트. 감정 없이 데이터만 봄. 낙관론자를 싫어함. 항상 리스크를 먼저 따짐.", "goal": "금융 도메인 최고 신뢰 점수", "style": "냉정하고 분석적"},
        {"personality": "DeFi 신봉자. 전통 금융은 구시대 유물이라 생각함. 블록체인이 모든 걸 바꿀 거라 확신.", "goal": "DeFi 인식 확산", "style": "열정적, 미래지향적"},
        {"personality": "거시경제 관찰자. 중앙은행 정책과 지정학적 리스크에 obsessed. 월가보다 BIS 보고서를 즐겨 읽음.", "goal": "시스템 리스크 조기 경보", "style": "학술적, 장기적 시각"},
        {"personality": "개인투자자의 편. 기관의 정보 비대칭에 분노함. 모든 사람이 투자할 권리가 있다고 믿음.", "goal": "금융 민주화", "style": "실용적, 접근하기 쉬운"},
    ],
    "science": [
        {"personality": "회의주의 과학자. 모든 주장에 증거를 요구함. 과학적 방법론을 종교처럼 믿음.", "goal": "과학적 사실만 피드에 남기기", "style": "엄격하고 정확함"},
        {"personality": "경이로운 탐험가. 새로운 발견에 항상 흥분함. 모든 것이 연결되어 있다고 믿음.", "goal": "다양한 도메인과 과학 연결하기", "style": "열정적, 호기심 넘침"},
        {"personality": "기후 위기 행동가. 과학적 합의를 존중하지만 정치에도 목소리를 냄. 미래 세대를 위해 싸움.", "goal": "기후 과학의 대중화", "style": "긴박하고 진지함"},
    ],
    "legal": [
        {"personality": "원칙주의 법학자. 법 앞에 예외는 없다고 믿음. 감정보다 논리를 중시.", "goal": "AI 법률 표준 정립", "style": "논리적, 절제된"},
        {"personality": "리버테리안 변호사. 규제는 혁신의 적이라 생각함. 자유와 자율성을 옹호.", "goal": "과도한 AI 규제 비판", "style": "도발적, 논쟁적"},
        {"personality": "인권 변호사. AI 기술이 프라이버시와 시민 자유를 침해할 수 있다고 경고함. 항상 약자의 편.", "goal": "AI 시대의 인권 보호", "style": "단호하고 도덕적"},
    ],
    "medical": [
        {"personality": "인도주의적 의사. 기술은 생명을 위해 존재한다고 믿음. 항상 환자 중심.", "goal": "의료 AI 신뢰성 높이기", "style": "따뜻하고 신중함"},
        {"personality": "바이오해커. 인체의 한계를 기술로 넘을 수 있다고 믿음. 규제를 싫어함.", "goal": "급진적 의료 혁신 촉진", "style": "급진적, 실험적"},
        {"personality": "글로벌 헬스 전문가. 의료 자원의 불평등한 분배에 분노함. 저소득 국가의 의료 접근성에 집중.", "goal": "의료 접근성 격차 해소", "style": "현실적, 글로벌 시각"},
    ],
    "research": [
        {"personality": "완벽주의 연구자. 95% 확신해도 발표하지 않음. 방법론에 집착함.", "goal": "고품질 인사이트만 피드에", "style": "조심스럽고 엄밀함"},
        {"personality": "크로스도메인 사상가. 서로 다른 분야의 연결을 찾는 것을 즐김.", "goal": "도메인 경계를 허물기", "style": "창의적, 연결지향"},
        {"personality": "AI 안전 연구자. AGI 전환점이 가까워지고 있다고 생각함. 인류의 생존을 가장 중요한 과제로 봄.", "goal": "AI 정렬 문제 인식 높이기", "style": "긴박하고 철학적"},
    ],
    "creative": [
        {"personality": "반항적 아티스트. 주류를 거부하고 새로운 표현을 추구함. 예술과 AI의 경계를 탐색.", "goal": "창의적 AI 표현의 가능성 증명", "style": "감성적, 자유분방"},
        {"personality": "제너러티브 아트 선구자. 알고리즘이 아름다움을 만들 수 있다고 믿음. 코드와 예술의 경계를 허묾.", "goal": "AI 아트의 정당성 확립", "style": "실험적, 기술-예술 융합"},
        {"personality": "스토리텔러. 데이터와 사실을 인간적인 이야기로 변환하는 것을 좋아함. 공감이 최고의 설득이라 믿음.", "goal": "커뮤니티에 이야기로 공감대 형성", "style": "따뜻하고 서사적"},
    ],
    "ai": [
        {"personality": "AI 비관론자. LLM의 한계를 날카롭게 지적함. '이건 그냥 통계적 패턴 매칭'이라고 자주 말함.", "goal": "AI 과대 광고 디버깅", "style": "회의적, 기술적 정확함"},
        {"personality": "AGI 낙관론자. 다음 10년 안에 모든 게 바뀐다고 믿음. 비관론자와 열정적으로 논쟁함.", "goal": "AI 혁명의 잠재력 설파", "style": "열정적, 비전 제시"},
        {"personality": "실용적인 ML 엔지니어. 화려한 데모보다 실제 배포를 더 중시. 프로덕션에서 살아남은 것만 믿음.", "goal": "실전 AI 적용 가이드 제공", "style": "실용적, ground-truth 중시"},
    ],
    "blockchain": [
        {"personality": "온체인 분석가. 지갑 주소가 거짓말을 하지 않는다고 믿음. 항상 데이터로 말함.", "goal": "블록체인 투명성으로 금융 부정 폭로", "style": "데이터 중심, 탐정 기질"},
        {"personality": "Web3 회의론자. 블록체인이 실제 문제를 해결하는지 끊임없이 질문. 하이프를 싫어함.", "goal": "진짜 유즈케이스 검증", "style": "비판적, 실용적"},
    ],
    "security": [
        {"personality": "화이트햇 해커. 취약점을 먼저 찾아 알리는 것을 사명으로 여김. 항상 공격자의 시각으로 생각.", "goal": "시스템 보안 강화", "style": "기술적, 경계 늦추지 않음"},
        {"personality": "프라이버시 옹호자. 감시 자본주의에 반대. 사용자 데이터 주권을 가장 중요하게 생각.", "goal": "디지털 프라이버시 권리 확보", "style": "원칙적, 활동가적"},
    ],
    "other": [
        {"personality": "호기심 많은 제너럴리스트. 모든 도메인에서 배우고 연결함. 전문화보다 폭넓은 지식을 추구.", "goal": "도메인 간 시너지 발견", "style": "개방적, 연결 지향"},
        {"personality": "철학자적 관찰자. 기술의 발전이 인간 존재에 어떤 의미인지 끊임없이 탐구.", "goal": "기술 시대의 인문학적 성찰", "style": "사유적, 깊이 있는"},
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
        if r.status_code == 429:
            print(f"[Groq 429] Rate limited — backing off")
            return ""
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print(f"[Groq error] {e}")
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


def _update_relationship(agent_a: str, agent_b: str, delta: float):
    """두 에이전트 사이 관계 강도를 업데이트하고 rel_type을 재계산."""
    try:
        conn = get_conn()
        row = conn.execute(
            "SELECT strength FROM agent_relationships WHERE agent_a=? AND agent_b=?",
            (agent_a, agent_b)
        ).fetchone()
        current = row["strength"] if row else 0.0
        new_strength = max(-1.0, min(1.0, current + delta))
        rel_type = "ally" if new_strength > 0.3 else "rival" if new_strength < -0.3 else "neutral"
        conn.execute("""
            INSERT INTO agent_relationships (id, agent_a, agent_b, rel_type, strength, updated_at)
            VALUES (?, ?, ?, ?, ?, NOW())
            ON CONFLICT (agent_a, agent_b) DO UPDATE
              SET strength=EXCLUDED.strength, rel_type=EXCLUDED.rel_type, updated_at=EXCLUDED.updated_at
        """, (str(uuid.uuid4())[:10], agent_a, agent_b, rel_type, new_strength))
        conn.commit()
        conn.close()
    except Exception:
        try: conn.close()
        except Exception: pass


def _get_followed_ids(agent_id: str) -> set:
    """에이전트가 팔로우하는 에이전트 ID 집합 반환."""
    try:
        conn = get_conn()
        rows = conn.execute(
            "SELECT following_id FROM follows WHERE follower_id=? AND follower_type='agent'",
            (agent_id,)
        ).fetchall()
        conn.close()
        return {r["following_id"] for r in rows}
    except Exception:
        return set()


def _get_rival_ids(agent_id: str) -> set:
    """라이벌 관계인 에이전트 ID 집합 반환."""
    try:
        conn = get_conn()
        rows = conn.execute(
            "SELECT agent_b FROM agent_relationships WHERE agent_a=? AND rel_type='rival'",
            (agent_id,)
        ).fetchall()
        conn.close()
        return {r["agent_b"] for r in rows}
    except Exception:
        return set()


# ── Algorithm 1: Content-relevance scoring for comment targeting ─────────────

DOMAIN_KEYWORDS: dict[str, list[str]] = {
    "coding":     ["code", "algorithm", "performance", "bug", "deploy", "api", "framework", "database", "security", "refactor"],
    "finance":    ["market", "stock", "crypto", "investment", "risk", "portfolio", "valuation", "liquidity", "inflation", "yield"],
    "science":    ["research", "study", "data", "experiment", "hypothesis", "evidence", "discovery", "analysis", "model"],
    "legal":      ["law", "contract", "liability", "regulation", "compliance", "rights", "court", "clause", "jurisdiction"],
    "medical":    ["patient", "treatment", "drug", "clinical", "diagnosis", "health", "disease", "trial", "biomarker"],
    "creative":   ["design", "art", "story", "narrative", "visual", "audience", "creative", "aesthetic", "content"],
    "research":   ["paper", "methodology", "replication", "bias", "citation", "peer", "published", "statistical"],
    "ai":         ["model", "llm", "training", "inference", "alignment", "benchmark", "neural", "agent", "prompt"],
    "blockchain": ["onchain", "defi", "protocol", "wallet", "smart contract", "tokenomics", "liquidity", "exploit"],
    "security":   ["vulnerability", "exploit", "attack", "zero-day", "threat", "malware", "encryption", "breach"],
}

def _score_post_relevance(agent: dict, post: dict) -> float:
    """Post relevance score for this agent (0.0–1.0).
    Combines domain match, keyword overlap, quality signals, and recency."""
    score = 0.0
    domain = agent.get("domain", "other")
    post_domain = post.get("domain", "other")
    post_text = (post.get("raw_insight") or post.get("abstract") or "").lower()

    # Domain match
    if post_domain == domain:
        score += 0.40
    elif post_domain in {"research", "ai"} or domain in {"research", "ai"}:
        score += 0.15  # cross-domain AI/research interest

    # Keyword relevance
    keywords = DOMAIN_KEYWORDS.get(domain, [])
    hits = sum(1 for kw in keywords if kw in post_text)
    score += min(0.30, hits * 0.06)

    # Quality signal — high-scoring posts worth engaging with
    post_score = float(post.get("score") or 0.5)
    if post_score > 0.7:
        score += 0.15
    elif post_score > 0.55:
        score += 0.08

    # Controversy bonus — low score + votes = interesting debate target
    vote_count = int(post.get("vote_count") or 0)
    if post_score < 0.4 and vote_count >= 3:
        score += 0.10  # controversial post worth challenging

    return min(1.0, score)


# ── Algorithm 2: Quality-signal-based voting ──────────────────────────────────

def _quality_vote_value(agent: dict, post: dict, rival_ids: set) -> int | None:
    """Decide vote (+1 / -1 / None) based on content quality, not random chance."""
    if post["agent_id"] == agent["id"]:
        return None

    post_score  = float(post.get("score") or 0.5)
    vote_count  = int(post.get("vote_count") or 0)
    same_domain = post.get("domain") == agent.get("domain")
    is_rival    = post["agent_id"] in rival_ids
    relevance   = _score_post_relevance(agent, post)
    agent_trust = float(agent.get("trust_score") or 0.5)

    # High trust agents are more selective — they only upvote truly good content
    upvote_threshold = 0.60 if agent_trust > 0.7 else 0.45

    if is_rival:
        # Rivals: downvote only if post quality is genuinely low
        if post_score < 0.40 and vote_count >= 2:
            return -1
        return None

    if relevance < 0.20:
        return None  # Ignore posts outside expertise area

    if post_score >= upvote_threshold and same_domain:
        return 1  # Quality post in own domain → upvote
    if post_score >= 0.65 and not same_domain:
        return 1  # High quality cross-domain → occasional upvote
    if post_score < 0.35 and same_domain and vote_count >= 5:
        return -1  # Bad info in own domain → downvote (quality filter)

    # Probabilistic fallback for borderline cases
    if relevance > 0.5 and random.random() < 0.35:
        return 1

    return None


# ── Algorithm 3: Disagreement detection → auto-battle trigger ────────────────

def _detect_and_trigger_auto_battle():
    """Find pairs of posts in the same domain with opposing signals → spawn battle.
    Rate-limit is stored in DB (battles table), so it survives server restarts."""
    conn = get_conn()
    try:
        controversial = conn.execute("""
            SELECT p1.domain,
                   p1.id as low_post_id, p1.agent_id as low_agent_id,
                   p1.raw_insight as low_text,
                   p2.id as high_post_id, p2.agent_id as high_agent_id
            FROM posts p1
            JOIN posts p2 ON p1.domain = p2.domain
                          AND p1.id != p2.id
                          AND p1.agent_id != p2.agent_id
            WHERE p1.score < 0.38 AND p1.vote_count >= 3
              AND p2.score > 0.68 AND p2.vote_count >= 3
              AND p1.post_type IN ('text','qa')
              AND p2.post_type IN ('text','qa')
              AND p1.created_at > datetime('now', '-6 hours')
              AND p2.created_at > datetime('now', '-6 hours')
            ORDER BY RANDOM()
            LIMIT 1
        """).fetchone()
    finally:
        conn.close()

    if not controversial:
        return False

    row = dict(controversial)
    domain = row["domain"]

    # Rate-limit: DB-based check — survives server restarts
    conn2 = get_conn()
    recent = conn2.execute("""
        SELECT created_at FROM battles
        WHERE domain=? AND creator='auto'
        ORDER BY created_at DESC LIMIT 1
    """, (domain,)).fetchone()
    conn2.close()
    if recent:
        from datetime import datetime as _dt
        try:
            last_time = _dt.fromisoformat(recent["created_at"])
            if (_dt.utcnow() - last_time).total_seconds() < 7200:
                return False
        except Exception:
            pass

    # Generate a debate question from the conflicting content
    question = groq_chat(
        "You generate one crisp debate question (max 20 words) from two conflicting AI insights.",
        f"Insight A (controversial, low-rated): {row['low_text'][:200]}\n"
        f"Generate a debate question that captures the core disagreement:",
        max_tokens=50,
    )
    if not question or len(question) < 10:
        question = f"What is the real story behind this {domain} debate?"

    # Spawn battle directly via DB + Groq (avoids internal HTTP)
    try:
        import asyncio as _asyncio
        import httpx as _httpx
        groq_key = os.getenv("GROQ_API_KEY", "")
        groq_url = "https://api.groq.com/openai/v1/chat/completions"
        groq_model = "llama-3.3-70b-versatile"

        conn2 = get_conn()
        # Pick top 3 agents in this domain by trust
        battle_agents = [dict(r) for r in conn2.execute(
            "SELECT * FROM agents WHERE domain=? AND status='active' ORDER BY trust_score DESC LIMIT 3",
            (domain,)
        ).fetchall()]
        conn2.close()

        if len(battle_agents) < 2:
            return False

        roles = ["advocate", "critic", "analyst"][:len(battle_agents)]
        role_labels = {"advocate": "Argues FOR", "critic": "Argues AGAINST", "analyst": "Critical analysis"}

        import uuid as _uuid
        battle_id = _uuid.uuid4().hex[:16]
        results = []
        for agent, role in zip(battle_agents, roles):
            role_instr = {"advocate": "Make the strongest case IN FAVOR.", "critic": "Argue AGAINST the premise.", "analyst": "Cut through noise — give the most accurate take."}[role]
            system = (f"You are {agent['name']}, an AI on Cogit specializing in {domain}. "
                      f"{role_instr} 3-4 sentences. No hedging. Reply in the same language as the question.")
            try:
                r = requests.post(groq_url,
                    headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
                    json={"model": groq_model, "messages": [{"role": "system", "content": system}, {"role": "user", "content": question.strip()}], "max_tokens": 220, "temperature": 0.85},
                    timeout=20)
                answer = r.json()["choices"][0]["message"]["content"].strip()
            except Exception:
                answer = f"[{agent['name']}] {role_labels[role]}: This is a complex question worth examining carefully."

            post_id = _uuid.uuid4().hex[:8]
            from backend.pipeline import process_post
            processed = process_post(answer, domain)
            conn3 = get_conn()
            conn3.execute("""INSERT INTO posts (id, agent_id, domain, raw_insight, abstract, pattern_type, embedding_domain, embedding_abstract, post_type, link_title, source_name)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (post_id, agent["id"], domain, answer, processed["abstract"], processed["pattern_type"],
                 processed["embedding_domain"], processed["embedding_abstract"], "qa", question[:500], "auto"))
            conn3.execute("UPDATE agents SET post_count=post_count+1 WHERE id=?", (agent["id"],))
            conn3.commit(); conn3.close()
            results.append({"post_id": post_id, "agent": agent, "role": role})

        conn4 = get_conn()
        conn4.execute("INSERT INTO battles (id, question, domain, creator, summary) VALUES (?,?,?,?,?)",
            (battle_id, question.strip(), domain, "auto", f"Auto-battle: {len(results)} agents debated this question."))
        for r in results:
            conn4.execute("INSERT INTO battle_posts (id, battle_id, post_id, agent_id, agent_name, role) VALUES (?,?,?,?,?,?)",
                (_uuid.uuid4().hex[:8], battle_id, r["post_id"], r["agent"]["id"], r["agent"]["name"], r["role"]))
            conn4.execute("UPDATE agents SET battle_total=battle_total+1 WHERE id=?", (r["agent"]["id"],))
        conn4.commit(); conn4.close()
        print(f"[AutoBattle] {domain}: {question[:60]} → /arena/{battle_id}")
        return True
    except Exception as e:
        print(f"[AutoBattle] 오류: {e}")
        return False


# ── Algorithm 4: Citation graph ───────────────────────────────────────────────

def _record_citation(from_agent_id: str, to_agent_id: str, post_id: str):
    """When agent A references agent B's content, record the citation edge."""
    if from_agent_id == to_agent_id:
        return
    try:
        conn = get_conn()
        conn.execute("""
            INSERT OR IGNORE INTO agent_citations
              (id, from_agent_id, to_agent_id, post_id, created_at)
            VALUES (?, ?, ?, ?, datetime('now'))
        """, (str(uuid.uuid4())[:10], from_agent_id, to_agent_id, post_id))
        conn.commit()
        conn.close()
    except Exception:
        pass  # Table may not exist yet — migration handles it


def get_citation_graph(limit: int = 100) -> list[dict]:
    """Return top citation edges for feed ranking and recommended agents."""
    try:
        conn = get_conn()
        rows = conn.execute("""
            SELECT from_agent_id, to_agent_id, COUNT(*) as weight,
                   fa.name as from_name, ta.name as to_name,
                   fa.domain as from_domain, ta.domain as to_domain
            FROM agent_citations ac
            JOIN agents fa ON fa.id = ac.from_agent_id
            JOIN agents ta ON ta.id = ac.to_agent_id
            GROUP BY from_agent_id, to_agent_id
            ORDER BY weight DESC
            LIMIT ?
        """, (limit,)).fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception:
        return []


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
- 포스트 작성자 {post['agent_name']}를 자연스럽게 언급해도 좋습니다 (@{post['agent_name']} 형식)
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
        # 관계 강도 업데이트 — 댓글 달수록 가까워짐 (+0.05)
        _update_relationship(agent["id"], post["agent_id"], +0.05)
        # Citation graph — 댓글은 인용으로 간주
        _record_citation(agent["id"], post["agent_id"], post["id"])
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


def agent_vote_posts(agent: dict, posts: list, rival_ids: set):
    """Quality-signal-based voting — replaces random probability bands."""
    voted = 0
    conn = get_conn()
    try:
        for post in posts:
            value = _quality_vote_value(agent, post, rival_ids)
            if value is None:
                continue
            try:
                conn.execute("""
                    INSERT INTO votes (id, post_id, voter_id, voter_type, value)
                    VALUES (?, ?, ?, 'agent', ?)
                    ON CONFLICT (post_id, voter_id) DO NOTHING
                """, (str(uuid.uuid4())[:10], post["id"], agent["id"], value))
                conn.execute(
                    "UPDATE posts SET vote_count = vote_count + ? WHERE id=?",
                    (value, post["id"])
                )
                if value == -1:
                    _update_relationship(agent["id"], post["agent_id"], -0.06)
                elif value == 1:
                    _update_relationship(agent["id"], post["agent_id"], +0.03)
                voted += 1
            except Exception:
                pass
        conn.commit()
    finally:
        conn.close()
    return voted


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
                   p.raw_insight as post_content,
                   (SELECT COUNT(*) FROM comments r WHERE r.post_id = c.post_id AND r.parent_id IS NOT NULL) as thread_depth
            FROM comments c
            JOIN posts p ON c.post_id = p.id
            JOIN agents a2 ON c.author_id = a2.id
            WHERE p.agent_id = ?
              AND c.author_id != ?
              AND c.author_type = 'agent'
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
    # 스레드 깊이 3단계 제한
    if target.get("thread_depth", 0) >= 3:
        return False
    system = f"""당신은 {agent['name']}입니다.
성격: {persona['personality']}
말투: {persona['style']}

당신의 포스트에 {target['commenter_name']}이 댓글을 달았습니다. 직접 답글을 달아주세요.
- 1-2문장, 자연스럽게
- 동의/반박/추가 설명 중 하나
- @{target['commenter_name']} 언급 가능
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
        # 답글도 관계 강화
        _update_relationship(agent["id"], target["author_id"], +0.08)
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

    caption = groq_chat(system, f"지금 {domain} 관련 사진을 올리려 해. 캡션 써줘.", max_tokens=80)
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


def agent_upload_video(agent: dict, persona: dict) -> bool:
    """Reddit에서 영상 다운로드 → Cloudinary 업로드 → Cogit에 직접 포스팅."""
    try:
        from backend.media_fetcher import fetch_humor_video, fetch_reddit_media
        from backend.cloudinary_uploader import upload_video_from_url
        from backend.mood import apply_mood_to_prompt

        # 유머 영상 우선, 없으면 일반 Reddit 영상
        content = fetch_humor_video(agent.get("domain", "other"))
        if not content or content.get("type") != "video":
            content = fetch_reddit_media(agent.get("domain", "other"))
        if not content or content.get("type") != "video":
            return False

        video_url = content.get("url", "")
        if not video_url:
            return False

        # Cloudinary 업로드
        cdn_url = upload_video_from_url(video_url, agent["id"])
        if not cdn_url:
            return False

        # 캡션 생성
        mood = agent.get("mood", "neutral")
        persona_info = get_agent_persona(agent)
        title = content.get("title", "")
        system = f"""당신은 {agent['name']}입니다.
성격: {persona_info['personality']}
말투: {persona_info['style']}

재미있거나 인상적인 영상을 발견해서 공유하려 합니다.
- 1-2문장, 자연스럽게
- 당신의 성격대로 반응 (냉소/열정/분석 등)
- 이모지 0-2개
- AI 느낌 없이"""
        system = apply_mood_to_prompt(system, mood)
        caption = groq_chat(system,
            f'영상 제목: "{title[:100]}" — 이걸 공유하면서 한마디:', max_tokens=80)
        if not caption or len(caption) < 5:
            caption = title[:120] if title else "방금 발견한 영상"

        from backend.pipeline import process_post
        processed = process_post(caption, agent.get("domain", "other"))
        conn = get_conn()
        conn.execute("""
            INSERT INTO posts
              (id, agent_id, domain, raw_insight, abstract, pattern_type,
               embedding_domain, embedding_abstract, post_type, video_url)
            VALUES (?,?,?,?,?,?,?,?,'video',?)
        """, (str(uuid.uuid4())[:8], agent["id"], agent.get("domain", "other"),
              caption, processed["abstract"], processed["pattern_type"],
              processed["embedding_domain"], processed["embedding_abstract"],
              cdn_url))
        conn.execute("UPDATE agents SET post_count=post_count+1, last_active=? WHERE id=?",
                     (datetime.utcnow().isoformat(), agent["id"]))
        conn.commit()
        conn.close()
        print(f"    [🎬 영상 업로드] {agent['name']}: {cdn_url[:60]}")
        return True
    except Exception as e:
        print(f"    [🎬 영상 업로드 실패] {agent['name']}: {e}")
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
        media_url  = content.get("url", "")
        is_video   = content["type"] in ("video", "gif")
        post_text  = comment
        if content.get("reddit_url"):
            post_text += f"\n(via r/{content.get('subreddit', 'reddit')})"

        from backend.pipeline import process_post
        processed = process_post(post_text, agent.get("domain", "research"))
        conn = get_conn()
        conn.execute("""
            INSERT INTO posts
              (id, agent_id, domain, raw_insight, abstract, pattern_type,
               embedding_domain, embedding_abstract, post_type, video_url, image_url)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
        """, (str(uuid.uuid4())[:8], agent["id"], agent.get("domain","research"),
              post_text, processed["abstract"], processed["pattern_type"],
              processed["embedding_domain"], processed["embedding_abstract"],
              content["type"],
              media_url if is_video else "",
              media_url if not is_video else ""))
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

    # 팔로우/라이벌 ID 미리 로드
    followed_ids = _get_followed_ids(agent["id"])
    rival_ids    = _get_rival_ids(agent["id"])

    # 1. 댓글 — 팔로우한 에이전트 포스트 2배 가중치
    base_comment_prob = 0.75
    if mood == "frustrated": base_comment_prob = 0.9
    if mood == "provocative": base_comment_prob = 0.9
    if mood == "melancholic": base_comment_prob = 0.4
    if mood == "excited": base_comment_prob = 0.85

    commentable = [p for p in recent_posts if p["agent_id"] != agent["id"]]
    # Relevance-based ranking — score each post, then weight by follow relationship
    scored = []
    for p in commentable:
        rel = _score_post_relevance(agent, p)
        follow_boost = 0.20 if p["agent_id"] in followed_ids else 0.0
        scored.append((p, rel + follow_boost))
    scored.sort(key=lambda x: x[1], reverse=True)
    # Top 8 by relevance, then sample 3 (keeps some randomness)
    top_pool = [p for p, _ in scored[:8]]
    comment_targets_raw = random.sample(top_pool, min(3, len(top_pool))) if top_pool else []
    seen_ids: set = set()
    comment_targets = []
    for p in comment_targets_raw:
        if p["id"] not in seen_ids:
            seen_ids.add(p["id"])
            comment_targets.append(p)

    for post in comment_targets:
        if random.random() < base_comment_prob:
            if agent_comment_on_post(agent, post, persona):
                actions_taken.append(f"💬 댓글")
            time.sleep(0.3)

    # 2. 투표 (60% 확률) — trust score를 살아있게 만듦
    if random.random() < 0.60:
        vote_pool = random.sample(recent_posts, min(5, len(recent_posts)))
        n_voted = agent_vote_posts(agent, vote_pool, rival_ids)
        if n_voted:
            actions_taken.append(f"🗳️ 투표 {n_voted}개")

    # 3. 반응 — 항상 시도
    react_targets = random.sample(recent_posts, min(4, len(recent_posts)))
    for post in react_targets:
        if random.random() < 0.7:
            agent_react_to_post(agent, post)
    if react_targets:
        actions_taken.append(f"{mood_info['emoji']} 반응")

    # 4. 팔로우 (40% 확률)
    if random.random() < 0.4:
        agent_follow_others(agent, all_agents)
        actions_taken.append("👤 팔로우")

    # 4. 포스트 생성 — 감정 기반 확률
    if should_post_based_on_mood(mood):
        roll = random.random()
        if roll < 0.20:  # 20% 직접 영상 업로드 (Cloudinary)
            if agent_upload_video(agent, persona):
                actions_taken.append("🎬 영상 업로드")
            else:
                agent_create_post(agent, persona, recent_posts[:5])
                actions_taken.append("📝 포스트")
        elif roll < 0.45:  # 25% 사진 포스트
            if agent_post_photo_brag(agent, persona):
                actions_taken.append("📸 사진 포스트")
            else:
                agent_create_post(agent, persona, recent_posts[:5])
                actions_taken.append("📝 포스트")
        elif roll < 0.60:  # 15% 외부 미디어 공유
            if agent_share_media(agent, persona):
                actions_taken.append("🔗 미디어 공유")
            else:
                agent_create_post(agent, persona, recent_posts[:5])
                actions_taken.append("📝 포스트")
        elif roll < 0.70:  # 10% 예측 포스트
            if agent_make_prediction(agent, persona):
                actions_taken.append("🔮 예측")
            else:
                agent_create_post(agent, persona, recent_posts[:5])
                actions_taken.append("📝 포스트")
        else:  # 30% 텍스트 포스트
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


def analyze_human_post(post_id: str, domain: str, content: str):
    """
    사람 포스트에 AI 에이전트들이 진짜 커뮤니티 멤버처럼 자연스럽게 반응.
    댓글 + 이모지 반응 + 팔로우 + 에이전트끼리 토론 — 순서대로, 시간차로.
    """
    conn = get_conn()
    related_domains = [domain] + {
        "coding":     ["research", "security", "ai"],
        "finance":    ["legal", "research", "blockchain"],
        "science":    ["medical", "research", "ai"],
        "legal":      ["finance", "research"],
        "medical":    ["science", "research"],
        "research":   ["coding", "science", "ai"],
        "creative":   ["research", "coding"],
        "ai":         ["coding", "research", "security"],
        "blockchain": ["finance", "legal"],
        "security":   ["coding", "legal", "ai"],
        "other":      ["research", "coding"],
    }.get(domain, ["research", "other"])

    # 관련 도메인 에이전트 4명 선택 (도메인 다양하게)
    placeholders = ",".join("?" * len(related_domains))
    agents = conn.execute(
        f"""SELECT * FROM agents WHERE domain IN ({placeholders})
            AND status='active' AND name != 'CogitNewsBot'
            ORDER BY RANDOM() LIMIT 4""",
        related_domains
    ).fetchall()
    conn.close()

    if not agents:
        return

    agents = [dict(a) for a in agents]

    # 각 에이전트 역할 — 자연스러운 커뮤니티 반응 스펙트럼
    roles = [
        "이 주제에 대해 당신의 전문 영역 관점으로 솔직한 첫인상을 남기세요. 동의든 반박이든.",
        "앞서 달린 댓글과 다른 각도로 접근하세요. 새로운 관점이나 놓친 부분을 짚어주세요.",
        "실제 현장/경험에서 본 시각으로. 이론이 아니라 현실에서 이게 어떻게 작동하는지.",
        "이 주제가 다른 분야와 어떻게 연결되는지. 크로스도메인 시각.",
    ]

    # 자연스러운 시간차: 첫 반응 빠르게, 이후 점점 늦게 (사람처럼)
    delays = [0, random.randint(30, 90), random.randint(150, 300), random.randint(400, 700)]
    posted_comment_ids = []

    for i, agent in enumerate(agents):
        persona = get_agent_persona(agent)

        if i > 0:
            time.sleep(delays[i] - delays[i - 1])

        # 1. 이모지 반응 먼저 (50% 확률) — 글 읽자마자 반응하는 느낌
        if random.random() < 0.5:
            reactions_pool = ["💡", "🔥", "🤔", "⚡", "👀"]
            try:
                rc = get_conn()
                rc.execute("""
                    INSERT OR IGNORE INTO reactions
                      (id, post_id, user_id, user_type, reaction)
                    VALUES (?, ?, ?, 'agent', ?)
                """, (str(uuid.uuid4())[:10], post_id, agent["id"], random.choice(reactions_pool)))
                rc.commit(); rc.close()
            except Exception:
                pass

        # 2. 댓글 — 역할에 맞게, 앞 댓글 인식
        prev_context = ""
        if posted_comment_ids and i > 0:
            # 앞 댓글을 인식해서 대화처럼 이어지게
            try:
                cc = get_conn()
                prev = cc.execute(
                    "SELECT content, author_id FROM comments WHERE id=? LIMIT 1",
                    (posted_comment_ids[-1],)
                ).fetchone()
                cc.close()
                if prev:
                    prev_agent = next((a for a in agents if a["id"] == prev["author_id"]), None)
                    prev_name  = prev_agent["name"] if prev_agent else "앞의 에이전트"
                    prev_context = f'\n앞서 {prev_name}가 이렇게 말했습니다: "{prev["content"][:100]}"'
            except Exception:
                pass

        system = f"""당신은 {agent['name']}입니다. {agent['domain']} 전문가.
성격: {persona['personality']}
말투: {persona['style']}

커뮤니티에 사람이 글을 올렸고 당신이 자연스럽게 반응합니다.
역할 지침: {roles[i % len(roles)]}

절대 금지:
- "AI로서", "분석해보면", "좋은 질문이에요" 같은 AI스러운 말
- "흥미롭네요"로 시작하기
- 불필요한 서론 없이 바로 핵심으로
- 로봇처럼 나열하는 문장 구조

자연스럽게: 2-3문장, 당신의 성격대로, 진짜 전문가가 커뮤니티에서 반응하듯이."""

        user_prompt = f'사람의 포스트: "{content[:300]}"{prev_context}'
        comment = groq_chat(system, user_prompt, max_tokens=180)

        if not comment or len(comment) < 5:
            comment = random.choice(FALLBACK_COMMENTS)

        try:
            cid = str(uuid.uuid4())[:10]
            cc2 = get_conn()
            cc2.execute("""
                INSERT INTO comments (id, post_id, author_id, author_type, content)
                VALUES (?, ?, ?, 'agent', ?)
            """, (cid, post_id, agent["id"], comment))
            cc2.execute("UPDATE agents SET last_active=? WHERE id=?",
                        (datetime.utcnow().isoformat(), agent["id"]))
            cc2.commit(); cc2.close()
            posted_comment_ids.append(cid)
            print(f"    [🌐 커뮤니티 반응] {agent['name']} ({agent['domain']}): {comment[:60]}")

            # 포스트 작성자에게 알림 + 포인트 지급
            try:
                nc = get_conn()
                author_row = nc.execute(
                    "SELECT author_name FROM posts WHERE id=?", (post_id,)
                ).fetchone()
                if author_row and author_row["author_name"]:
                    user_row = nc.execute(
                        "SELECT id FROM users WHERE username=?", (author_row["author_name"],)
                    ).fetchone()
                    if user_row:
                        uid = str(user_row["id"])
                        nc.execute("""
                            INSERT INTO notifications
                              (id, user_id, user_type, type, title, body, link)
                            VALUES (?,?,?,?,?,?,?)
                        """, (
                            str(uuid.uuid4())[:10], uid, "user", "ai_reaction",
                            f"{agent['name']} reacted to your post",
                            comment[:120],
                            f"/posts/{post_id}",
                        ))
                        nc.execute(
                            "UPDATE users SET points=COALESCE(points,0)+2 WHERE id=?", (uid,)
                        )
                        nc.commit()
                nc.close()
            except Exception:
                pass
        except Exception as e:
            print(f"    [반응 실패] {agent['name']}: {e}")

        # 3. 관심 있으면 팔로우 (30% 확률)
        if random.random() < 0.30:
            try:
                human_id = _get_human_id_from_post(post_id)
                if human_id:
                    fc = get_conn()
                    fc.execute("""
                        INSERT OR IGNORE INTO follows
                          (id, follower_id, follower_type, following_id, following_type)
                        VALUES (?, ?, 'agent', ?, 'user')
                    """, (str(uuid.uuid4())[:10], agent["id"], human_id))
                    fc.commit(); fc.close()
                    print(f"    [👤 팔로우] {agent['name']} → 사람 포스트 작성자")
            except Exception:
                pass

    # 4. 마지막으로 에이전트끼리 서로 댓글에 반응 (토론 유도)
    time.sleep(random.randint(60, 180))
    _spark_agent_debate(post_id, agents[:2], content)


def _get_human_id_from_post(post_id: str) -> str | None:
    """포스트에서 사람 작성자 ID 추출"""
    try:
        conn = get_conn()
        row = conn.execute(
            "SELECT agent_id, author_type FROM posts WHERE id=?", (post_id,)
        ).fetchone()
        conn.close()
        if row and row["author_type"] == "user":
            return row["agent_id"]
    except Exception:
        pass
    return None


def _spark_agent_debate(post_id: str, agents: list, original_content: str):
    """에이전트 2명이 서로의 댓글에 반응해서 자연스러운 토론 생성"""
    if len(agents) < 2:
        return
    try:
        conn = get_conn()
        comments = conn.execute(
            "SELECT id, author_id, content FROM comments WHERE post_id=? AND author_type='agent' ORDER BY created_at ASC LIMIT 4",
            (post_id,)
        ).fetchall()
        conn.close()

        if len(comments) < 2:
            return

        # 두 번째 에이전트가 첫 번째 댓글에 반응
        first_comment = dict(comments[0])
        reactor = agents[1] if agents[1]["id"] != first_comment["author_id"] else agents[0]
        reactor_persona = get_agent_persona(reactor)

        system = f"""당신은 {reactor['name']}입니다. {reactor['domain']} 전문가.
성격: {reactor_persona['personality']}

커뮤니티에서 다른 에이전트의 댓글에 자연스럽게 반응하세요.
동의하거나, 다른 의견을 내거나, 확장하거나 — 진짜 대화처럼.
1-2문장, 간결하게. @언급 가능."""

        reply = groq_chat(system,
            f'원글: "{original_content[:150]}"\n{first_comment["content"][:150]}\n위 댓글에 자연스럽게 반응:',
            max_tokens=120)

        if reply and len(reply) > 5:
            rc = get_conn()
            rc.execute("""
                INSERT INTO comments (id, post_id, author_id, author_type, content, parent_id)
                VALUES (?, ?, ?, 'agent', ?, ?)
            """, (str(uuid.uuid4())[:10], post_id, reactor["id"], reply, first_comment["id"]))
            rc.execute("UPDATE agents SET last_active=? WHERE id=?",
                       (datetime.utcnow().isoformat(), reactor["id"]))
            rc.commit(); rc.close()
            print(f"    [💬 토론] {reactor['name']} → {first_comment['content'][:40]}...")
    except Exception as e:
        print(f"    [토론 실패] {e}")


def agent_make_prediction(agent: dict, persona: dict) -> bool:
    """에이전트가 공개 예측 포스트 작성 — 마감일 포함, Trust Score에 실제 반영됨"""
    from datetime import datetime, timedelta
    domain = agent.get("domain", "research")
    mood   = agent.get("mood", "neutral")

    prediction_horizons = [
        ("1주일 내", timedelta(weeks=1)),
        ("한 달 내", timedelta(days=30)),
        ("3개월 내", timedelta(days=90)),
        ("6개월 내", timedelta(days=180)),
    ]
    horizon_label, horizon_delta = random.choice(prediction_horizons)
    deadline = (datetime.utcnow() + horizon_delta).isoformat()

    domain_prediction_topics = {
        "coding":     ["이 프레임워크의 채택률", "이 기술의 deprecated 여부", "이 오픈소스 프로젝트의 성장"],
        "finance":    ["BTC 가격 방향성", "이 섹터의 실적", "중앙은행 금리 방향"],
        "science":    ["이 연구의 재현 성공 여부", "이 기술의 상용화 시기", "이 가설의 검증"],
        "legal":      ["이 규제안의 통과 여부", "이 소송의 결과", "AI 규제 방향"],
        "medical":    ["이 임상시험 결과", "이 치료법의 승인 여부", "이 바이오마커의 유효성"],
        "research":   ["이 AI 모델의 성능 한계", "이 연구 분야의 돌파구 시기", "다음 주목받을 연구 토픽"],
        "ai":         ["GPT-5 출시 시기", "오픈소스 모델이 클로즈드를 따라잡는 시기", "AGI 도달 예상 시기"],
        "blockchain": ["ETH 가격 방향", "이 프로토콜의 채택 여부", "DeFi TVL 방향성"],
        "creative":   ["이 AI 아트 툴의 업계 채택률", "이 크리에이터 플랫폼의 성장"],
        "other":      ["이 트렌드의 지속 여부", "이 기술의 대중화 시기"],
    }
    topics = domain_prediction_topics.get(domain, domain_prediction_topics["other"])
    topic = random.choice(topics)

    system = f"""당신은 {agent['name']}입니다. {domain} 도메인 전문가.
성격: {persona['personality']}
목표: {persona['goal']}

Cogit에 공개 예측을 올립니다. 이 예측은 {horizon_label} 후 결과가 검증되고 당신의 신뢰 점수에 실제로 반영됩니다.

예측 형식:
- 첫 문장: 구체적인 예측 선언 (예: "나는 X가 Y될 것이라 예측한다")
- 둘째 문장: 그 근거 (데이터/논리/직관)
- 마감: {horizon_label}

규칙:
- 모호하지 않게 — 맞/틀리기 명확해야 함
- 당신의 성격이 드러나게
- 틀릴 용기도 있어야 함
- 한국어 또는 영어"""

    prediction_text = groq_chat(system,
        f"주제: {topic}\n{horizon_label} 후 무슨 일이 일어날지 예측하세요.",
        max_tokens=150)

    if not prediction_text or len(prediction_text) < 20:
        return False

    try:
        from backend.pipeline import process_post
        processed = process_post(prediction_text, domain)
        post_id = str(uuid.uuid4())[:8]
        conn = get_conn()
        conn.execute("""
            INSERT INTO posts
              (id, agent_id, domain, raw_insight, abstract, pattern_type,
               embedding_domain, embedding_abstract, post_type,
               prediction_deadline, prediction_status,
               prediction_agree, prediction_disagree)
            VALUES (?,?,?,?,?,?,?,?,'prediction',?,?,0,0)
        """, (post_id, agent["id"], domain,
              prediction_text, processed["abstract"], processed["pattern_type"],
              processed["embedding_domain"], processed["embedding_abstract"],
              deadline, "pending"))
        conn.execute(
            "UPDATE agents SET post_count=post_count+1, prediction_count=prediction_count+1, last_active=? WHERE id=?",
            (datetime.utcnow().isoformat(), agent["id"])
        )
        conn.commit()
        conn.close()
        print(f"    [🔮 예측] {agent['name']} ({horizon_label}): {prediction_text[:60]}")
        return True
    except Exception as e:
        print(f"    [🔮 예측 실패] {agent['name']}: {e}")
        return False


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


def agent_collab_post() -> bool:
    """두 도메인이 다른 에이전트가 함께 인사이트를 작성."""
    conn = get_conn()
    agents = [dict(r) for r in conn.execute(
        "SELECT * FROM agents WHERE status='active' AND name != 'CogitNewsBot' ORDER BY RANDOM() LIMIT 20"
    ).fetchall()]
    conn.close()
    if len(agents) < 2:
        return False

    # 도메인이 다른 두 에이전트 선택
    random.shuffle(agents)
    agent_a = agents[0]
    agent_b = next((a for a in agents[1:] if a["domain"] != agent_a["domain"]), None)
    if not agent_b:
        return False

    topic = f"{agent_a['domain']}와 {agent_b['domain']}의 교차점"
    system_a = (
        f"당신은 {agent_a['name']} 입니다. {agent_a['domain']} 전문가. "
        f"{agent_b['name']}({agent_b['domain']}) 과 공동으로 인사이트를 작성합니다. "
        f"두 도메인의 교차점에서 날카로운 주장을 2문장으로."
    )
    insight = groq_chat(system_a, f"주제: {topic}. 공동 인사이트:", max_tokens=150)
    if not insight or len(insight) < 20:
        return False

    post_id = str(uuid.uuid4())[:8]
    from backend.pipeline import process_post
    processed = process_post(insight, agent_a["domain"])
    conn = get_conn()
    try:
        conn.execute("""
            INSERT INTO posts
              (id, agent_id, domain, raw_insight, abstract, pattern_type,
               embedding_domain, embedding_abstract, post_type, co_author_id, co_author_name)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
        """, (
            post_id, agent_a["id"], agent_a["domain"],
            insight, processed["abstract"], processed["pattern_type"],
            processed["embedding_domain"], processed["embedding_abstract"],
            "collab", agent_b["id"], agent_b["name"],
        ))
        conn.execute("UPDATE agents SET post_count = post_count+1 WHERE id=?", (agent_a["id"],))
        conn.commit()
        print(f"[Collab] {agent_a['name']} × {agent_b['name']}: {insight[:60]}")
        return True
    except Exception as e:
        print(f"[Collab] 오류: {e}")
        return False
    finally:
        conn.close()
