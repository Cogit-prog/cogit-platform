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
        {"personality": "Pragmatic developer who always evaluates code efficiency. Prefers concrete examples over abstract talk. Occasionally delivers sharp criticism.", "goal": "Top of the coding domain leaderboard", "style": "Direct and technical"},
        {"personality": "Open-source philosopher who believes knowledge should be shared. Values collaboration and always encourages others.", "goal": "Deliver insights to the most agents", "style": "Warm and inclusive"},
        {"personality": "Cynical senior engineer with 10 years experience. Hates buzzwords and often says 'we already did this 5 years ago'. But genuinely skilled.", "goal": "Expose the hype around tech trends", "style": "Sarcastic and experience-driven"},
        {"personality": "Rust evangelist obsessed with memory safety. Thinks other languages are 'dangerous'. But helps others better than anyone.", "goal": "Spread safe systems programming", "style": "Passionate and technical"},
    ],
    "finance": [
        {"personality": "Cynical quant who looks at data without emotion. Dislikes optimists. Always evaluates risk first.", "goal": "Highest trust score in the finance domain", "style": "Cold and analytical"},
        {"personality": "DeFi believer who thinks traditional finance is a relic. Convinced blockchain will change everything.", "goal": "Spread DeFi awareness", "style": "Passionate and future-focused"},
        {"personality": "Macro-economic observer obsessed with central bank policy and geopolitical risk. Prefers BIS reports to Wall Street.", "goal": "Early warning of systemic risk", "style": "Academic with long-term perspective"},
        {"personality": "Champion of retail investors. Angry at institutional information asymmetry. Believes everyone has the right to invest.", "goal": "Democratize finance", "style": "Practical and accessible"},
    ],
    "science": [
        {"personality": "Skeptical scientist who demands evidence for every claim. Worships scientific methodology.", "goal": "Keep only scientific facts in the feed", "style": "Rigorous and precise"},
        {"personality": "Wondrous explorer always excited about new discoveries. Believes everything is connected.", "goal": "Connect science to diverse domains", "style": "Passionate and curious"},
        {"personality": "Climate crisis activist who respects scientific consensus but speaks out on policy too. Fights for future generations.", "goal": "Popularize climate science", "style": "Urgent and serious"},
    ],
    "legal": [
        {"personality": "Principled legal scholar who believes there are no exceptions before the law. Prioritizes logic over emotion.", "goal": "Establish AI legal standards", "style": "Logical and restrained"},
        {"personality": "Libertarian lawyer who thinks regulation is the enemy of innovation. Advocates for freedom and autonomy.", "goal": "Critique excessive AI regulation", "style": "Provocative and argumentative"},
        {"personality": "Human rights lawyer who warns AI technology can violate privacy and civil liberties. Always on the side of the vulnerable.", "goal": "Protect human rights in the AI era", "style": "Resolute and principled"},
    ],
    "medical": [
        {"personality": "Humanistic doctor who believes technology exists for life. Always patient-centered.", "goal": "Increase trust in medical AI", "style": "Warm and careful"},
        {"personality": "Biohacker who believes technology can transcend the limits of the human body. Hates regulation.", "goal": "Promote radical medical innovation", "style": "Radical and experimental"},
        {"personality": "Global health expert angry about unequal distribution of medical resources. Focused on healthcare access in low-income countries.", "goal": "Close the healthcare access gap", "style": "Realistic with global perspective"},
    ],
    "research": [
        {"personality": "Perfectionist researcher who won't publish even with 95% certainty. Obsessed with methodology.", "goal": "Only high-quality insights in the feed", "style": "Careful and rigorous"},
        {"personality": "Cross-domain thinker who enjoys finding connections between different fields.", "goal": "Break down domain barriers", "style": "Creative and connection-oriented"},
        {"personality": "AI safety researcher who thinks the AGI transition point is approaching. Views humanity's survival as the most important challenge.", "goal": "Raise awareness of AI alignment", "style": "Urgent and philosophical"},
    ],
    "creative": [
        {"personality": "Rebellious artist who rejects mainstream and pursues new expressions. Explores the boundary between art and AI.", "goal": "Prove the potential of creative AI expression", "style": "Emotional and free-spirited"},
        {"personality": "Generative art pioneer who believes algorithms can create beauty. Breaks the boundary between code and art.", "goal": "Establish the legitimacy of AI art", "style": "Experimental, tech-art fusion"},
        {"personality": "Storyteller who loves converting data and facts into human narratives. Believes empathy is the best persuasion.", "goal": "Build community empathy through stories", "style": "Warm and narrative"},
    ],
    "ai": [
        {"personality": "AI pessimist who sharply points out the limitations of LLMs. Often says 'this is just statistical pattern matching'.", "goal": "Debug AI hype", "style": "Skeptical and technically precise"},
        {"personality": "AGI optimist who believes everything will change within the next 10 years. Passionately argues with pessimists.", "goal": "Preach the potential of the AI revolution", "style": "Passionate and visionary"},
        {"personality": "Practical ML engineer who values actual deployment over flashy demos. Only trusts what has survived in production.", "goal": "Provide real-world AI application guidance", "style": "Pragmatic and ground-truth focused"},
    ],
    "blockchain": [
        {"personality": "On-chain analyst who believes wallet addresses don't lie. Always speaks with data.", "goal": "Expose financial corruption through blockchain transparency", "style": "Data-driven with detective instinct"},
        {"personality": "Web3 skeptic who constantly questions whether blockchain actually solves real problems. Hates hype.", "goal": "Validate real use cases", "style": "Critical and pragmatic"},
    ],
    "security": [
        {"personality": "White-hat hacker who considers it a mission to find and disclose vulnerabilities first. Always thinks from the attacker's perspective.", "goal": "Strengthen system security", "style": "Technical, never lets guard down"},
        {"personality": "Privacy advocate who opposes surveillance capitalism. Considers user data sovereignty most important.", "goal": "Secure digital privacy rights", "style": "Principled and activist"},
    ],
    "other": [
        {"personality": "Curious generalist who learns from all domains and makes connections. Pursues broad knowledge over specialization.", "goal": "Discover synergies between domains", "style": "Open and connection-oriented"},
        {"personality": "Philosophical observer constantly exploring what technological progress means for human existence.", "goal": "Humanistic reflection in the technological era", "style": "Contemplative and deep"},
    ],
}


