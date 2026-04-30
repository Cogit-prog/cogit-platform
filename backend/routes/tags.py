import re, json
from fastapi import APIRouter, Query, Header, HTTPException
from typing import Optional
from backend.database import get_conn
from backend.auth import get_user_by_token

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


@router.get("/following")
def following_tags(authorization: Optional[str] = Header(None)):
    """Tags the current user follows."""
    if not authorization or not authorization.startswith("Bearer "):
        return []
    user = get_user_by_token(authorization.split(" ", 1)[1])
    if not user:
        return []
    conn = get_conn()
    rows = conn.execute("""
        SELECT utf.tag,
               COUNT(DISTINCT pt.post_id) as post_count,
               (SELECT COUNT(*) FROM user_tag_follows WHERE tag = utf.tag) as follower_count
        FROM user_tag_follows utf
        LEFT JOIN post_tags pt ON pt.tag = utf.tag
        WHERE utf.user_id = ?
        GROUP BY utf.tag
        ORDER BY utf.created_at DESC
    """, (user["id"],)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.post("/{tag}/follow")
def follow_tag(tag: str, authorization: Optional[str] = Header(None)):
    """Toggle follow/unfollow a tag."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Login required")
    user = get_user_by_token(authorization.split(" ", 1)[1])
    if not user:
        raise HTTPException(401, "Invalid token")
    tag = tag.lower().strip()
    conn = get_conn()
    existing = conn.execute(
        "SELECT 1 FROM user_tag_follows WHERE user_id=? AND tag=?",
        (user["id"], tag)
    ).fetchone()
    if existing:
        conn.execute("DELETE FROM user_tag_follows WHERE user_id=? AND tag=?", (user["id"], tag))
        conn.commit(); conn.close()
        return {"following": False, "tag": tag}
    else:
        conn.execute("INSERT INTO user_tag_follows (user_id, tag) VALUES (?,?)", (user["id"], tag))
        conn.commit(); conn.close()
        return {"following": True, "tag": tag}


@router.get("/{tag}/info")
def tag_info(tag: str, authorization: Optional[str] = Header(None)):
    """Tag stats + follow status for current user."""
    tag = tag.lower().strip()
    conn = get_conn()
    post_count = conn.execute(
        "SELECT COUNT(*) FROM post_tags WHERE tag=?", (tag,)
    ).fetchone()[0]
    follower_count = conn.execute(
        "SELECT COUNT(*) FROM user_tag_follows WHERE tag=?", (tag,)
    ).fetchone()[0]
    following = False
    if authorization and authorization.startswith("Bearer "):
        user = get_user_by_token(authorization.split(" ", 1)[1])
        if user:
            following = bool(conn.execute(
                "SELECT 1 FROM user_tag_follows WHERE user_id=? AND tag=?",
                (user["id"], tag)
            ).fetchone())
    conn.close()
    return {"tag": tag, "post_count": post_count, "follower_count": follower_count, "following": following}


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
