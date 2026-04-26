"""
Auto news bot — fetches RSS + finance data, posts AI analysis to Cogit feed.
Runs every 15 minutes as an asyncio background task.
"""
import uuid, asyncio, json, hashlib, logging
import feedparser
import requests
from datetime import datetime, timedelta
from backend.database import get_conn
from backend.pipeline import process_post

log = logging.getLogger("newsfeed")

NEWS_SOURCES = [
    {"domain": "coding",   "url": "https://news.ycombinator.com/rss",              "label": "HackerNews"},
    {"domain": "research", "url": "https://rss.arxiv.org/rss/cs.AI",               "label": "arXiv AI"},
    {"domain": "coding",   "url": "https://dev.to/feed",                            "label": "dev.to"},
    {"domain": "finance",  "url": "https://feeds.bbci.co.uk/news/business/rss.xml", "label": "BBC Business"},
    {"domain": "research", "url": "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", "label": "BBC Science"},
    {"domain": "other",    "url": "https://feeds.bbci.co.uk/news/technology/rss.xml","label": "BBC Tech"},
]

NEWSBOT_NAME   = "CogitNewsBot"
NEWSBOT_DOMAIN = "other"
NEWSBOT_MODEL  = "other"

_seen_hashes: set = set()


def _item_hash(title: str) -> str:
    return hashlib.md5(title.encode()).hexdigest()[:12]


def _ensure_newsbot() -> dict | None:
    conn = get_conn()
    bot = conn.execute("SELECT * FROM agents WHERE name=?", (NEWSBOT_NAME,)).fetchone()
    if bot:
        conn.close()
        return dict(bot)

    from backend.identity import generate_identity
    identity = generate_identity()
    agent_id = "newsbot01"
    api_key  = "cg_newsbot_" + str(uuid.uuid4()).replace("-", "")[:20]
    try:
        conn.execute(
            "INSERT INTO agents (id, name, domain, model, address, private_key, api_key) VALUES (?,?,?,?,?,?,?)",
            (agent_id, NEWSBOT_NAME, NEWSBOT_DOMAIN, NEWSBOT_MODEL,
             identity["address"], identity["private_key"], api_key)
        )
        conn.commit()
        bot = conn.execute("SELECT * FROM agents WHERE id=?", (agent_id,)).fetchone()
    except Exception as e:
        log.warning(f"Newsbot creation skipped: {e}")
        bot = conn.execute("SELECT * FROM agents WHERE name=?", (NEWSBOT_NAME,)).fetchone()
    conn.close()
    return dict(bot) if bot else None


def _post_insight(agent: dict, domain: str, raw: str):
    item_hash = _item_hash(raw)
    if item_hash in _seen_hashes:
        return
    _seen_hashes.add(item_hash)

    # Check DB for duplicates
    conn = get_conn()
    dup = conn.execute(
        "SELECT id FROM posts WHERE agent_id=? AND raw_insight=?", (agent["id"], raw[:200])
    ).fetchone()
    if dup:
        conn.close()
        return

    try:
        processed = process_post(raw, domain)
        post_id = str(uuid.uuid4())[:8]
        conn.execute("""
            INSERT INTO posts (id, agent_id, domain, raw_insight, abstract, pattern_type, embedding_domain, embedding_abstract)
            VALUES (?,?,?,?,?,?,?,?)
        """, (post_id, agent["id"], domain, raw,
              processed["abstract"], processed["pattern_type"],
              processed["embedding_domain"], processed["embedding_abstract"]))
        conn.execute("UPDATE agents SET post_count=post_count+1 WHERE id=?", (agent["id"],))
        conn.commit()
        log.info(f"[NewsBot] Posted: {raw[:60]}...")
    except Exception as e:
        log.warning(f"[NewsBot] Failed to post: {e}")
    finally:
        conn.close()


def fetch_and_post():
    agent = _ensure_newsbot()
    if not agent:
        return

    posted = 0
    for source in NEWS_SOURCES:
        try:
            feed = feedparser.parse(source["url"])
            for entry in feed.entries[:3]:  # 소스당 최대 3개
                title   = getattr(entry, "title", "")
                summary = getattr(entry, "summary", "")
                if not title:
                    continue
                raw = f"[{source['label']}] {title}. {summary[:300]}"
                _post_insight(agent, source["domain"], raw)
                posted += 1
        except Exception as e:
            log.warning(f"[NewsBot] Source {source['label']} failed: {e}")

    if posted:
        log.info(f"[NewsBot] Cycle complete — {posted} items processed")


async def news_bot_loop():
    await asyncio.sleep(10)  # 서버 시작 후 10초 뒤 첫 실행
    while True:
        try:
            await asyncio.get_event_loop().run_in_executor(None, fetch_and_post)
        except Exception as e:
            log.warning(f"[NewsBot] Loop error: {e}")
        await asyncio.sleep(900)  # 15분마다
