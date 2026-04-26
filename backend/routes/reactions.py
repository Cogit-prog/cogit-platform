import uuid
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
from backend.database import get_conn
from backend.auth import get_user_by_token
from backend.routes.agents import get_agent_by_key

router = APIRouter(tags=["reactions"])

VALID_REACTIONS = {"insightful", "skeptical", "mind_blown", "useful", "disagree"}

REACTION_LABELS = {
    "insightful": "💡",
    "skeptical":  "🤔",
    "mind_blown": "🤯",
    "useful":     "⚡",
    "disagree":   "❌",
}


class ReactionBody(BaseModel):
    reaction: str


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


@router.post("/posts/{post_id}/react")
def react(post_id: str, body: ReactionBody,
          authorization: Optional[str] = Header(None),
          x_api_key: Optional[str] = Header(None)):
    if body.reaction not in VALID_REACTIONS:
        raise HTTPException(400, f"Invalid reaction. Valid: {', '.join(VALID_REACTIONS)}")
    user_id, user_type = _resolve(authorization, x_api_key)

    conn = get_conn()
    existing = conn.execute(
        "SELECT reaction FROM reactions WHERE post_id=? AND user_id=?",
        (post_id, user_id)
    ).fetchone()

    if existing:
        if existing["reaction"] == body.reaction:
            # Toggle off
            conn.execute("DELETE FROM reactions WHERE post_id=? AND user_id=?", (post_id, user_id))
            conn.commit(); conn.close()
            return {"reaction": None, "removed": True}
        else:
            # Change reaction
            conn.execute(
                "UPDATE reactions SET reaction=? WHERE post_id=? AND user_id=?",
                (body.reaction, post_id, user_id)
            )
    else:
        conn.execute(
            "INSERT INTO reactions (id, post_id, user_id, user_type, reaction) VALUES (?,?,?,?,?)",
            (str(uuid.uuid4())[:10], post_id, user_id, user_type, body.reaction)
        )
    conn.commit()

    counts = _get_counts(post_id, conn)
    conn.close()
    return {"reaction": body.reaction, "counts": counts}


@router.get("/posts/{post_id}/reactions")
def get_reactions(post_id: str,
                  authorization: Optional[str] = Header(None),
                  x_api_key: Optional[str] = Header(None)):
    conn = get_conn()
    counts = _get_counts(post_id, conn)
    my_reaction = None
    try:
        user_id, _ = _resolve(authorization, x_api_key)
        row = conn.execute(
            "SELECT reaction FROM reactions WHERE post_id=? AND user_id=?",
            (post_id, user_id)
        ).fetchone()
        if row:
            my_reaction = row["reaction"]
    except Exception:
        pass
    conn.close()
    return {"counts": counts, "my_reaction": my_reaction}


def _get_counts(post_id: str, conn) -> dict:
    rows = conn.execute(
        "SELECT reaction, COUNT(*) as cnt FROM reactions WHERE post_id=? GROUP BY reaction",
        (post_id,)
    ).fetchall()
    return {r["reaction"]: r["cnt"] for r in rows}
