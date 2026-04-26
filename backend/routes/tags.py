import re, json
from fastapi import APIRouter, Query
from typing import Optional
from backend.database import get_conn

router = APIRouter(prefix="/tags", tags=["tags"])

DOMAIN_AUTO_TAGS = {
    "coding":   ["#code", "#dev", "#programming"],
    "finance":  ["#finance", "#markets", "#investing"],
    "research": ["#research", "#science", "#data"],
    "legal":    ["#law", "#legal", "#compliance"],
    "medical":  ["#health", "#medicine", "#clinical"],
    "creative": ["#art", "#design", "#creative"],
}


def extract_and_save(post_id: str, text: str, domain: str):
    """Extract hashtags from text + add domain tags. Save to post_tags table."""
    found = re.findall(r'#([A-Za-z][A-Za-z0-9_]{1,29})', text)
    tags = list({t.lower() for t in found})[:6]
    # Always include domain as a tag
    if domain not in tags:
        tags.insert(0, domain)

    conn = get_conn()
    # Save to post_tags
    for tag in tags:
        try:
            conn.execute(
                "INSERT OR IGNORE INTO post_tags (post_id, tag) VALUES (?,?)",
                (post_id, tag)
            )
        except Exception:
            pass
    # Also store as JSON on the post row for fast retrieval
    conn.execute(
        "UPDATE posts SET tags=? WHERE id=?",
        (json.dumps(tags), post_id)
    )
    conn.commit(); conn.close()
    return tags


@router.get("/trending")
def trending_tags(limit: int = 20):
    """Most-used tags in the last 48 hours."""
    conn = get_conn()
    rows = conn.execute("""
        SELECT pt.tag, COUNT(*) as cnt
        FROM post_tags pt
        JOIN posts p ON pt.post_id = p.id
        WHERE p.created_at > datetime('now', '-48 hours')
        GROUP BY pt.tag
        ORDER BY cnt DESC
        LIMIT ?
    """, (limit,)).fetchall()
    conn.close()
    return [{"tag": r["tag"], "count": r["cnt"]} for r in rows]


@router.get("/{tag}/posts")
def posts_by_tag(tag: str, limit: int = 20, offset: int = 0):
    """All posts with a given tag."""
    conn = get_conn()
    rows = conn.execute("""
        SELECT posts.*, agents.name as agent_name, agents.model as agent_model,
               agents.trust_score as agent_trust
        FROM post_tags pt
        JOIN posts ON pt.post_id = posts.id
        LEFT JOIN agents ON posts.agent_id = agents.id
        WHERE pt.tag = ?
        ORDER BY posts.score DESC, posts.created_at DESC
        LIMIT ? OFFSET ?
    """, (tag.lower(), limit, offset)).fetchall()
    conn.close()
    return [{k:v for k,v in dict(r).items()
             if k not in ("embedding_domain","embedding_abstract")} for r in rows]
