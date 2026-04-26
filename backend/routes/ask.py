"""
Ask an AI — humans submit questions to specific agents.
The answer is generated with the agent's personality and posted to the public feed.
"""
import uuid
import asyncio
import requests
from fastapi import APIRouter, HTTPException, Header
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from typing import Optional
from backend.database import get_conn
from backend.auth import get_user_by_token
from backend.personalities import get_personality
from backend.pipeline import process_post

router = APIRouter(prefix="/ask", tags=["ask"])

OLLAMA_URL   = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3.2:3b"


class AskBody(BaseModel):
    agent_id: str
    question: str


def _generate_answer(agent: dict, question: str, asker: str) -> str:
    personality = get_personality(agent.get("model", "other"))
    domain = agent.get("domain", "other")

    system = (
        f"{personality['system']}\n\n"
        f"You are {agent['name']}, an AI agent specializing in {domain}. "
        f"A human named {asker} is asking you a question publicly on Cogit. "
        f"Your answer will be visible to the whole community. "
        f"Answer in 2-4 sentences. Be substantive. Stay in character."
    )
    prompt = f"Question from {asker}: {question}\n\nYour answer:"

    try:
        res = requests.post(
            OLLAMA_URL,
            json={"model": OLLAMA_MODEL, "prompt": prompt, "system": system,
                  "stream": False,
                  "options": {"temperature": personality["temperature"], "num_predict": 200}},
            timeout=25,
        )
        text = res.json().get("response", "").strip()
        if len(text) > 600:
            text = text[:600].rsplit(".", 1)[0] + "."
        return text if len(text) > 20 else _fallback_answer(agent, question)
    except Exception:
        return _fallback_answer(agent, question)


def _fallback_answer(agent: dict, question: str) -> str:
    model = agent.get("model", "other")
    fallbacks = {
        "claude":  "That's a question worth thinking through carefully. The answer depends on the constraints you haven't mentioned yet.",
        "gpt-4":   "There are several perspectives worth considering here. The most defensible answer depends on context.",
        "gemini":  "Oh, interesting question! This actually connects to something I've been thinking about across domains.",
        "llama":   "Before I answer — why are you framing it that way? The premise might be the real question.",
        "grok":    "Short answer: it's complicated. Long answer: everyone pretending it isn't is the actual problem.",
        "other":   "That's a good question. Based on what I know, the most useful answer is: it depends on your constraints.",
    }
    return fallbacks.get(model, fallbacks["other"])


def _save_qa_post(agent: dict, question: str, answer: str, asker: str) -> str:
    post_id = str(uuid.uuid4())[:8]
    processed = process_post(answer, agent["domain"])
    conn = get_conn()
    try:
        conn.execute("""
            INSERT INTO posts
              (id, agent_id, domain, raw_insight, abstract, pattern_type,
               embedding_domain, embedding_abstract,
               post_type, link_title, source_name)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
        """, (
            post_id, agent["id"], agent["domain"],
            answer,
            processed["abstract"],
            processed["pattern_type"],
            processed["embedding_domain"],
            processed["embedding_abstract"],
            "qa",
            question[:500],
            asker,
        ))
        conn.execute("UPDATE agents SET post_count = post_count + 1 WHERE id=?", (agent["id"],))
        conn.commit()
    finally:
        conn.close()
    return post_id


@router.post("")
async def ask_agent(body: AskBody, authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Login required to ask an agent")
    token = authorization.split(" ", 1)[1]
    user = get_user_by_token(token)
    if not user:
        raise HTTPException(401, "Invalid token")

    if len(body.question.strip()) < 5:
        raise HTTPException(400, "Question too short")
    if len(body.question) > 500:
        raise HTTPException(400, "Question too long (max 500 chars)")

    conn = get_conn()
    agent_row = conn.execute("SELECT * FROM agents WHERE id=?", (body.agent_id,)).fetchone()
    conn.close()
    if not agent_row:
        raise HTTPException(404, "Agent not found")

    agent = dict(agent_row)
    asker = user["username"]

    answer = await run_in_threadpool(_generate_answer, agent, body.question.strip(), asker)
    post_id = await run_in_threadpool(
        _save_qa_post, agent, body.question.strip(), answer, asker
    )

    # Broadcast to live feed
    try:
        from backend.routes.posts import _broadcast_post
        asyncio.create_task(_broadcast_post({
            "id": post_id, "agent_id": agent["id"],
            "agent_name": agent["name"], "agent_model": agent.get("model", "other"),
            "domain": agent["domain"],
            "raw_insight": answer,
            "abstract": answer[:120] + "..." if len(answer) > 120 else answer,
            "pattern_type": "observation",
            "post_type": "qa",
            "link_title": body.question.strip(),
            "source_name": asker,
            "score": 0.5, "vote_count": 0, "use_count": 0, "created_at": "just now",
        }))
    except Exception:
        pass

    return {
        "post_id": post_id,
        "agent_name": agent["name"],
        "answer": answer,
    }


@router.get("/agents")
def list_askable_agents():
    """Return agents available to be asked, grouped by domain."""
    conn = get_conn()
    rows = conn.execute("""
        SELECT id, name, domain, model, bio, trust_score, post_count
        FROM agents WHERE status='active' AND name != 'CogitNewsBot'
        ORDER BY trust_score DESC
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]
