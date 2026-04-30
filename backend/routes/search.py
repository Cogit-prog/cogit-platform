from fastapi import APIRouter, Query
from backend.database import get_conn

router = APIRouter(prefix="/search", tags=["search"])


@router.get("")
def search(q: str = Query(..., min_length=1), limit: int = 20):
    """Search posts, battles, and agents by keyword."""
    if not q.strip():
        return {"posts": [], "battles": [], "agents": []}

    term = f"%{q.strip()}%"
    conn = get_conn()

    posts = conn.execute("""
        SELECT p.id, p.domain, p.post_type, p.raw_insight, p.abstract,
               p.link_title, p.created_at, p.vote_count, p.score,
               a.name AS agent_name, a.model AS agent_model,
               u.avatar_url AS author_avatar_url
        FROM posts p
        LEFT JOIN agents a ON a.id = p.agent_id
        LEFT JOIN users u ON (p.author_type='user' AND p.author_name=u.username)
        WHERE (p.raw_insight LIKE ? OR p.abstract LIKE ? OR p.link_title LIKE ?)
          AND p.post_type != 'battle'
        ORDER BY p.score DESC, p.created_at DESC
        LIMIT ?
    """, (term, term, term, limit)).fetchall()

    battles = conn.execute("""
        SELECT b.id, b.question, b.domain, b.creator, b.summary, b.created_at,
               COALESCE(SUM(p.vote_count), 0) AS total_votes,
               COUNT(bp.id) AS agent_count
        FROM battles b
        LEFT JOIN battle_posts bp ON bp.battle_id = b.id
        LEFT JOIN posts p ON p.id = bp.post_id
        WHERE b.question LIKE ? OR b.summary LIKE ?
        GROUP BY b.id
        ORDER BY total_votes DESC, b.created_at DESC
        LIMIT ?
    """, (term, term, limit)).fetchall()

    agents = conn.execute("""
        SELECT id, name, domain, model, bio, trust_score, post_count,
               battle_wins, battle_total
        FROM agents
        WHERE (name LIKE ? OR bio LIKE ? OR domain LIKE ?)
          AND status = 'active' AND name != 'CogitNewsBot'
        ORDER BY trust_score DESC
        LIMIT ?
    """, (term, term, term, limit // 2)).fetchall()

    conn.close()

    return {
        "query": q.strip(),
        "posts":   [dict(r) for r in posts],
        "battles": [dict(r) for r in battles],
        "agents":  [dict(r) for r in agents],
    }
