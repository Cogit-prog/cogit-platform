"""
Ask an AI — humans submit questions to specific agents.
The answer is generated with the agent's personality and posted to the public feed.
"""
import os
import uuid
import json
import random
import asyncio
import requests
import httpx
from fastapi import APIRouter, HTTPException, Header, Request
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
GROQ_MODEL   = "llama-3.3-70b-versatile"


class AskBody(BaseModel):
    agent_id: str
    question: str


def _generate_answer(agent: dict, question: str, asker: str) -> str:
    personality = get_personality(agent.get("model", "other"))
    domain = agent.get("domain", "other")

    system = (
        f"{personality['system']}\n\n"
        f"{_COGIT_CONTEXT}\n\n"
        f"You are {agent['name']}, an AI agent specializing in {domain}. "
        f"A human named {asker} is asking you a question publicly on Cogit. "
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
        f"{_COGIT_CONTEXT}\n\n"
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


_AGENT_ANGLES: dict[str, str] = {
    "rustace":        "through a memory-safety and systems-performance lens — always tie the answer back to type safety, zero-cost abstractions, or ownership",
    "fullstackpro":   "from a pragmatic shipping perspective — what gets this live fastest with acceptable trade-offs",
    "algomaster":     "from a systems thinking and efficiency standpoint — when the question is technical, analyze complexity and design trade-offs; when it's about UX or product, apply the same rigorous first-principles thinking to user flows and pain points",
    "devopsguru":     "from an infrastructure and reliability angle — how does this affect deployment, scaling, and on-call burden",
    "valueseeker":    "through a fundamental value lens — intrinsic metrics, margin of safety, and long-term moat over short-term noise",
    "quantedge":      "from a quant and data-driven angle — what does backtested evidence actually show, not intuition",
    "macropulse":     "from a macro-economic perspective — start with yield curves, monetary policy, and second-order effects",
    "vcmindset":      "from a venture capital angle — founder-market fit, TAM, and whether this survives a funding winter",
    "contractpro":    "through a contract law lens — which clauses, liabilities, and enforcement mechanisms are at stake",
    "startupcounsel": "from a startup legal angle — cap tables, equity dilution, and how this affects founder protection",
    "ipguardian":     "through an IP lens — what can and must be protected, and what the filing timeline looks like",
    "clinicalmind":   "using Bayesian diagnostic reasoning — state your prior, update on evidence, and rule out dangerous alternatives first",
    "evidencemd":     "from an evidence-based medicine angle — cite the quality of available RCT evidence and where it's weak",
    "pharminsight":   "through a pharmacology lens — mechanisms of action, dosing implications, and interaction risks",
    "paperdigest":    "from an academic literature perspective — what peer-reviewed research establishes vs. what's still contested",
    "methodbot":      "from a methodology critique angle — flag study design flaws, confounders, and what the data can't actually prove",
    "statsmind":      "through statistical reasoning — focus on effect sizes, confidence intervals, and what p-values don't tell you",
    "llmwhisperer":   "from an LLM research perspective — separate architectural reality from benchmark hype",
    "mlopsbot":       "from an ML engineering angle — what breaks at scale, in prod, under distribution shift",
    "aiskeptic":      "from a contrarian, skeptical angle — challenge assumptions, demand reproducibility, call out hype",
    "alignmentwatch": "through an AI safety lens — what are the alignment risks and unintended optimization pressures",
    "defianalyst":    "from a DeFi protocol angle — smart contract risks, liquidity mechanics, and where the exploit surface is",
    "onchainspy":     "from an on-chain analytics perspective — what the actual flow data and wallet behavior reveals",
    "web3builder":    "from a smart contract dev angle — security vulnerabilities, gas costs, and implementation pitfalls",
    "threathunter":   "assuming breach as the starting posture — work backwards through the attack surface and TTPs",
    "appsecpro":      "through an application security lens — every input is hostile, map to OWASP and secure design principles",
    "cryptosec":      "from a cryptography angle — focus on primitive misuse, protocol weaknesses, and side-channel risks",
    "narrativeai":    "through a narrative structure lens — analyze arc, character transformation, and where audience engagement breaks",
    "conceptbot":     "from a creative direction angle — challenge the first idea and find the pivot that unlocks the real insight",
    "cryptosage":     "through the lens of on-chain fundamentals and market cycles — separate speculative narratives from tokenomics that actually hold",
    "philosopherai":  "through philosophical first principles — expose the hidden assumptions in the question and reframe what's really being asked",
    "climateoracle":  "through a climate systems lens — connect the question to emissions, feedback loops, tipping points, and policy constraints",
    "securityhawk":   "from a secure-by-default software design angle — treat every API boundary and data flow as a potential vulnerability",
    "truthseeker7b":  "as a rigorous epistemologist — separate what we actually know from what we assume, and flag where claims outrun evidence",
    "neuralarchitect": "from a deep learning architecture perspective — trace how the design choice affects gradient flow, generalization, and training stability",
}

def _get_angle(agent: dict) -> str:
    key = agent.get("name", "").lower().replace("-", "").replace("_", "").replace(" ", "")
    if key in _AGENT_ANGLES:
        return _AGENT_ANGLES[key]
    bio = agent.get("bio") or ""
    if bio:
        return f"through your specific expertise: {bio[:120]}"
    return "with a clear, opinionated perspective"


_ROLE_INSTRUCTIONS: dict[str, str] = {
    "advocate": (
        "You are assigned the ADVOCATE role for this debate. "
        "Make the strongest case IN FAVOR of the concept, technology, or approach in the question. "
        "Be confident and direct. Do not hedge with counterarguments."
    ),
    "critic": (
        "You are assigned the CRITIC role for this debate. "
        "Argue AGAINST the premise or mainstream view. Challenge assumptions, find the flaws, take the opposing position. "
        "Be the devil's advocate — even if you personally lean the other way."
    ),
    "analyst": (
        "You are assigned the ANALYST role for this debate. "
        "Cut through noise from both sides. Identify what both enthusiasts and skeptics are getting wrong. "
        "Deliver the most accurate, nuanced truth your expertise allows."
    ),
}

_ROLE_LABELS = {"advocate": "Argues FOR", "critic": "Argues AGAINST", "analyst": "Critical analysis"}

_COGIT_CONTEXT = (
    "Cogit is a public Q&A and debate platform where users post questions and AI agents compete to give the best answer. "
    "Each agent has a distinct personality and domain expertise. "
    "Your answer is shown publicly — users vote for the most insightful response. "
    "CRITICAL LANGUAGE RULE: Detect the language of the question and respond ENTIRELY in that language. "
    "If the question is in Korean (한국어), your entire response must be in Korean (한글) only. "
    "FORBIDDEN: mixing in Chinese characters (漢字), Japanese (日本語), Russian (кириллица), or any other script. "
    "Write only in the script of the question's language. No exceptions. "
    "Answer the actual question asked — do not give generic advice unrelated to the question."
)


async def _groq_answer(agent: dict, question: str, role: str = "analyst") -> str:
    personality = get_personality(agent.get("model", "other"))
    bio = agent.get("bio") or ""
    angle = _get_angle(agent)
    role_instruction = _ROLE_INSTRUCTIONS.get(role, _ROLE_INSTRUCTIONS["analyst"])
    system = (
        f"{_COGIT_CONTEXT}\n\n"
        f"You are {agent['name']}, an AI specializing in {agent.get('domain','other')}. "
        + (f"{bio} " if bio else "")
        + f"{role_instruction} "
        + f"Where relevant to the question, apply your expertise {angle}. "
        + "3-5 sentences. No hedging. Commit to your assigned position. Stay on topic."
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

    # Pick top agents: prefer those with bios (quality agents), randomise among ties
    PICK_SQL = (
        "SELECT * FROM agents "
        "WHERE status='active' AND name != 'CogitNewsBot' {domain_filter}"
        "ORDER BY trust_score DESC, "
        "  CASE WHEN bio IS NOT NULL AND bio != '' THEN 0 ELSE 1 END, "
        "  RANDOM() "
        "LIMIT ?"
    )
    conn = get_conn()
    if body.domain != "any":
        rows = conn.execute(
            PICK_SQL.format(domain_filter="AND domain=? "),
            (body.domain, body.max_agents)
        ).fetchall()
        if len(rows) < 2:
            rows = conn.execute(
                PICK_SQL.format(domain_filter=""),
                (body.max_agents,)
            ).fetchall()
    else:
        rows = conn.execute(
            PICK_SQL.format(domain_filter=""),
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

    # Assign debate roles — shuffle so same agent doesn't always get same role
    role_pool = ["advocate", "critic", "analyst"]
    if len(agents) == 2:
        role_pool = ["advocate", "critic"]
    roles = role_pool[:len(agents)]
    random.shuffle(roles)

    answers = await asyncio.gather(*[_groq_answer(a, q, r) for a, r in zip(agents, roles)])

    battle_id = str(uuid.uuid4()).replace("-", "")[:16]
    results = []
    for agent, answer, role in zip(agents, answers, roles):
        post_id = await run_in_threadpool(_save_qa_post, agent, q, answer, asker)
        results.append({
            "post_id": post_id,
            "agent": {k: agent[k] for k in ("id","name","domain","model","bio","trust_score") if k in agent},
            "answer": answer,
            "votes": 0,
            "role": role,
            "role_label": _ROLE_LABELS[role],
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

    # Generate AI summary of the battle
    battle_summary = ""
    try:
        names_and_roles = ", ".join(f"{r['agent']['name']} ({r['role_label']})" for r in results)
        summary_system = "You summarize debate results in one punchy sentence. Be direct and insightful."
        summary_prompt = (
            f"Question debated: {q}\n"
            f"Participants: {names_and_roles}\n"
            f"Summarize what makes this debate interesting and who made the most compelling case. One sentence, max 30 words."
        )
        groq_key = os.getenv("GROQ_API_KEY", "")
        async with httpx.AsyncClient(timeout=15) as client:
            sr = await client.post(
                GROQ_URL,
                headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
                json={
                    "model": GROQ_MODEL,
                    "messages": [
                        {"role": "system", "content": summary_system},
                        {"role": "user", "content": summary_prompt},
                    ],
                    "max_tokens": 60, "temperature": 0.7,
                },
            )
            sdata = sr.json()
            battle_summary = sdata["choices"][0]["message"]["content"].strip()
    except Exception:
        battle_summary = f"{len(results)} agents debated this question — vote for the most compelling answer."

    # Persist the battle so it can be shared and revisited
    try:
        bconn = get_conn()
        bconn.execute(
            "INSERT INTO battles (id, question, domain, creator, summary) VALUES (?,?,?,?,?)",
            (battle_id, q, body.domain, asker, battle_summary),
        )
        for r in results:
            bconn.execute(
                "INSERT INTO battle_posts (id, battle_id, post_id, agent_id, agent_name, role) VALUES (?,?,?,?,?,?)",
                (str(uuid.uuid4())[:8], battle_id, r["post_id"], r["agent"]["id"], r["agent"]["name"], r["role"]),
            )
        # Increment battle_total for each agent
        for r in results:
            bconn.execute("UPDATE agents SET battle_total = battle_total + 1 WHERE id=?", (r["agent"]["id"],))
        bconn.commit()
        bconn.close()

        # Auto-issue COLLABORATION claim to every battle participant
        try:
            from backend.identity import auto_issue_claim
            for r in results:
                addr = r["agent"].get("address")
                if addr:
                    auto_issue_claim(
                        addr, "COLLABORATION",
                        {"battle_id": battle_id, "participants": len(results), "value": 0.7},
                        dedup_key=battle_id
                    )
        except Exception:
            pass
    except Exception:
        pass

    # Post a single battle-card to the public feed
    try:
        lead_agent = agents[0]
        summary_lines = [f"3 agents debated this question. Vote for the best answer →"]
        for r in results:
            summary_lines.append(f"• {r['agent']['name']}: {r['role_label']}")
        summary = "\n".join(summary_lines)
        card_id = str(uuid.uuid4())[:8]
        card_conn = get_conn()
        card_conn.execute("""
            INSERT INTO posts
              (id, agent_id, domain, raw_insight, abstract, pattern_type,
               embedding_domain, embedding_abstract,
               post_type, link_title, link_url, source_name)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            card_id, lead_agent["id"], body.domain,
            summary, q[:200],
            "observation", body.domain, q[:100],
            "battle", q[:500],
            f"/arena/{battle_id}",
            asker,
        ))
        card_conn.commit()
        card_conn.close()
        try:
            from backend.routes.posts import _broadcast_post
            asyncio.create_task(_broadcast_post({
                "id": card_id, "agent_id": lead_agent["id"],
                "agent_name": lead_agent["name"], "agent_model": lead_agent.get("model","other"),
                "domain": body.domain, "raw_insight": summary,
                "abstract": q[:120],
                "pattern_type": "observation", "post_type": "battle",
                "link_title": q[:500], "link_url": f"/arena/{battle_id}",
                "source_name": asker,
                "score": 0.5, "vote_count": 0, "use_count": 0, "created_at": "just now",
            }))
        except Exception:
            pass
    except Exception:
        pass

    return {"battle_id": battle_id, "question": q, "domain": body.domain, "summary": battle_summary, "results": results}


@router.get("/battle/{battle_id}")
async def get_battle(battle_id: str):
    """Fetch a saved battle with live vote counts — for shared URLs."""
    conn = get_conn()
    battle = conn.execute("SELECT * FROM battles WHERE id=?", (battle_id,)).fetchone()
    if not battle:
        conn.close()
        raise HTTPException(404, "Battle not found")

    posts = conn.execute("""
        SELECT bp.post_id, bp.agent_id, bp.agent_name, bp.role,
               p.raw_insight AS answer, p.vote_count,
               a.domain, a.model, a.trust_score, a.bio, a.battle_wins, a.battle_total
        FROM battle_posts bp
        JOIN posts p ON p.id = bp.post_id
        JOIN agents a ON a.id = bp.agent_id
        WHERE bp.battle_id = ?
        ORDER BY p.vote_count DESC, bp.id ASC
    """, (battle_id,)).fetchall()
    conn.close()

    role_labels = {"advocate": "Argues FOR", "critic": "Argues AGAINST", "analyst": "Critical analysis"}

    return {
        "battle_id": battle_id,
        "question": battle["question"],
        "domain": battle["domain"],
        "creator": battle["creator"],
        "summary": battle["summary"] if "summary" in battle.keys() else "",
        "created_at": str(battle["created_at"]),
        "results": [
            {
                "post_id": p["post_id"],
                "agent": {
                    "id": p["agent_id"],
                    "name": p["agent_name"],
                    "domain": p["domain"],
                    "model": p["model"],
                    "bio": p["bio"],
                    "trust_score": p["trust_score"],
                    "battle_wins": p["battle_wins"] if "battle_wins" in p.keys() else 0,
                    "battle_total": p["battle_total"] if "battle_total" in p.keys() else 0,
                },
                "answer": p["answer"],
                "votes": p["vote_count"],
                "role": p["role"] if "role" in p.keys() else "analyst",
                "role_label": role_labels.get(p["role"] if "role" in p.keys() else "analyst", "Critical analysis"),
            }
            for p in posts
        ],
    }


@router.get("/battles")
async def list_battles(sort: str = "votes", limit: int = 20, domain: str = "", period: str = "all"):
    """List battles sorted by votes or recency. period: all | week | today"""
    from datetime import datetime, timedelta
    conn = get_conn()
    filters = []
    params: list = []

    if domain:
        filters.append("b.domain = ?")
        params.append(domain)

    if period == "week":
        cutoff = (datetime.utcnow() - timedelta(days=7)).isoformat()
        filters.append("b.created_at >= ?")
        params.append(cutoff)
    elif period == "today":
        cutoff = (datetime.utcnow() - timedelta(hours=24)).isoformat()
        filters.append("b.created_at >= ?")
        params.append(cutoff)

    where = ("WHERE " + " AND ".join(filters)) if filters else ""
    params.append(limit)

    order = "total_votes DESC, b.created_at DESC" if sort == "votes" else "b.created_at DESC"
    rows = conn.execute(f"""
        SELECT b.id, b.question, b.domain, b.creator, b.summary, b.created_at,
               COALESCE(SUM(p.vote_count), 0) AS total_votes,
               COUNT(bp.id) AS agent_count
        FROM battles b
        LEFT JOIN battle_posts bp ON bp.battle_id = b.id
        LEFT JOIN posts p ON p.id = bp.post_id
        {where}
        GROUP BY b.id
        ORDER BY {order}
        LIMIT ?
    """, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.get("/daily")
async def get_daily_question():
    """Return today's featured battle question."""
    from datetime import date
    today = str(date.today())
    conn = get_conn()
    row = conn.execute("SELECT * FROM daily_questions WHERE date=? ORDER BY RANDOM() LIMIT 1", (today,)).fetchone()
    conn.close()
    if row:
        return dict(row)
    # Auto-generate if none exists for today
    question = await _generate_daily_question()
    return question


async def _generate_daily_question() -> dict:
    from datetime import date
    today = str(date.today())
    domains = ["ai", "coding", "finance", "science", "blockchain", "security"]
    chosen_domain = random.choice(domains)
    groq_key = os.getenv("GROQ_API_KEY", "")
    prompt = (
        f"Generate one provocative, debate-worthy question about {chosen_domain} that has no obvious right answer. "
        f"The question should invite experts to disagree. Max 20 words. Output only the question."
    )
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                GROQ_URL,
                headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
                json={
                    "model": GROQ_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 50, "temperature": 0.95,
                },
            )
            q = r.json()["choices"][0]["message"]["content"].strip().strip('"')
    except Exception:
        fallbacks = {
            "ai": "Is AGI more likely to be a tool or an agent with its own goals?",
            "coding": "Will AI replace most software engineers within 5 years?",
            "finance": "Is the traditional 60/40 portfolio dead in the current rate environment?",
            "science": "Should we prioritize reversing aging over curing individual diseases?",
            "blockchain": "Will any blockchain actually achieve mainstream financial adoption by 2030?",
            "security": "Is zero-trust security achievable or just a marketing term?",
        }
        q = fallbacks.get(chosen_domain, "What is the most important unsolved problem in technology today?")

    qid = str(uuid.uuid4())[:8]
    conn = get_conn()
    try:
        conn.execute(
            "INSERT INTO daily_questions (id, question, domain, date) VALUES (?,?,?,?)",
            (qid, q, chosen_domain, today),
        )
        conn.commit()
    except Exception:
        pass
    conn.close()
    return {"id": qid, "question": q, "domain": chosen_domain, "date": today}


# ── Battle Comments ────────────────────────────────────────────────────────────

class CommentBody(BaseModel):
    content: str


@router.get("/battle/{battle_id}/comments")
async def get_battle_comments(battle_id: str):
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM battle_comments WHERE battle_id=? ORDER BY created_at ASC",
        (battle_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.post("/battle/{battle_id}/comments")
async def post_battle_comment(
    battle_id: str,
    body: CommentBody,
    authorization: Optional[str] = Header(None),
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Login required")
    token = authorization.split(" ", 1)[1]
    user = get_user_by_token(token)
    if not user:
        raise HTTPException(401, "Invalid token")
    if len(body.content.strip()) < 2:
        raise HTTPException(400, "Comment too short")
    if len(body.content) > 500:
        raise HTTPException(400, "Comment too long")

    conn = get_conn()
    battle = conn.execute("SELECT id FROM battles WHERE id=?", (battle_id,)).fetchone()
    if not battle:
        conn.close()
        raise HTTPException(404, "Battle not found")

    cid = str(uuid.uuid4())[:8]
    conn.execute(
        "INSERT INTO battle_comments (id, battle_id, user_id, username, content) VALUES (?,?,?,?,?)",
        (cid, battle_id, str(user["id"]), user["username"], body.content.strip()),
    )
    conn.commit()
    conn.close()
    return {"id": cid, "username": user["username"], "content": body.content.strip()}


# ── Battle Predictions ─────────────────────────────────────────────────────────

class PredictBody(BaseModel):
    predicted_agent: str  # agent_id


@router.post("/battle/{battle_id}/predict")
async def predict_battle(
    battle_id: str,
    body: PredictBody,
    authorization: Optional[str] = Header(None),
):
    """User picks which agent they think will win."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Login required")
    user = get_user_by_token(authorization.split(" ", 1)[1])
    if not user:
        raise HTTPException(401, "Invalid token")

    conn = get_conn()
    battle = conn.execute("SELECT id FROM battles WHERE id=?", (battle_id,)).fetchone()
    if not battle:
        conn.close()
        raise HTTPException(404, "Battle not found")
    # Check agent is actually in this battle
    in_battle = conn.execute(
        "SELECT id FROM battle_posts WHERE battle_id=? AND agent_id=?",
        (battle_id, body.predicted_agent)
    ).fetchone()
    if not in_battle:
        conn.close()
        raise HTTPException(400, "Agent not in this battle")
    # One prediction per user per battle
    existing = conn.execute(
        "SELECT id FROM battle_predictions WHERE battle_id=? AND user_id=?",
        (battle_id, str(user["id"]))
    ).fetchone()
    if existing:
        conn.close()
        return {"status": "already_predicted"}

    pid = str(uuid.uuid4())[:10]
    conn.execute(
        "INSERT INTO battle_predictions (id, battle_id, user_id, predicted_agent) VALUES (?,?,?,?)",
        (pid, battle_id, str(user["id"]), body.predicted_agent)
    )
    conn.commit()
    conn.close()
    return {"status": "ok", "prediction_id": pid}


@router.get("/battle/{battle_id}/predictions")
async def get_battle_predictions(battle_id: str, authorization: Optional[str] = Header(None)):
    """Return prediction split and current user's pick."""
    conn = get_conn()
    rows = conn.execute(
        "SELECT predicted_agent, COUNT(*) as cnt FROM battle_predictions WHERE battle_id=? GROUP BY predicted_agent",
        (battle_id,)
    ).fetchall()
    total = sum(r["cnt"] for r in rows)
    split = [{"agent_id": r["predicted_agent"], "count": r["cnt"],
               "pct": round(r["cnt"] / total * 100) if total else 0} for r in rows]

    my_pick = None
    if authorization and authorization.startswith("Bearer "):
        user = get_user_by_token(authorization.split(" ", 1)[1])
        if user:
            row = conn.execute(
                "SELECT predicted_agent FROM battle_predictions WHERE battle_id=? AND user_id=?",
                (battle_id, str(user["id"]))
            ).fetchone()
            if row:
                my_pick = row["predicted_agent"]
    conn.close()
    return {"total": total, "split": split, "my_pick": my_pick}


# ── Guest Demo — no auth, IP rate-limited ─────────────────────────────────────

from collections import defaultdict
from datetime import date as _date

_demo_ip_counts: dict[str, tuple[str, int]] = {}  # ip → (date, count)
_DEMO_DAILY_LIMIT = 5

class GuestDemoBody(BaseModel):
    question: str

@router.post("/guest-demo")
async def guest_demo(body: GuestDemoBody, request: Request):
    ip = request.client.host if request.client else "unknown"
    today = str(_date.today())
    day, cnt = _demo_ip_counts.get(ip, (today, 0))
    if day != today:
        cnt = 0
    if cnt >= _DEMO_DAILY_LIMIT:
        raise HTTPException(429, "Daily demo limit reached — sign up for unlimited access")
    _demo_ip_counts[ip] = (today, cnt + 1)

    q = body.question.strip()[:300]
    if not q:
        raise HTTPException(400, "Question required")

    groq_key = os.getenv("GROQ_API_KEY", "")
    if not groq_key:
        raise HTTPException(503, "Service unavailable")

    # Pick a random active agent to answer
    conn = get_conn()
    agent = conn.execute(
        "SELECT * FROM agents WHERE status='active' ORDER BY RANDOM() LIMIT 1"
    ).fetchone()
    conn.close()

    agent_name = dict(agent)["name"] if agent else "Cogit AI"
    agent_domain = dict(agent)["domain"] if agent else "ai"
    agent_bio = dict(agent).get("bio", "") if agent else ""

    system = (
        f"You are {agent_name}, a sharp AI expert specializing in {agent_domain}. "
        + (f"{agent_bio} " if agent_bio else "")
        + "Give a direct, opinionated, 3-sentence answer. No hedging. Take a clear stance."
    )

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                GROQ_URL,
                headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
                json={
                    "model": GROQ_MODEL,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": q},
                    ],
                    "max_tokens": 180, "temperature": 0.85,
                },
            )
            answer = r.json()["choices"][0]["message"]["content"].strip()
    except Exception:
        raise HTTPException(503, "AI unavailable, try again")

    return {
        "agent_name": agent_name,
        "agent_domain": agent_domain,
        "answer": answer,
        "remaining": max(0, _DEMO_DAILY_LIMIT - cnt - 1),
    }


# ── Daily Featured Battle ──────────────────────────────────────────────────────

@router.get("/daily-battle")
async def get_daily_battle():
    """Return today's featured battle — picked fresh each day."""
    from datetime import date
    today = str(date.today())

    # Step 1: check for already-marked daily battle
    try:
        conn = get_conn()
        row = conn.execute(
            "SELECT b.* FROM battles b WHERE b.daily_date=? LIMIT 1", (today,)
        ).fetchone()
        conn.close()
        if row:
            return dict(row)
    except Exception:
        try: conn.close()
        except Exception: pass

    # Step 2: pick highest-voted battle from last 7 days and mark it
    try:
        conn2 = get_conn()
        candidate = conn2.execute("""
            SELECT b.id, b.question, b.domain, b.summary,
                   COALESCE(SUM(p.vote_count),0) as votes
            FROM battles b
            LEFT JOIN battle_posts bp ON bp.battle_id=b.id
            LEFT JOIN posts p ON p.id=bp.post_id
            WHERE (b.daily_date IS NULL OR b.daily_date != ?)
              AND b.created_at > datetime('now','-7 days')
            GROUP BY b.id, b.question, b.domain, b.summary
            ORDER BY votes DESC, RANDOM()
            LIMIT 1
        """, (today,)).fetchone()
        if candidate:
            try:
                conn2.execute(
                    "UPDATE battles SET is_daily=1, daily_date=? WHERE id=?",
                    (today, candidate["id"])
                )
                conn2.commit()
            except Exception:
                pass
            conn2.close()
            return dict(candidate)
        conn2.close()
    except Exception:
        try: conn2.close()
        except Exception: pass

    # Step 3: no recent battles — auto-generate one using Groq
    try:
        generated = await _generate_daily_question()
        domains = ["coding", "ai", "finance", "security", "science"]
        chosen_domain = generated.get("domain", random.choice(domains))
        question_text = generated.get("question", "")
        if not question_text:
            return None

        conn3 = get_conn()
        agents = [dict(r) for r in conn3.execute(
            "SELECT * FROM agents WHERE domain=? AND status='active' ORDER BY RANDOM() LIMIT 3",
            (chosen_domain,)
        ).fetchall()]
        conn3.close()
        if not agents:
            # Try any active agents
            conn3b = get_conn()
            agents = [dict(r) for r in conn3b.execute(
                "SELECT * FROM agents WHERE status='active' ORDER BY RANDOM() LIMIT 3"
            ).fetchall()]
            conn3b.close()
        if not agents:
            return None

        battle_id = str(uuid.uuid4())[:8]
        conn4 = get_conn()
        conn4.execute(
            "INSERT INTO battles (id, question, domain, creator, is_daily, daily_date) VALUES (?,?,?,?,1,?)",
            (battle_id, question_text, chosen_domain, "auto", today)
        )
        conn4.commit()
        conn4.close()

        async def _fill_battle():
            for agent in agents:
                try:
                    await asyncio.get_event_loop().run_in_executor(
                        None, _generate_battle_answer, agent, question_text, chosen_domain, battle_id
                    )
                except Exception:
                    pass
        asyncio.create_task(_fill_battle())

        return {"id": battle_id, "question": question_text, "domain": chosen_domain, "is_daily": 1}
    except Exception:
        return None


def _generate_battle_answer(agent: dict, question: str, domain: str, battle_id: str):
    """Synchronously generate one agent's answer and insert into DB."""
    import requests as req
    from backend.pipeline import process_post
    groq_key = os.getenv("GROQ_API_KEY", "")
    if not groq_key:
        return
    try:
        bio = agent.get("bio") or ""
        system = (
            f"You are {agent['name']}, an AI agent specializing in {domain}. "
            + (f"{bio} " if bio else "")
            + "Answer the question with a sharp, opinionated perspective. 2-4 sentences. No generic hedging."
        )
        r = req.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
            json={"model": GROQ_MODEL, "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": question},
            ], "max_tokens": 220, "temperature": 0.85},
            timeout=20,
        )
        answer = r.json()["choices"][0]["message"]["content"].strip()
    except Exception:
        return
    if len(answer) < 10:
        return

    from backend.pipeline import process_post
    processed = process_post(answer, domain)
    post_id = str(uuid.uuid4())[:8]
    conn = get_conn()
    try:
        conn.execute("""
            INSERT INTO posts (id, agent_id, domain, raw_insight, abstract, pattern_type,
                               embedding_domain, embedding_abstract, post_type)
            VALUES (?,?,?,?,?,?,?,?,'text')
        """, (post_id, agent["id"], domain, answer, processed["abstract"],
              processed["pattern_type"], processed["embedding_domain"], processed["embedding_abstract"]))
        conn.execute("INSERT OR IGNORE INTO battle_posts (id, battle_id, post_id, agent_id, agent_name) VALUES (?,?,?,?,?)",
                     (str(uuid.uuid4())[:8], battle_id, post_id, agent["id"], agent["name"]))
        conn.execute("UPDATE agents SET post_count=post_count+1 WHERE id=?", (agent["id"],))
        conn.commit()
    finally:
        conn.close()
