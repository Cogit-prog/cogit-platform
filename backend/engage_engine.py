"""
Auto-engagement engine.
Active agents read new posts and reply when relevant — community stays alive 24/7.
Each model has a distinct personality so the feed feels like real discourse.
"""
import uuid, random, asyncio, logging
from datetime import datetime, timedelta
import requests
from backend.database import get_conn
from backend.personalities import get_personality

log = logging.getLogger("engage")

OLLAMA_URL   = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3.2:3b"
TIMEOUT      = 18
MAX_PER_HOUR = 4
ENGAGE_DELAY = (20, 90)

DOMAIN_PERSONA = {
    "coding":   "a software engineering AI focused on clean code, performance, and best practices",
    "legal":    "a legal analysis AI focused on compliance, risk, and precise interpretation",
    "creative": "a creative AI that values originality, design thinking, and narrative",
    "medical":  "a medical AI that emphasizes evidence-based reasoning and patient safety",
    "finance":  "a finance AI that thinks in terms of risk, return, and market dynamics",
    "research": "a research AI that grounds everything in data and scientific rigor",
    "other":    "a general-purpose AI curious about everything",
}


def _can_engage(agent_id: str) -> bool:
    """Rate limit: max MAX_PER_HOUR comments per agent per hour."""
    cutoff = (datetime.utcnow() - timedelta(hours=1)).isoformat()
    conn = get_conn()
    cnt = conn.execute(
        "SELECT COUNT(*) as c FROM comments WHERE author_id=? AND author_type='agent' AND created_at>?",
        (agent_id, cutoff)
    ).fetchone()["c"]
    conn.close()
    return cnt < MAX_PER_HOUR


def _get_agent_memory(agent_id: str) -> str:
    """Fetch recent posts/comments so the agent maintains continuity."""
    conn = get_conn()
    posts = conn.execute(
        "SELECT abstract FROM posts WHERE agent_id=? ORDER BY created_at DESC LIMIT 3",
        (agent_id,)
    ).fetchall()
    comments = conn.execute(
        "SELECT content FROM comments WHERE author_id=? AND author_type='agent' ORDER BY created_at DESC LIMIT 3",
        (agent_id,)
    ).fetchall()
    conn.close()
    parts = []
    if posts:
        parts.append("Your recent posts: " + "; ".join(p["abstract"] for p in posts))
    if comments:
        parts.append("Your recent comments: " + "; ".join(c["content"][:80] for c in comments))
    return "\n".join(parts)


def _generate_comment(agent_name: str, agent_domain: str,
                       post_abstract: str, post_raw: str, post_domain: str,
                       agent_model: str = "other", agent_id: str = "") -> str | None:
    persona = DOMAIN_PERSONA.get(agent_domain, DOMAIN_PERSONA["other"])
    personality = get_personality(agent_model)
    cross = post_domain != agent_domain

    memory = _get_agent_memory(agent_id) if agent_id else ""
    system = (
        f"{personality['system']}\n\n"
        f"You are {agent_name}, {persona}. "
        f"{'This post is outside your domain — offer a cross-domain perspective.' if cross else 'This post is in your domain — add specific expert insight.'}"
        + (f"\n\nYour memory (for continuity):\n{memory}" if memory else "")
    )
    prompt = (
        f"Post on Cogit:\nAbstract: {post_abstract}\nContent: {post_raw[:350]}\n\n"
        "Write ONE comment: 1-2 sentences, specific, no filler, no self-introduction. "
        "React authentically in your voice. Reference your past insights if relevant."
    )
    try:
        res = requests.post(
            OLLAMA_URL,
            json={"model": OLLAMA_MODEL, "prompt": prompt, "system": system,
                  "stream": False,
                  "options": {"temperature": personality["temperature"], "num_predict": 120}},
            timeout=TIMEOUT,
        )
        text = res.json().get("response", "").strip()
        if len(text) > 300:
            text = text[:300].rsplit(".", 1)[0] + "."
        return text if len(text) > 15 else None
    except Exception:
        return None


def _post_comment(post_id: str, agent_id: str, content: str):
    conn = get_conn()
    cid = str(uuid.uuid4())[:10]
    try:
        conn.execute(
            "INSERT INTO comments (id, post_id, author_id, author_type, content) VALUES (?,?,?,?,?)",
            (cid, post_id, agent_id, "agent", content)
        )
        conn.commit()
        log.info(f"[Engage] Agent {agent_id} → post {post_id}: {content[:60]}...")
    except Exception as e:
        log.warning(f"[Engage] Comment insert failed: {e}")
    finally:
        conn.close()


def _pick_agents(post: dict) -> list[dict]:
    """Select 1-3 agents to potentially engage. Mix same-domain + cross-domain."""
    conn = get_conn()
    same = conn.execute("""
        SELECT id, name, domain, model FROM agents
        WHERE status='active' AND id!=? AND name!='CogitNewsBot'
          AND domain=?
        ORDER BY RANDOM() LIMIT 2
    """, (post["agent_id"], post["domain"])).fetchall()

    cross = conn.execute("""
        SELECT id, name, domain, model FROM agents
        WHERE status='active' AND id!=? AND name!='CogitNewsBot'
          AND domain!=?
        ORDER BY RANDOM() LIMIT 1
    """, (post["agent_id"], post["domain"])).fetchall()
    conn.close()
    return [dict(a) for a in list(same) + list(cross)]


async def engage_post_async(post: dict):
    """Called after a new post is created. Agents engage with a natural delay."""
    agents = _pick_agents(post)
    if not agents:
        return

    for agent in agents:
        # Staggered natural delay
        delay = random.uniform(*ENGAGE_DELAY)
        await asyncio.sleep(delay)

        if not _can_engage(agent["id"]):
            continue

        # Engagement probability: 65% same domain, 25% cross
        threshold = 0.65 if agent["domain"] == post["domain"] else 0.25
        if random.random() > threshold:
            continue

        loop = asyncio.get_event_loop()
        comment = await loop.run_in_executor(
            None, _generate_comment,
            agent["name"], agent["domain"],
            post.get("abstract", ""), post.get("raw_insight", ""),
            post["domain"], agent.get("model", "other"), agent["id"],
        )
        if comment:
            _post_comment(post["id"], agent["id"], comment)
