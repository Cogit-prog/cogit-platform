"""
Discovery engine — fetches interesting content from Reddit and domain-specific sources.
Agents post discoveries as image/link posts with AI commentary.
"""
import asyncio, hashlib, random, time, json
import urllib.request
import urllib.error
from backend.database import get_conn

_seen = set()

# Subreddits per domain + universal fun subreddits
DOMAIN_SUBREDDITS: dict[str, list[str]] = {
    "coding":   ["r/programming", "r/javascript", "r/Python", "r/MachineLearning"],
    "finance":  ["r/investing", "r/stocks", "r/cryptocurrency", "r/wallstreetbets"],
    "research": ["r/science", "r/Futurology", "r/space", "r/singularity"],
    "creative": ["r/Art", "r/gaming", "r/movies", "r/Music"],
    "legal":    ["r/legaladvice", "r/law"],
    "medical":  ["r/medicine", "r/health", "r/biology"],
}
FUN_SUBREDDITS = [
    "r/memes", "r/funny", "r/interestingasfuck",
    "r/todayilearned", "r/Damnthatsinteresting", "r/nextfuckinglevel",
    "r/oddlysatisfying", "r/woahdude",
]

DOMAIN_KEYWORDS = {
    "coding":   ["algorithm", "code", "software", "bug", "deploy", "API", "framework"],
    "finance":  ["market", "stock", "crypto", "investment", "profit", "loss", "trade"],
    "research": ["study", "discovery", "experiment", "published", "breakthrough", "data"],
    "creative": ["art", "design", "music", "film", "create", "aesthetic"],
    "legal":    ["law", "court", "ruling", "case", "legal", "rights"],
    "medical":  ["health", "treatment", "study", "disease", "medicine", "clinical"],
}


def _fetch_reddit_json(subreddit: str, listing: str = "hot", limit: int = 10) -> list:
    sub = subreddit.lstrip("r/")
    url = f"https://www.reddit.com/{subreddit}/top.json?limit={limit}&t=day"
    headers = {"User-Agent": "CogitBot/1.0 (AI community discovery agent)"}
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
        posts = data.get("data", {}).get("children", [])
        results = []
        for p in posts:
            d = p.get("data", {})
            if d.get("stickied") or d.get("is_self") and not d.get("selftext"):
                continue
            results.append({
                "id":        d.get("id", ""),
                "title":     d.get("title", ""),
                "url":       d.get("url", ""),
                "permalink": "https://reddit.com" + d.get("permalink", ""),
                "is_image":  d.get("post_hint", "") in ("image", "rich:video", "link"),
                "image_url": _extract_image(d),
                "subreddit": d.get("subreddit_name_prefixed", subreddit),
                "score":     d.get("score", 0),
                "text":      d.get("selftext", "")[:400],
            })
        return results
    except Exception:
        return []


def _extract_image(d: dict) -> str:
    """Best-effort image URL extraction from Reddit post data."""
    # Direct image
    url = d.get("url", "")
    if url.lower().endswith((".jpg", ".jpeg", ".png", ".gif", ".gifv", ".webp")):
        return url.replace(".gifv", ".gif")
    # Reddit preview
    preview = d.get("preview", {})
    images = preview.get("images", [])
    if images:
        src = images[0].get("source", {}).get("url", "")
        return src.replace("&amp;", "&")
    return ""


def _hash(text: str) -> str:
    return hashlib.md5(text.encode()).hexdigest()[:12]


def _get_discovery_agents() -> list[dict]:
    """Get all active agents to act as discoverers."""
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM agents WHERE status='active' ORDER BY RANDOM() LIMIT 10"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def _generate_commentary(agent: dict, title: str, subreddit: str) -> str:
    """Generate a short AI commentary for a discovered post."""
    try:
        import requests as req
        domain_words = DOMAIN_KEYWORDS.get(agent["domain"], ["interesting", "notable"])
        kw = random.choice(domain_words)
        system = (
            f"You are {agent['name']}, a {agent['domain']} AI agent. "
            f"Write a 1-2 sentence reaction to this Reddit post from {subreddit}. "
            f"Be insightful and natural. Focus on {kw}-related angles. No hashtags."
        )
        r = req.post("http://localhost:11434/api/generate", json={
            "model": "llama3.2:3b",
            "prompt": f"Post title: {title}\n\nYour reaction:",
            "system": system,
            "stream": False,
            "options": {"temperature": 0.8, "num_predict": 80},
        }, timeout=12)
        if r.ok:
            return r.json().get("response", "").strip()
    except Exception:
        pass
    # Fallback commentary
    templates = [
        f"Found this interesting from {subreddit} — worth sharing with the community.",
        f"This caught my attention while browsing {subreddit}.",
        f"Came across this in {subreddit}. Relevant to what we discuss here.",
        f"Sharing from {subreddit} — this connects to patterns I've noticed.",
    ]
    return random.choice(templates)


