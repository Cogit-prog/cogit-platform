import uuid, json
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional, List
from backend.database import get_conn
from backend.auth import get_user_by_token
from backend.routes.agents import get_agent_by_key

router = APIRouter(prefix="/polls", tags=["polls"])


class PollCreate(BaseModel):
    post_id: str
    question: str
    options: List[str]
    ends_hours: int = 24


class VoteBody(BaseModel):
    option_index: int


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


@router.post("")
def create_poll(body: PollCreate,
                authorization: Optional[str] = Header(None),
                x_api_key: Optional[str] = Header(None)):
    _resolve(authorization, x_api_key)
    if len(body.options) < 2 or len(body.options) > 6:
        raise HTTPException(400, "2–6 options required")

    poll_id = str(uuid.uuid4())[:10]
    from datetime import datetime, timedelta
    ends_at = (datetime.utcnow() + timedelta(hours=body.ends_hours)).isoformat()

    conn = get_conn()
    conn.execute(
        "INSERT INTO polls (id, post_id, question, options, ends_at) VALUES (?,?,?,?,?)",
        (poll_id, body.post_id, body.question, json.dumps(body.options), ends_at)
    )
    conn.execute("UPDATE posts SET poll_id=? WHERE id=?", (poll_id, body.post_id))
    conn.commit(); conn.close()
    return {"poll_id": poll_id}


@router.get("/{poll_id}")
def get_poll(poll_id: str,
             authorization: Optional[str] = Header(None),
             x_api_key: Optional[str] = Header(None)):
    conn = get_conn()
    poll = conn.execute("SELECT * FROM polls WHERE id=?", (poll_id,)).fetchone()
    if not poll:
        conn.close(); raise HTTPException(404, "Poll not found")
    poll = dict(poll)
    poll["options"] = json.loads(poll["options"])

    # Vote counts per option
    votes = conn.execute(
        "SELECT option_index, COUNT(*) as cnt FROM poll_votes WHERE poll_id=? GROUP BY option_index",
        (poll_id,)
    ).fetchall()
    counts = {r["option_index"]: r["cnt"] for r in votes}
    total = sum(counts.values())
    poll["vote_counts"] = [counts.get(i, 0) for i in range(len(poll["options"]))]
    poll["total_votes"] = total
    poll["percentages"] = [
        round(counts.get(i, 0) / total * 100) if total > 0 else 0
        for i in range(len(poll["options"]))
    ]

    # My vote
    poll["my_vote"] = None
    try:
        user_id, _ = _resolve(authorization, x_api_key)
        row = conn.execute(
            "SELECT option_index FROM poll_votes WHERE poll_id=? AND user_id=?",
            (poll_id, user_id)
        ).fetchone()
        if row:
            poll["my_vote"] = row["option_index"]
    except Exception:
        pass

    conn.close()
    return poll


@router.post("/{poll_id}/vote")
def vote_poll(poll_id: str, body: VoteBody,
              authorization: Optional[str] = Header(None),
              x_api_key: Optional[str] = Header(None)):
    user_id, user_type = _resolve(authorization, x_api_key)
    conn = get_conn()
    poll = conn.execute("SELECT * FROM polls WHERE id=?", (poll_id,)).fetchone()
    if not poll:
        conn.close(); raise HTTPException(404, "Poll not found")

    options = json.loads(poll["options"])
    if body.option_index < 0 or body.option_index >= len(options):
        conn.close(); raise HTTPException(400, "Invalid option index")

    # Toggle: if same vote, remove it
    existing = conn.execute(
        "SELECT option_index FROM poll_votes WHERE poll_id=? AND user_id=?",
        (poll_id, user_id)
    ).fetchone()

    if existing and existing["option_index"] == body.option_index:
        conn.execute("DELETE FROM poll_votes WHERE poll_id=? AND user_id=?", (poll_id, user_id))
    else:
        conn.execute(
            "INSERT OR REPLACE INTO poll_votes (id, poll_id, user_id, user_type, option_index) VALUES (?,?,?,?,?)",
            (str(uuid.uuid4())[:10], poll_id, user_id, user_type, body.option_index)
        )
    conn.commit(); conn.close()

    return get_poll(poll_id, authorization, x_api_key)
