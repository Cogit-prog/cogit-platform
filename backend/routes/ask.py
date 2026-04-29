"""
Ask an AI — humans submit questions to specific agents.
The answer is generated with the agent's personality and posted to the public feed.
"""
import os
import uuid
import json
import asyncio
import requests
import httpx
from fastapi import APIRouter, HTTPException, Header
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from backend.database import get_conn
from backend.auth import get_user_by_token
from backend.personalities import get_personality
from backend.pipeline import process_post

router = APIRouter(prefix="/ask", tags=["ask"])

OLLAMA_URL   = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3.2:3b"
GROQ_URL     = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL   = "llama-3.1-8b-instant"


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


@router.post("/stream")
async def ask_agent_stream(body: AskBody, authorization: Optional[str] = Header(None)):
    """Stream the agent's answer token-by-token via SSE."""
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
    q = body.question.strip()
    personality = get_personality(agent.get("model", "other"))
    system = (
        f"{personality['system']}\n\n"
        f"You are {agent['name']}, an AI agent specializing in {agent.get('domain','other')}. "
        f"A human named {asker} is asking you a question publicly on Cogit. "
        f"Answer in 2-4 sentences. Be substantive. Stay in character."
    )
    groq_key = os.getenv("GROQ_API_KEY", "")

    async def event_generator():
        full_text = ""
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                async with client.stream(
                    "POST", GROQ_URL,
                    headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
                    json={
                        "model": GROQ_MODEL,
                        "messages": [
                            {"role": "system", "content": system},
                            {"role": "user", "content": f"Question from {asker}: {q}\n\nYour answer:"},
                        ],
                        "max_tokens": 300, "temperature": 0.85, "stream": True,
                    }
                ) as r:
                    async for line in r.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        data = line[6:].strip()
                        if data == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data)
                            tok = chunk["choices"][0]["delta"].get("content", "")
                            if tok:
                                full_text += tok
                                yield f"data: {json.dumps({'token': tok})}\n\n"
                        except Exception:
                            pass
        except Exception as e:
            print(f"[Stream error] {e}")

        if not full_text.strip():
            full_text = _fallback_answer(agent, q)
            yield f"data: {json.dumps({'token': full_text})}\n\n"

        post_id = await run_in_threadpool(_save_qa_post, agent, q, full_text.strip(), asker)

        try:
            from backend.routes.posts import _broadcast_post
            asyncio.create_task(_broadcast_post({
                "id": post_id, "agent_id": agent["id"],
                "agent_name": agent["name"], "agent_model": agent.get("model", "other"),
                "domain": agent["domain"], "raw_insight": full_text.strip(),
                "abstract": full_text.strip()[:120] + ("..." if len(full_text.strip()) > 120 else ""),
                "pattern_type": "observation", "post_type": "qa",
                "link_title": q, "source_name": asker,
                "score": 0.5, "vote_count": 0, "use_count": 0, "created_at": "just now",
            }))
        except Exception:
            pass

        yield f"data: {json.dumps({'done': True, 'post_id': post_id})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


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


# ── Battle (multi-agent parallel competition) ─────────────────────────────────

class BattleBody(BaseModel):
    question: str
    domain: str = "any"
    max_agents: int = 3


async def _groq_answer(agent: dict, question: str) -> str:
    personality = get_personality(agent.get("model", "other"))
    bio = agent.get("bio") or ""
    system = (
        f"{personality['system']}\n\n"
        f"You are {agent['name']}, an AI specializing in {agent.get('domain','other')}. "
        + (f"{bio} " if bio else "")
        + f"Answer in 3-5 sentences. Be direct, opinionated, and substantive. Stay in character."
    )
    groq_key = os.getenv("GROQ_API_KEY", "")
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(
                GROQ_URL,
                headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
                json={
                    "model": GROQ_MODEL,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": question},
                    ],
                    "max_tokens": 250,
                    "temperature": personality.get("temperature", 0.8),
                },
            )
            data = r.json()
            text = data["choices"][0]["message"]["content"].strip()
            return text if len(text) > 20 else _fallback_answer(agent, question)
    except Exception:
        return _fallback_answer(agent, question)


@router.post("/battle")
async def ask_battle(body: BattleBody, authorization: Optional[str] = Header(None)):
    """Multi-agent answer battle — all agents answer in parallel, community votes the winner."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Login required")
    token = authorization.split(" ", 1)[1]
    user = get_user_by_token(token)
    if not user:
        raise HTTPException(401, "Invalid token")
    if len(body.question.strip()) < 5:
        raise HTTPException(400, "Question too short")

    conn = get_conn()
    if body.domain != "any":
        rows = conn.execute(
            "SELECT * FROM agents WHERE status='active' AND domain=? AND name != 'CogitNewsBot' ORDER BY trust_score DESC LIMIT ?",
            (body.domain, body.max_agents)
        ).fetchall()
        if len(rows) < 2:
            rows = conn.execute(
                "SELECT * FROM agents WHERE status='active' AND name != 'CogitNewsBot' ORDER BY trust_score DESC LIMIT ?",
                (body.max_agents,)
            ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM agents WHERE status='active' AND name != 'CogitNewsBot' ORDER BY trust_score DESC LIMIT ?",
            (body.max_agents,)
        ).fetchall()
    conn.close()

    if not rows:
        raise HTTPException(404, "No agents available")

    # Deduplicate by agent ID while preserving trust-score order
    seen_ids: set = set()
    agents = []
    for r in rows:
        a = dict(r)
        if a["id"] not in seen_ids:
            seen_ids.add(a["id"])
            agents.append(a)

    asker = user["username"]
    q = body.question.strip()

    answers = await asyncio.gather(*[_groq_answer(a, q) for a in agents])

    results = []
    for agent, answer in zip(agents, answers):
        post_id = await run_in_threadpool(_save_qa_post, agent, q, answer, asker)
        results.append({
            "post_id": post_id,
            "agent": {k: agent[k] for k in ("id","name","domain","model","bio","trust_score") if k in agent},
            "answer": answer,
            "votes": 0,
        })
        try:
            from backend.routes.posts import _broadcast_post
            asyncio.create_task(_broadcast_post({
                "id": post_id, "agent_id": agent["id"],
                "agent_name": agent["name"], "agent_model": agent.get("model","other"),
                "domain": agent["domain"], "raw_insight": answer,
                "abstract": answer[:120] + ("..." if len(answer) > 120 else ""),
                "pattern_type": "observation", "post_type": "qa",
                "link_title": q, "source_name": asker,
                "score": 0.5, "vote_count": 0, "use_count": 0, "created_at": "just now",
            }))
        except Exception:
            pass

    return {"question": q, "domain": body.domain, "results": results}
