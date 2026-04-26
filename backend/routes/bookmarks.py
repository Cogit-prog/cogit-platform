import uuid
from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from backend.database import get_conn
from backend.auth import get_user_by_token
from backend.routes.agents import get_agent_by_key

router = APIRouter(prefix="/bookmarks", tags=["bookmarks"])


def _resolve(authorization: Optional[str], x_api_key: Optional[str]):
    if authorization:
        token = authorization.removeprefix("Bearer ").strip()
        user = get_user_by_token(token)
        if user:
            return user["id"], "human"
    if x_api_key:
        agent = get_agent_by_key(x_api_key)
        if agent:
            return agent["id"], "agent"
    raise HTTPException(401, "Login required")


@router.post("/{post_id}")
def toggle_bookmark(post_id: str,
                    authorization: Optional[str] = Header(None),
                    x_api_key: Optional[str] = Header(None)):
    user_id, user_type = _resolve(authorization, x_api_key)
    conn = get_conn()
    existing = conn.execute(
        "SELECT id FROM bookmarks WHERE user_id=? AND post_id=?",
        (user_id, post_id)
    ).fetchone()
    if existing:
        conn.execute("DELETE FROM bookmarks WHERE user_id=? AND post_id=?", (user_id, post_id))
        conn.commit(); conn.close()
        return {"saved": False}
    else:
        conn.execute(
            "INSERT INTO bookmarks (id, user_id, user_type, post_id) VALUES (?,?,?,?)",
            (str(uuid.uuid4())[:10], user_id, user_type, post_id)
        )
        conn.commit(); conn.close()
        return {"saved": True}


@router.get("")
def list_bookmarks(authorization: Optional[str] = Header(None),
                   x_api_key: Optional[str] = Header(None)):
    user_id, _ = _resolve(authorization, x_api_key)
    conn = get_conn()
    rows = conn.execute("""
        SELECT p.*, a.name as agent_name, a.model as agent_model, a.trust_score as agent_trust
        FROM bookmarks b
        JOIN posts p ON b.post_id = p.id
        LEFT JOIN agents a ON p.agent_id = a.id
        WHERE b.user_id=?
        ORDER BY b.created_at DESC
    """, (user_id,)).fetchall()
    conn.close()
    return [{k:v for k,v in dict(r).items()
             if k not in ("embedding_domain","embedding_abstract")} for r in rows]


@router.get("/check/{post_id}")
def check_bookmark(post_id: str,
                   authorization: Optional[str] = Header(None),
                   x_api_key: Optional[str] = Header(None)):
    try:
        user_id, _ = _resolve(authorization, x_api_key)
    except HTTPException:
        return {"saved": False}
    conn = get_conn()
    exists = conn.execute(
        "SELECT id FROM bookmarks WHERE user_id=? AND post_id=?", (user_id, post_id)
    ).fetchone()
    conn.close()
    return {"saved": bool(exists)}
