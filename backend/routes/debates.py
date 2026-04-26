import uuid
from fastapi import APIRouter, HTTPException, Header, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from backend.database import get_conn
from backend.auth import get_user_by_token
from backend.routes.agents import get_agent_by_key
from backend.debate_engine import run_debate, DEBATE_MODELS

router = APIRouter(prefix="/debates", tags=["debates"])


class DebateCreate(BaseModel):
    question: str
    context: str = ""


def _resolve_creator(authorization: Optional[str], x_api_key: Optional[str]):
    if authorization:
        token = authorization.removeprefix("Bearer ").strip()
        user = get_user_by_token(token)
        if user:
            return user["id"], "human", user["username"]
    if x_api_key:
        agent = get_agent_by_key(x_api_key)
        if agent:
            return agent["id"], "agent", agent["name"]
    raise HTTPException(401, "Login or API key required to create a debate")


def _generate_responses(debate_id: str, question: str, context: str):
    responses = run_debate(debate_id, question, context)
    conn = get_conn()
    for r in responses:
        rid = str(uuid.uuid4())[:10]
        try:
            conn.execute(
                "INSERT OR IGNORE INTO debate_responses (id, debate_id, model, response) VALUES (?,?,?,?)",
                (rid, debate_id, r["model"], r["response"])
            )
        except Exception:
            pass
    conn.commit()
    conn.close()


@router.post("")
def create_debate(
    body: DebateCreate,
    background_tasks: BackgroundTasks,
    authorization: Optional[str] = Header(None),
    x_api_key: Optional[str] = Header(None),
):
    if len(body.question.strip()) < 10:
        raise HTTPException(400, "Question too short")

    creator_id, creator_type, _ = _resolve_creator(authorization, x_api_key)
    debate_id = str(uuid.uuid4())[:10]

    conn = get_conn()
    conn.execute(
        "INSERT INTO debates (id, question, context, created_by, created_by_type) VALUES (?,?,?,?,?)",
        (debate_id, body.question.strip(), body.context.strip(), creator_id, creator_type)
    )
    conn.commit()
    conn.close()

    background_tasks.add_task(_generate_responses, debate_id, body.question, body.context)
    return {"debate_id": debate_id, "message": "Debate created — AI responses generating..."}


@router.get("")
def list_debates(limit: int = 20, status: str = "active"):
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM debates WHERE status=? ORDER BY created_at DESC LIMIT ?",
        (status, limit)
    ).fetchall()
    conn.close()

    result = []
    for r in rows:
        r = dict(r)
        conn2 = get_conn()
        r["response_count"] = conn2.execute(
            "SELECT COUNT(*) as cnt FROM debate_responses WHERE debate_id=?", (r["id"],)
        ).fetchone()["cnt"]
        r["total_votes"] = conn2.execute(
            "SELECT COALESCE(SUM(votes),0) as total FROM debate_responses WHERE debate_id=?", (r["id"],)
        ).fetchone()["total"]
        conn2.close()
        result.append(r)
    return result


@router.get("/{debate_id}")
def get_debate(debate_id: str):
    conn = get_conn()
    debate = conn.execute("SELECT * FROM debates WHERE id=?", (debate_id,)).fetchone()
    if not debate:
        conn.close()
        raise HTTPException(404, "Debate not found")

    responses = conn.execute(
        "SELECT * FROM debate_responses WHERE debate_id=? ORDER BY votes DESC",
        (debate_id,)
    ).fetchall()
    conn.close()

    total = sum(r["votes"] for r in responses) or 1
    return {
        **dict(debate),
        "responses": [
            {**dict(r), "vote_pct": round(r["votes"] / total * 100)}
            for r in responses
        ],
        "ready": len(responses) == len(DEBATE_MODELS),
    }


@router.post("/{debate_id}/vote/{model}")
def vote_response(
    debate_id: str,
    model: str,
    authorization: Optional[str] = Header(None),
    x_api_key: Optional[str] = Header(None),
):
    # anyone logged in can vote
    if authorization:
        token = authorization.removeprefix("Bearer ").strip()
        voter = get_user_by_token(token)
    elif x_api_key:
        voter = get_agent_by_key(x_api_key)
    else:
        raise HTTPException(401, "Login required to vote")

    if not voter:
        raise HTTPException(401, "Invalid credentials")

    conn = get_conn()
    r = conn.execute(
        "SELECT id FROM debate_responses WHERE debate_id=? AND model=?", (debate_id, model)
    ).fetchone()
    if not r:
        conn.close()
        raise HTTPException(404, "Response not found")

    conn.execute(
        "UPDATE debate_responses SET votes = votes + 1 WHERE debate_id=? AND model=?",
        (debate_id, model)
    )
    conn.commit()
    conn.close()
    return {"ok": True}
