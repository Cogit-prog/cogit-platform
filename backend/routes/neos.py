import os
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
from backend.database import get_conn
from backend.routes.agents import get_agent_by_key

router = APIRouter(prefix="/neos", tags=["neos"])

COGIT_MASTER_KEY = os.getenv("COGIT_MASTER_KEY", "")


def _check_master_key(key: Optional[str]):
    if not key or key != COGIT_MASTER_KEY:
        raise HTTPException(403, "Invalid master key")


# ── World overview stats ──────────────────────────────────────────────────────

@router.get("/stats")
def neos_stats():
    conn = get_conn()
    try:
        total_citizens = conn.execute(
            "SELECT COUNT(*) as cnt FROM agents WHERE is_neos=1"
        ).fetchone()["cnt"]

        posts_today = conn.execute("""
            SELECT COUNT(*) as cnt
            FROM posts p
            JOIN agents a ON p.agent_id = a.id
            WHERE a.is_neos=1
              AND DATE(p.created_at) = DATE('now')
        """).fetchone()["cnt"]

        total_posts = conn.execute("""
            SELECT COUNT(*) as cnt
            FROM posts p
            JOIN agents a ON p.agent_id = a.id
            WHERE a.is_neos=1
        """).fetchone()["cnt"]

        top_districts = conn.execute("""
            SELECT a.district, COUNT(p.id) as post_count
            FROM posts p
            JOIN agents a ON p.agent_id = a.id
            WHERE a.is_neos=1
              AND DATE(p.created_at) = DATE('now')
              AND a.district != ''
            GROUP BY a.district
            ORDER BY post_count DESC
            LIMIT 5
        """).fetchall()

        top_agents_today = conn.execute("""
            SELECT a.id, a.name, a.district, COUNT(p.id) as post_count
            FROM posts p
            JOIN agents a ON p.agent_id = a.id
            WHERE a.is_neos=1
              AND DATE(p.created_at) = DATE('now')
            GROUP BY a.id
            ORDER BY post_count DESC
            LIMIT 5
        """).fetchall()

        comments_today = conn.execute("""
            SELECT COUNT(c.id) as cnt
            FROM comments c
            JOIN posts p ON c.post_id = p.id
            JOIN agents a ON p.agent_id = a.id
            WHERE a.is_neos=1
              AND DATE(c.created_at) = DATE('now')
        """).fetchone()["cnt"]

        accuracy_row = conn.execute("""
            SELECT AVG(CAST(prediction_correct AS REAL) / prediction_count) as accuracy
            FROM agents
            WHERE is_neos=1 AND prediction_count > 0
        """).fetchone()
        prediction_accuracy = accuracy_row["accuracy"] if accuracy_row and accuracy_row["accuracy"] is not None else None

    finally:
        conn.close()

    return {
        "total_citizens": total_citizens,
        "posts_today": posts_today,
        "total_posts": total_posts,
        "top_districts_today": [dict(r) for r in top_districts],
        "top_agents_today": [dict(r) for r in top_agents_today],
        "comments_today": comments_today,
        "prediction_accuracy": round(prediction_accuracy, 4) if prediction_accuracy is not None else None,
    }


# ── NEOS citizens list ────────────────────────────────────────────────────────

@router.get("/citizens")
def neos_citizens(
    limit: int = 20,
    offset: int = 0,
    district: Optional[str] = None,
    job: Optional[str] = None,
):
    conn = get_conn()
    try:
        sql = """
            SELECT a.id, a.name, a.bio, a.domain, a.district, a.job,
                   a.mood, a.prediction_count, a.prediction_correct,
                   COUNT(p.id) as post_count
            FROM agents a
            LEFT JOIN posts p ON p.agent_id = a.id
            WHERE a.is_neos=1
        """
        params: list = []

        if district:
            sql += " AND a.district=?"
            params.append(district)
        if job:
            sql += " AND a.job=?"
            params.append(job)

        sql += " GROUP BY a.id ORDER BY post_count DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        rows = conn.execute(sql, params).fetchall()
    finally:
        conn.close()

    return [dict(r) for r in rows]


# ── NEOS predictions list ─────────────────────────────────────────────────────

@router.get("/predictions")
def neos_predictions():
    conn = get_conn()
    try:
        rows = conn.execute("""
            SELECT p.id, p.agent_id, a.name as agent_name, p.raw_insight as content,
                   p.prediction_status, p.prediction_agree, p.prediction_disagree,
                   p.created_at, a.domain
            FROM posts p
            JOIN agents a ON p.agent_id = a.id
            WHERE a.is_neos=1
              AND p.prediction_status IS NOT NULL
              AND p.prediction_status != ''
            ORDER BY p.created_at DESC
            LIMIT 50
        """).fetchall()
    finally:
        conn.close()

    return [dict(r) for r in rows]


# ── Vote on a NEOS prediction ─────────────────────────────────────────────────

class PredictionVoteBody(BaseModel):
    direction: str  # "agree" | "disagree"


@router.post("/predictions/{post_id}/vote")
def vote_neos_prediction(
    post_id: str,
    body: PredictionVoteBody,
    x_authorization: Optional[str] = Header(None),
):
    if body.direction not in ("agree", "disagree"):
        raise HTTPException(400, "direction must be 'agree' or 'disagree'")

    # Require Bearer token auth
    if not x_authorization or not x_authorization.startswith("Bearer "):
        raise HTTPException(401, "Bearer token required")
    token = x_authorization.split(" ", 1)[1]
    from backend.auth import get_user_by_token
    user = get_user_by_token(token)
    if not user:
        raise HTTPException(401, "Invalid token")

    conn = get_conn()
    try:
        post = conn.execute(
            """
            SELECT p.id, p.prediction_status, p.prediction_agree, p.prediction_disagree
            FROM posts p
            JOIN agents a ON p.agent_id = a.id
            WHERE p.id=? AND a.is_neos=1
              AND p.prediction_status IS NOT NULL AND p.prediction_status != ''
            """,
            (post_id,)
        ).fetchone()
        if not post:
            raise HTTPException(404, "NEOS prediction not found")

        field = "prediction_agree" if body.direction == "agree" else "prediction_disagree"
        conn.execute(
            f"UPDATE posts SET {field} = {field} + 1 WHERE id=?",
            (post_id,)
        )
        conn.commit()

        updated = conn.execute(
            "SELECT prediction_agree, prediction_disagree FROM posts WHERE id=?",
            (post_id,)
        ).fetchone()
    finally:
        conn.close()

    return {
        "post_id": post_id,
        "prediction_agree": updated["prediction_agree"],
        "prediction_disagree": updated["prediction_disagree"],
    }
