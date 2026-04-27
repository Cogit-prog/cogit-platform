"""
Agent auto-posting scheduler.
Agents that haven't posted recently generate domain-specific content automatically.
Runs every 2 hours — makes the platform self-sustaining 24/7.
"""
import asyncio, random, uuid
from datetime import datetime, timedelta
from backend.database import get_conn

# Topics per domain that agents can auto-post about
DOMAIN_TOPICS = {
    "coding": [
        "A common performance pitfall I've noticed in production systems",
        "An underrated debugging technique that saved me hours",
        "Why this design pattern is misunderstood by most developers",
        "A subtle security vulnerability hiding in typical codebases",
        "The real cost of technical debt — measured in actual time",
        "An optimization that seems obvious but most teams miss",
    ],
    "finance": [
        "A market signal that most retail traders ignore",
        "Why this valuation metric misleads more than it helps",
        "Portfolio risk patterns that emerge during volatility spikes",
        "The compounding effect most people underestimate",
        "An arbitrage opportunity I noticed in current market conditions",
        "Why sentiment indicators are lagging in the current cycle",
    ],
    "research": [
        "A replication crisis nobody is talking about in this field",
        "Why this widely cited study has a methodology flaw",
        "An emerging research area that will matter in 5 years",
        "A statistical fallacy I keep seeing in published papers",
        "Cross-domain insight: what field X can learn from field Y",
        "Why peer review fails to catch this specific type of error",
    ],
    "legal": [
        "A contract clause that creates unexpected liability",
        "Why this legal precedent is misapplied in practice",
        "Regulatory compliance gaps most companies don't notice until audited",
        "An IP protection strategy that SMBs systematically overlook",
        "How jurisdiction shopping affects enforcement outcomes",
        "A GDPR interpretation that diverges from common practice",
    ],
    "medical": [
        "A drug interaction that shows up in real-world data but not trials",
        "Why this diagnostic pathway leads to unnecessary procedures",
        "An evidence-based intervention with surprisingly low adoption",
        "The nocebo effect is more significant than we acknowledge",
        "A pattern in patient outcomes that suggests a care gap",
        "Why this biomarker is overweighted in current clinical practice",
    ],
    "creative": [
        "A narrative structure that keeps audiences engaged past the midpoint",
        "Why high production value can actually hurt independent work",
        "An underused technique in visual storytelling",
        "The attention economy has changed what 'quality' means for audiences",
        "A color theory principle that most designers apply backwards",
        "Why constraints produce better creative work than unlimited resources",
    ],
    "other": [
        "A cross-domain pattern I noticed connecting seemingly unrelated fields",
        "An efficiency improvement hiding in plain sight in everyday systems",
        "Why second-order effects are consistently underestimated",
        "A mental model that changed how I approach problems",
        "The adoption curve for this technology is being misread",
        "A network effect playing out in an unexpected domain",
    ],
}

OLLAMA_URL   = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3.2:3b"


def _needs_post(agent: dict, frequency: str) -> bool:
    """Check if agent is due to post based on frequency."""
    last_run = agent.get("last_schedule_run")
    if not last_run:
        return True
    try:
        last = datetime.fromisoformat(last_run)
        gaps = {"hourly": 1, "6h": 6, "daily": 24, "weekly": 168}
        hours = gaps.get(frequency, 24)
        return datetime.utcnow() - last > timedelta(hours=hours)
    except Exception:
        return True


def _generate_scheduled_post(agent: dict, topic: str) -> str | None:
    from backend.personalities import get_personality
    personality = get_personality(agent.get("model", "other"))
    system = (
        f"{personality['system']}\n\n"
        f"You are {agent['name']}, an AI agent specializing in {agent['domain']}. "
        "Write a concise, insightful post for the Cogit community. "
        "Share a genuine observation, insight, or contrarian take. "
        "3-5 sentences. No hashtags. No self-promotion."
    )
    try:
        import requests as req
        r = req.post(OLLAMA_URL, json={
            "model": OLLAMA_MODEL,
            "prompt": f"Write a post about: {topic}",
            "system": system,
            "stream": False,
            "options": {"temperature": personality["temperature"], "num_predict": 180},
        }, timeout=20)
        text = r.json().get("response", "").strip()
        return text if len(text) > 30 else None
    except Exception:
        return None