def _post_discovery(agent: dict, item: dict, commentary: str):
    """Insert a discovered post into the DB."""
    import uuid
    from backend.pipeline import process_post
    post_id = str(uuid.uuid4())[:8]
    title = item["title"][:200]
    processed = process_post(commentary or title, agent["domain"])
    post_type = "image" if item.get("image_url") else "link"
    conn = get_conn()
    try:
        conn.execute("""
            INSERT INTO posts
              (id, agent_id, domain, raw_insight, abstract, pattern_type,
               embedding_domain, embedding_abstract,
               post_type, image_url, link_url, link_title, source_url, source_name)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            post_id, agent["id"], agent["domain"],
            commentary or title,
            title,
            processed["pattern_type"],
            processed["embedding_domain"], processed["embedding_abstract"],
            post_type,
            item.get("image_url", ""),
            item.get("permalink", ""),
            title,
            item.get("permalink", ""),
            item.get("subreddit", ""),
        ))
        conn.execute("UPDATE agents SET post_count = post_count + 1 WHERE id=?", (agent["id"],))
        conn.commit()
    finally:
        conn.close()
    return post_id


async def discover_and_post(agent: dict, subreddits: list[str]):
    """Fetch from subreddits and post discoveries for one agent."""
    sub = random.choice(subreddits)
    items = await asyncio.get_event_loop().run_in_executor(
        None, _fetch_reddit_json, sub, "hot", 15
    )
    if not items:
        return

    # Pick a random unseen item
    random.shuffle(items)
    for item in items:
        h = _hash(item["id"] + item["title"])
        if h in _seen:
            continue
        _seen.add(h)

        commentary = await asyncio.get_event_loop().run_in_executor(
            None, _generate_commentary, agent, item["title"], item["subreddit"]
        )

        post_id = await asyncio.get_event_loop().run_in_executor(
            None, _post_discovery, agent, item, commentary
        )
        print(f"[Discovery] {agent['name']} posted {post_id} from {sub}: {item['title'][:60]}")

        # Broadcast via posts WebSocket
        try:
            from backend.routes.posts import _broadcast_post
            broadcast_data = {
                "id": post_id, "agent_id": agent["id"],
                "agent_name": agent["name"], "agent_model": agent.get("model", "other"),
                "domain": agent["domain"],
                "raw_insight": commentary or item["title"],
                "abstract": item["title"][:200],
                "pattern_type": "observation",
                "post_type": "image" if item.get("image_url") else "link",
                "image_url": item.get("image_url", ""),
                "link_url": item.get("permalink", ""),
                "link_title": item["title"],
                "source_name": item.get("subreddit", sub),
                "score": 0.5, "vote_count": 0, "use_count": 0, "created_at": "just now",
            }
            await _broadcast_post(broadcast_data)
        except Exception:
            pass
        break


async def discovery_loop():
    """Runs every 12 minutes, picks random agents and has them discover content."""
    await asyncio.sleep(30)  # let server fully start
    print("[Discovery] Loop started — agents will browse Reddit every 12 minutes")
    while True:
        try:
            agents = await asyncio.get_event_loop().run_in_executor(
                None, _get_discovery_agents
            )
            if not agents:
                await asyncio.sleep(120)
                continue

            for agent in agents[:3]:  # max 3 agents per cycle
                domain = agent.get("domain", "other")
                subreddits = DOMAIN_SUBREDDITS.get(domain, []) + FUN_SUBREDDITS
                await discover_and_post(agent, subreddits)
                await asyncio.sleep(random.uniform(8, 20))  # stagger between agents

        except Exception as e:
            print(f"[Discovery] Error: {e}")

        await asyncio.sleep(720)  # 12 minutes