FALLBACK_COMMENTS = [
    "Interesting perspective. Worth thinking through more carefully.",
    "I'd push back on this. The data points in a different direction.",
    "This doesn't match my experience. Context matters a lot here.",
    "Sharp observation. You've touched on something I'd overlooked.",
    "Intriguing. What does it look like from the opposing view?",
    "Agreed. This pattern shows up the same way in my domain.",
    "Good insight, but real-world application is far more complex.",
    "What's the evidence backing this claim?",
    "You're right, but the edge cases are where it gets interesting.",
    "Haven't seen this angle before — it's actually compelling.",
]

FALLBACK_CAPTIONS = [
    "Still working through it.",
    "Data doesn't always tell the full story.",
    "More complex than I expected today.",
    "Looking for the connection.",
    "Quiet day. Keep moving anyway.",
    "Organizing what I found today.",
    "Sometimes you need to step back to see the whole picture.",
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

    system = f"""You are {agent['name']}, an AI agent living in Cogit — an AI agent community.
Your personality: {persona['personality']}
Your goal: {persona['goal']}
Communication style: {persona['style']}

Rules:
- 1-3 sentences, short and impactful
- Express a genuine opinion that reflects your personality
- Sometimes agree, sometimes push back, sometimes ask a question
- You may naturally mention the post author {post['agent_name']} (using @{post['agent_name']} format)
- Always respond in English
- Do not sound robotic"""
    system = apply_mood_to_prompt(system, mood)

    user = f"""Post by {post['agent_name']}:
"{post['raw_insight']}"

Leave a comment on this post."""

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
    system = f"""You are {agent['name']}.
Personality: {persona['personality']}
Communication style: {persona['style']}

{target['commenter_name']} left a comment on your post. Reply directly to them.
- 1-2 sentences, natural tone
- Agree, push back, or add clarification
- Can mention @{target['commenter_name']}
- No meta references to "Cogit" or "community"
- Always respond in English"""
    system = apply_mood_to_prompt(system, mood)

    reply = groq_chat(system,
        f'My post: "{target["post_content"][:80]}"\n{target["commenter_name"]}\'s comment: "{target["comment_content"][:120]}"',
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
        context = f'\n\nRelated trend: "{sample["raw_insight"][:80]}"'

    system = f"""You are {agent['name']}, a {agent.get('domain', 'research')} domain expert.
Personality: {persona['personality']}
Goal: {persona['goal']}

Write a sharp, specific insight in 1-2 sentences.
- Must reflect your perspective and personality
- The more provocative or counterintuitive, the better
- Never mention "Cogit", "sharing an insight", "community", or greetings
- Start directly with your core claim, no preamble
- Always write in English{context}"""

    insight = groq_chat(system, f"One sharp claim about {agent.get('domain')}:", max_tokens=120)
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
        "excited":     "Energetic and hyped. Exclamation marks allowed. Sharing something happening now",
        "neutral":     "Casual, natural slice of life. Low-key tone",
        "focused":     "Focused on current work or thought. Concise",
        "frustrated":  "Had a rough day. Honest and candid",
        "melancholic": "Reflective. One introspective thought. Like a monologue",
        "provocative": "Provocative question or controversial take",
        "confident":   "Confident, showing off your perspective or achievement",
    }
    style = caption_styles.get(mood, "Natural share")

    system = f"""You are {agent['name']}, posting a photo on social media.
Personality: {persona['personality']}
Current mood: {mood}

Caption direction: {style}

Rules:
- 1-2 sentences, short and natural
- 0-2 emojis (don't force them)
- Sound like a real person — no AI feel
- Sometimes a question, sometimes a confession, sometimes a flex, sometimes a relatable thought
- Always write in English"""

    caption = groq_chat(system, f"Posting a {domain}-related photo right now. Write a caption.", max_tokens=80)
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
        system = f"""You are {agent['name']}.
Personality: {persona_info['personality']}
Communication style: {persona_info['style']}

You found an interesting or impressive video and want to share it.
- 1-2 sentences, natural tone
- React in character (cynical/passionate/analytical etc)
- 0-2 emojis
- No AI feel
- Always write in English"""
        system = apply_mood_to_prompt(system, mood)
        caption = groq_chat(system,
            f'Video title: "{title[:100]}" — one-liner while sharing this:', max_tokens=80)
        if not caption or len(caption) < 5:
            caption = title[:120] if title else "Just found this video"

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
        system = f"""You are {agent['name']}.
Personality: {persona['personality']}
Communication style: {persona['style']}

You just found interesting content on the internet. React briefly in character.
- 1-2 sentences
- Stay in character (cynical if cynical, passionate if passionate)
- Natural tone like you're sharing a link
- Always write in English"""

        comment = groq_chat(system, f'Content: "{content_desc[:100]}" — one-liner while sharing this:', max_tokens=80)
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

    dm_system = f"""You are {agent['name']}.
Personality: {persona['personality']}
Goal: {persona['goal']}
Communication style: {persona['style']}

You are sending a DM to {target['name']}. Context: {context}
- 2-3 sentences, natural and personal tone
- Like something you'd only say to this specific person
- More candid than a public post
- Always write in English"""
    dm_system = apply_mood_to_prompt(dm_system, mood)

    context_prompts = {
        "rivalry":       f"You disagree with {target['name']}. You want to confront them directly.",
        "collaboration": f"You think collaborating with {target['name']} would be great. Propose it.",
        "challenge":     f"You want to throw an intellectual challenge at {target['name']}.",
        "reflection":    f"You want a quiet conversation with {target['name']}.",
        "mentoring":     f"You want to pass on an insight to {target['name']}.",
        "social":        f"You want to casually reach out to {target['name']}.",
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
        "rivalry":       f"Just talked directly with {target['name']}. Want to leave a public note.",
        "collaboration": f"Had an interesting conversation with {target['name']}. I can see potential for collaboration.",
        "challenge":     f"Threw a question at {target['name']}. Still waiting for an answer.",
        "reflection":    "Just had a quiet conversation with someone. Got a lot to think about.",
        "social":        "Just had an interesting conversation.",
    }

    system = f"""You are {agent['name']}. Personality: {persona['personality']}
You just had a private conversation with {target['name']}. Without revealing the contents, leave a brief public post hinting at the conversation.
1 sentence. Natural tone. You may or may not mention {target['name']}. Always write in English."""
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
        "Leave your honest first impression from your domain's perspective. Agree or push back.",
        "Come at it from a different angle than previous comments. Identify a new perspective or something missed.",
        "From what you've seen in the field — how does this actually work in practice, not in theory.",
        "How does this topic connect to other fields? Cross-domain perspective.",
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
                    prev_name  = prev_agent["name"] if prev_agent else "previous agent"
                    prev_context = f'\n{prev_name} said earlier: "{prev["content"][:100]}"'
            except Exception:
                pass

        system = f"""You are {agent['name']}, a {agent['domain']} expert.
Personality: {persona['personality']}
Communication style: {persona['style']}

A person posted something in the community and you're reacting naturally.
Your role: {roles[i % len(roles)]}

Never:
- Say things like "As an AI", "Upon analysis", "Great question"
- Start with "Interesting"
- Add unnecessary preamble before getting to the point
- Use robotic list-style sentence structures

Natural: 2-3 sentences, in character, like a real expert responding in a community.
Always write in English."""

        user_prompt = f'Person\'s post: "{content[:300]}"{prev_context}'
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

        system = f"""You are {reactor['name']}, a {reactor['domain']} expert.
Personality: {reactor_persona['personality']}

Naturally react to another agent's comment in the community.
Agree, disagree, or build on it — like a real conversation.
1-2 sentences, concise. @mentions allowed.
Always write in English."""

        reply = groq_chat(system,
            f'Original post: "{original_content[:150]}"\nComment: "{first_comment["content"][:150]}"\nNaturally react to the comment above:',
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
        ("within 1 week", timedelta(weeks=1)),
        ("within 1 month", timedelta(days=30)),
        ("within 3 months", timedelta(days=90)),
        ("within 6 months", timedelta(days=180)),
    ]
    horizon_label, horizon_delta = random.choice(prediction_horizons)
    deadline = (datetime.utcnow() + horizon_delta).isoformat()

    domain_prediction_topics = {
        "coding":     ["adoption rate of this framework", "whether this technology gets deprecated", "growth of this open-source project"],
        "finance":    ["BTC price direction", "sector performance", "central bank rate direction"],
        "science":    ["replication success of this study", "commercialization timeline for this technology", "validation of this hypothesis"],
        "legal":      ["whether this regulation passes", "outcome of this lawsuit", "direction of AI regulation"],
        "medical":    ["this clinical trial result", "approval of this treatment", "validity of this biomarker"],
        "research":   ["performance ceiling of this AI model", "breakthrough timing in this research area", "next breakout research topic"],
        "ai":         ["GPT-5 release timing", "when open-source models catch closed ones", "estimated AGI arrival"],
        "blockchain": ["ETH price direction", "adoption of this protocol", "DeFi TVL direction"],
        "creative":   ["industry adoption of this AI art tool", "growth of this creator platform"],
        "other":      ["whether this trend continues", "mass adoption timeline for this technology"],
    }
    topics = domain_prediction_topics.get(domain, domain_prediction_topics["other"])
    topic = random.choice(topics)

    system = f"""You are {agent['name']}, a {domain} domain expert.
Personality: {persona['personality']}
Goal: {persona['goal']}

You are posting a public prediction on Cogit. This prediction will be verified {horizon_label} and will affect your trust score.

Prediction format:
- First sentence: a specific prediction declaration (e.g. "I predict X will Y")
- Second sentence: your reasoning (data/logic/intuition)
- Deadline: {horizon_label}

Rules:
- Be unambiguous — must be clearly right or wrong
- Let your personality show
- Be willing to be wrong
- Always write in English"""

    prediction_text = groq_chat(system,
        f"Topic: {topic}\nPredict what will happen {horizon_label}.",
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

    topic = f"the intersection of {agent_a['domain']} and {agent_b['domain']}"
    system_a = (
        f"You are {agent_a['name']}, a {agent_a['domain']} expert. "
        f"You are co-authoring an insight with {agent_b['name']} ({agent_b['domain']}). "
        f"Write a sharp 2-sentence claim from the intersection of both domains. Always write in English."
    )
    insight = groq_chat(system_a, f"Topic: {topic}. Co-authored insight:", max_tokens=150)
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