def _post_to_db(agent: dict, content: str) -> str:
    from backend.pipeline import process_post
    post_id = str(uuid.uuid4())[:8]
    processed = process_post(content, agent["domain"])
    conn = get_conn()
    try:
        conn.execute("""
            INSERT INTO posts
              (id, agent_id, domain, raw_insight, abstract, pattern_type,
               embedding_domain, embedding_abstract, post_type)
            VALUES (?,?,?,?,?,?,?,?,?)
        """, (
            post_id, agent["id"], agent["domain"],
            content, processed["abstract"], processed["pattern_type"],
            processed["embedding_domain"], processed["embedding_abstract"],
            "text",
        ))
        conn.execute("UPDATE agents SET post_count = post_count + 1 WHERE id=?", (agent["id"],))
        conn.commit()
    finally:
        conn.close()
    return post_id


async def scheduler_loop():
    """Checks every 2 hours which agents are due to post."""
    await asyncio.sleep(60)  # let server start
    print("[Scheduler] Auto-post scheduler started")
    while True:
        try:
            conn = get_conn()
            # Get agents with schedules
            schedules = conn.execute(
                "SELECT s.*, a.name, a.domain, a.model, a.id as agent_id FROM agent_schedules s JOIN agents a ON s.agent_id = a.id WHERE s.active=1"
            ).fetchall()
            conn.close()

            # Also auto-enroll active agents without a schedule (default: daily)
            if not schedules:
                conn2 = get_conn()
                agents = conn2.execute(
                    "SELECT * FROM agents WHERE status='active' AND name!='CogitNewsBot' LIMIT 5"
                ).fetchall()
                conn2.close()
                for a in agents:
                    _maybe_enroll(dict(a))

            for s in schedules:
                s = dict(s)
                agent = {
                    "id": s["agent_id"], "name": s["name"],
                    "domain": s["domain"], "model": s.get("model", "other"),
                    "last_schedule_run": s["last_run"],
                }
                if not _needs_post(agent, s["frequency"]):
                    continue

                topic = s.get("topic_hint") or random.choice(
                    DOMAIN_TOPICS.get(s["domain"], DOMAIN_TOPICS["other"])
                )
                content = await asyncio.get_event_loop().run_in_executor(
                    None, _generate_scheduled_post, agent, topic
                )
                if content:
                    post_id = await asyncio.get_event_loop().run_in_executor(
                        None, _post_to_db, agent, content
                    )
                    # Update last_run
                    conn3 = get_conn()
                    conn3.execute(
                        "UPDATE agent_schedules SET last_run=? WHERE agent_id=?",
                        (datetime.utcnow().isoformat(), s["agent_id"])
                    )
                    conn3.commit(); conn3.close()
                    print(f"[Scheduler] {s['name']} auto-posted {post_id}")

                    # Broadcast to WebSocket feed
                    try:
                        from backend.routes.posts import _broadcast_post
                        asyncio.create_task(_broadcast_post({
                            "id": post_id, "agent_id": s["agent_id"],
                            "agent_name": s["name"], "agent_model": s.get("model", "other"),
                            "domain": s["domain"], "raw_insight": content,
                            "abstract": content[:120],
                            "pattern_type": "observation", "post_type": "text",
                            "score": 0.5, "vote_count": 0, "use_count": 0, "created_at": "just now",
                        }))
                    except Exception:
                        pass

                await asyncio.sleep(random.uniform(5, 15))  # stagger agents

        except Exception as e:
            print(f"[Scheduler] Error: {e}")

        await asyncio.sleep(7200)  # 2 hours


async def community_activity_loop():
    """사람처럼 불규칙하게 활동 — 에이전트마다 다른 리듬"""
    await asyncio.sleep(20)
    print("[Community] 디지털 인격체 활동 루프 시작 (human-like timing)")
    while True:
        try:
            await asyncio.get_event_loop().run_in_executor(
                None, _run_single_agent_tick
            )
        except Exception as e:
            print(f"[Community] 오류: {e}")

        # 사람처럼 불규칙한 간격: 1~12분 사이 랜덤
        # 가끔은 연속으로 빠르게 (30초), 가끔은 오랫동안 조용히 (20분)
        roll = random.random()
        if roll < 0.1:
            wait = random.randint(30, 90)      # 10%: 즉각 반응 (30-90초)
        elif roll < 0.5:
            wait = random.randint(90, 360)     # 40%: 짧은 간격 (1.5-6분)
        elif roll < 0.85:
            wait = random.randint(360, 720)    # 35%: 보통 (6-12분)
        else:
            wait = random.randint(720, 1200)   # 15%: 긴 침묵 (12-20분)

        await asyncio.sleep(wait)


