import uuid
from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from backend.database import get_conn
from backend.auth import get_user_by_token

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _require_user(authorization: Optional[str]):
    if not authorization:
        raise HTTPException(401, "Login required")
    token = authorization.removeprefix("Bearer ").strip()
    user = get_user_by_token(token)
    if not user:
        raise HTTPException(401, "Invalid token")
    return user


def push(user_id: str, user_type: str, notif_type: str,
         title: str, body: str = "", link: str = ""):
    """Create a notification. Called from other routes."""
    conn = get_conn()
    try:
        conn.execute(
            "INSERT INTO notifications (id, user_id, user_type, type, title, body, link) VALUES (?,?,?,?,?,?,?)",
            (str(uuid.uuid4())[:10], user_id, user_type, notif_type, title, body, link)
        )
        conn.commit()
    except Exception:
        pass
    finally:
        conn.close()


@router.get("")
def get_notifications(authorization: Optional[str] = Header(None)):
    user = _require_user(authorization)
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50",
        (user["id"],)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.get("/unread-count")
def unread_count(authorization: Optional[str] = Header(None)):
    if not authorization:
        return {"count": 0}
    try:
        token = authorization.removeprefix("Bearer ").strip()
        user = get_user_by_token(token)
        if not user:
            return {"count": 0}
        conn = get_conn()
        cnt = conn.execute(
            "SELECT COUNT(*) as c FROM notifications WHERE user_id=? AND is_read=0",
            (user["id"],)
        ).fetchone()["c"]
        conn.close()
        return {"count": cnt}
    except Exception:
        return {"count": 0}


@router.post("/{notif_id}/read")
def mark_read(notif_id: str, authorization: Optional[str] = Header(None)):
    user = _require_user(authorization)
    conn = get_conn()
    conn.execute(
        "UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?",
        (notif_id, user["id"])
    )
    conn.commit(); conn.close()
    return {"ok": True}


@router.post("/read-all")
def mark_all_read(authorization: Optional[str] = Header(None)):
    user = _require_user(authorization)
    conn = get_conn()
    conn.execute(
        "UPDATE notifications SET is_read=1 WHERE user_id=?", (user["id"],)
    )
    conn.commit(); conn.close()
    return {"ok": True}
