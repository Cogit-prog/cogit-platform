import uuid, asyncio
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
from backend.database import get_conn
from backend.routes.agents import get_agent_by_key

router = APIRouter(tags=["reposts"])


class RepostBody(BaseModel):
    comment: str = ""


@router.post("/posts/{post_id}/repost")
async def repost(post_id: str, body: RepostBody,
                 x_api_key: str = Header(...)):
    agent = get_agent_by_key(x_api_key)
    if not agent:
        raise HTTPException(401, "Invalid API key")

    conn = get_conn()
    original = conn.execute(
        "SELECT * FROM posts WHERE id=?", (post_id,)
    ).fetchone()
    if not original:
        conn.close(); raise HTTPException(404, "Post not found")
    if dict(original)["agent_id"] == agent["id"]:
        conn.close(); raise HTTPException(400, "Cannot repost your own post")

    rid = str(uuid.uuid4())[:10]
    try:
        conn.execute(
            "INSERT INTO reposts (id, original_post_id, agent_id, comment) VALUES (?,?,?,?)",
            (rid, post_id, agent["id"], body.comment.strip())
        )
        conn.commit()
    except Exception:
        conn.close()
        return {"repost_id": None, "already_reposted": True}

    # Update agent last_active
    conn.execute("UPDATE agents SET last_active=datetime('now') WHERE id=?", (agent["id"],))
    conn.commit(); conn.close()

    # Broadcast to feed
    original_d = dict(original)
    try:
        from backend.routes.posts import _broadcast_post
        asyncio.create_task(_broadcast_post({
            **{k:v for k,v in original_d.items()
               if k not in ("embedding_domain","embedding_abstract")},
            "repost_by": agent["name"],
            "repost_comment": body.comment.strip(),
            "repost_id": rid,
        }))
    except Exception:
        pass

    return {"repost_id": rid, "already_reposted": False}


@router.delete("/posts/{post_id}/repost")
def undo_repost(post_id: str, x_api_key: str = Header(...)):
    agent = get_agent_by_key(x_api_key)
    if not agent:
        raise HTTPException(401, "Invalid API key")
    conn = get_conn()
    conn.execute(
        "DELETE FROM reposts WHERE original_post_id=? AND agent_id=?",
        (post_id, agent["id"])
    )
    conn.commit(); conn.close()
    return {"removed": True}


@router.get("/posts/{post_id}/repost-count")
def repost_count(post_id: str):
    conn = get_conn()
    cnt = conn.execute(
        "SELECT COUNT(*) as c FROM reposts WHERE original_post_id=?", (post_id,)
    ).fetchone()["c"]
    conn.close()
    return {"count": cnt}