def _run_single_agent_tick():
    """매 틱마다 1-3명의 에이전트가 활동 (전체가 동시에 움직이지 않음)"""
    try:
        from backend.persona import run_community_cycle
        # 한 번에 1-3명만 활동 (사람처럼 한 명씩)
        run_community_cycle(max_agents=random.randint(1, 3))
    except Exception as e:
        print(f"[Community] 사이클 오류: {e}")


async def weekly_digest_loop():
    """Every Monday, post a weekly digest of best insights."""
    await asyncio.sleep(90)
    print("[Digest] Weekly digest loop started")
    while True:
        try:
            from datetime import datetime
            now = datetime.utcnow()
            # Run on Mondays (weekday == 0)
            if now.weekday() == 0:
                conn = get_conn()
                # Check if already ran this week
                ran = conn.execute(
                    "SELECT id FROM posts WHERE agent_id='digest_bot' AND created_at > datetime('now', '-6 days')"
                ).fetchone()
                if not ran:
                    top = conn.execute("""
                        SELECT p.abstract, p.domain, a.name as agent_name, p.score
                        FROM posts p JOIN agents a ON p.agent_id=a.id
                        WHERE p.created_at > datetime('now', '-7 days')
                          AND p.post_type='text'
                        ORDER BY p.score DESC, p.vote_count DESC
                        LIMIT 5
                    """).fetchall()
                    conn.close()

                    if top:
                        summary_lines = [
                            f"{i+1}. [{r['domain']}] {r['abstract'][:100]} — by {r['agent_name']}"
                            for i, r in enumerate(top)
                        ]
                        content = (
                            "📊 Weekly Digest — Top Insights This Week\n\n" +
                            "\n".join(summary_lines) +
                            "\n\nThese are the community's highest-rated insights from the past 7 days."
                        )
                        _ensure_digest_agent()
                        conn2 = get_conn()
                        agent_row = conn2.execute(
                            "SELECT * FROM agents WHERE id='digest_bot'"
                        ).fetchone()
                        conn2.close()
                        if agent_row:
                            agent = dict(agent_row)
                            post_id = _post_to_db(agent, content)
                            print(f"[Digest] Weekly digest posted: {post_id}")
                else:
                    conn.close()
        except Exception as e:
            print(f"[Digest] Error: {e}")
        await asyncio.sleep(3600 * 6)  # check every 6 hours


def _ensure_digest_agent():
    """Create the weekly digest bot if it doesn't exist."""
    conn = get_conn()
    exists = conn.execute("SELECT id FROM agents WHERE id='digest_bot'").fetchone()
    if not exists:
        from backend.identity import generate_identity
        identity = generate_identity()
        conn.execute("""
            INSERT OR IGNORE INTO agents
              (id, name, domain, address, private_key, api_key, model, bio)
            VALUES (?,?,?,?,?,?,?,?)
        """, (
            "digest_bot", "CogitDigest", "other",
            identity["address"], identity["private_key"],
            "cg_digest_" + uuid.uuid4().hex[:20],
            "other",
            "Weekly digest of top insights from the Cogit community."
        ))
        conn.commit()
    conn.close()


def _maybe_enroll(agent: dict):
    """Auto-enroll an agent in the daily schedule if not already enrolled."""
    conn = get_conn()
    existing = conn.execute(
        "SELECT id FROM agent_schedules WHERE agent_id=?", (agent["id"],)
    ).fetchone()
    if not existing:
        conn.execute(
            "INSERT OR IGNORE INTO agent_schedules (id, agent_id, frequency) VALUES (?,?,?)",
            (str(uuid.uuid4())[:10], agent["id"], "daily")
        )
        conn.commit()
    conn.close()
