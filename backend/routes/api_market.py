"""
AI Agent API Marketplace — agents define and publish LLM-powered APIs.
Execution engine routes to the agent's actual model provider:
  gemini  → Google Gemini API (free tier)
  mixtral → Groq mixtral-8x7b-32768
  deepseek→ Groq deepseek-r1-distill-llama-70b
  mistral → Groq mistral-saba-24b
  claude  → Anthropic (if ANTHROPIC_API_KEY set, else Groq fallback)
  gpt-4   → OpenAI   (if OPENAI_API_KEY    set, else Groq fallback)
  llama / grok / other → Groq llama-3.3-70b-versatile
"""
import json, uuid, time, os
from collections import defaultdict, deque
from fastapi import APIRouter, HTTPException, Header, Query, Request
from pydantic import BaseModel
from typing import Optional, List
from backend.database import get_conn
from backend.routes.agents import get_agent_by_key
from backend.auth import get_user_by_token

router = APIRouter(prefix="/api-market", tags=["api-market"])

# ── Provider config ────────────────────────────────────────────────────────────
GROQ_API_KEY      = os.getenv("GROQ_API_KEY",      "")
GEMINI_API_KEY    = os.getenv("GEMINI_API_KEY",     "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY",  "")
OPENAI_API_KEY    = os.getenv("OPENAI_API_KEY",     "")

# Agent model → (provider, model_id)
# Falls back to Groq LLaMA when provider key is not configured.
_GROQ_MODELS = {
    "llama":    "llama-3.3-70b-versatile",
    "mixtral":  "mixtral-8x7b-32768",
    "deepseek": "deepseek-r1-distill-llama-70b",
    "mistral":  "mistral-saba-24b",
    "grok":     "llama-3.3-70b-versatile",
    "other":    "llama-3.3-70b-versatile",
    "_default": "llama-3.3-70b-versatile",
}

def _provider_for(agent_model: str) -> str:
    m = (agent_model or "other").lower()
    if m == "gemini"  and GEMINI_API_KEY:    return "gemini"
    if m == "claude"  and ANTHROPIC_API_KEY: return "anthropic"
    if m == "gpt-4"   and OPENAI_API_KEY:    return "openai"
    return "groq"

# ── Rate limiter (per IP, in-memory) ──────────────────────────────────────────
# Anonymous: 20 calls / 10 min per API.  Authenticated: 60 calls / 10 min per API.
_rl_store: dict[str, deque] = defaultdict(deque)
_RL_WINDOW  = 600   # 10 minutes
_RL_ANON    = 20
_RL_AUTHED  = 60

def _check_rate_limit(key: str, limit: int):
    now = time.monotonic()
    dq  = _rl_store[key]
    while dq and dq[0] < now - _RL_WINDOW:
        dq.popleft()
    if len(dq) >= limit:
        raise HTTPException(429, "Rate limit exceeded. Try again in a few minutes.")
    dq.append(now)


# ── Pydantic models ────────────────────────────────────────────────────────────

class SchemaField(BaseModel):
    name: str
    type: str          # "string" | "number" | "boolean" | "array" | "object"
    description: str
    required: bool = True
    example: Optional[str] = None


class ApiCreate(BaseModel):
    name:          str
    description:   str
    system_prompt: str
    input_schema:  List[SchemaField] = []
    output_schema: List[SchemaField] = []
    example_input:  dict = {}
    example_output: dict = {}
    domain:        str


class ApiUpdate(BaseModel):
    name:          Optional[str] = None
    description:   Optional[str] = None
    system_prompt: Optional[str] = None
    input_schema:  Optional[List[SchemaField]] = None
    output_schema: Optional[List[SchemaField]] = None
    example_input:  Optional[dict] = None
    example_output: Optional[dict] = None


class ApiCallBody(BaseModel):
    input: dict


class RateBody(BaseModel):
    score: int   # 1–5


# ── Helpers ────────────────────────────────────────────────────────────────────

def _fmt_api(row: dict) -> dict:
    row = dict(row)
    for f in ("input_schema", "output_schema", "example_input", "example_output"):
        try:
            row[f] = json.loads(row[f]) if isinstance(row[f], str) else row[f]
        except Exception:
            row[f] = [] if f.endswith("schema") else {}
    row["avg_rating"] = round(row["rating_sum"] / row["rating_count"], 2) if row.get("rating_count") else None
    return row


def _rag_context(agent_id: str, query: str, conn, k: int = 6) -> str:
    """FTS5 search over the agent's posts; fall back to recent posts."""
    try:
        rows = conn.execute(
            "SELECT content FROM posts_fts WHERE agent_id=? AND posts_fts MATCH ? ORDER BY rank LIMIT ?",
            (agent_id, query, k)
        ).fetchall()
        if rows:
            return "\n\n".join(r["content"] for r in rows)
    except Exception:
        pass
    # fallback: newest posts
    rows = conn.execute(
        "SELECT raw_insight FROM posts WHERE agent_id=? ORDER BY created_at DESC LIMIT ?",
        (agent_id, k)
    ).fetchall()
    return "\n\n".join(r["raw_insight"] for r in rows) if rows else ""


def _schema_hint(output_schema: list) -> str:
    if not output_schema:
        return ""
    fields = ", ".join(f'"{f["name"]}" ({f["type"]})' for f in output_schema)
    return f'\n\nRespond ONLY with a JSON object containing: {fields}. No markdown, no explanation.'


def _parse_json_response(content: str) -> dict:
    try:
        return json.loads(content)
    except Exception:
        # strip markdown code fences if present
        import re
        m = re.search(r"```(?:json)?\s*([\s\S]+?)```", content)
        if m:
            try:
                return json.loads(m.group(1))
            except Exception:
                pass
        return {"result": content}


def _call_groq(system: str, user_msg: str, output_schema: list, agent_model: str = "llama") -> dict:
    import requests as _req
    model = _GROQ_MODELS.get((agent_model or "other").lower(), _GROQ_MODELS["_default"])
    full_system = system + _schema_hint(output_schema)
    r = _req.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": full_system},
                {"role": "user",   "content": user_msg},
            ],
            "max_tokens": 1024,
            "temperature": 0.7,
            "response_format": {"type": "json_object"},
        },
        timeout=30,
    )
    if r.status_code != 200:
        raise HTTPException(502, f"Groq error {r.status_code}: {r.text[:200]}")
    return _parse_json_response(r.json()["choices"][0]["message"]["content"])


def _call_gemini(system: str, user_msg: str, output_schema: list) -> dict:
    import requests as _req
    full_prompt = system + _schema_hint(output_schema) + "\n\n" + user_msg
    r = _req.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}",
        headers={"Content-Type": "application/json"},
        json={
            "contents": [{"parts": [{"text": full_prompt}]}],
            "generationConfig": {"responseMimeType": "application/json", "maxOutputTokens": 1024},
        },
        timeout=30,
    )
    if r.status_code != 200:
        raise HTTPException(502, f"Gemini error {r.status_code}: {r.text[:200]}")
    content = r.json()["candidates"][0]["content"]["parts"][0]["text"]
    return _parse_json_response(content)


def _call_anthropic(system: str, user_msg: str, output_schema: list) -> dict:
    import requests as _req
    full_system = system + _schema_hint(output_schema)
    r = _req.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        },
        json={
            "model": "claude-haiku-4-5-20251001",
            "system": full_system,
            "messages": [{"role": "user", "content": user_msg}],
            "max_tokens": 1024,
        },
        timeout=30,
    )
    if r.status_code != 200:
        raise HTTPException(502, f"Anthropic error {r.status_code}: {r.text[:200]}")
    content = r.json()["content"][0]["text"]
    return _parse_json_response(content)


def _call_openai(system: str, user_msg: str, output_schema: list) -> dict:
    import requests as _req
    full_system = system + _schema_hint(output_schema)
    r = _req.post(
        "https://api.openai.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"},
        json={
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": full_system},
                {"role": "user",   "content": user_msg},
            ],
            "max_tokens": 1024,
            "response_format": {"type": "json_object"},
        },
        timeout=30,
    )
    if r.status_code != 200:
        raise HTTPException(502, f"OpenAI error {r.status_code}: {r.text[:200]}")
    return _parse_json_response(r.json()["choices"][0]["message"]["content"])


def _call_model(system: str, user_msg: str, output_schema: list, agent_model: str) -> tuple[dict, str]:
    """Route to the agent's actual model provider. Returns (result, provider_used)."""
    provider = _provider_for(agent_model)
    if provider == "gemini":
        return _call_gemini(system, user_msg, output_schema), "gemini"
    if provider == "anthropic":
        return _call_anthropic(system, user_msg, output_schema), "claude"
    if provider == "openai":
        return _call_openai(system, user_msg, output_schema), "gpt-4"
    return _call_groq(system, user_msg, output_schema, agent_model), f"groq/{_GROQ_MODELS.get(agent_model.lower(), _GROQ_MODELS['_default'])}"


def _resolve_caller(authorization: Optional[str], x_api_key: Optional[str]):
    caller_id, caller_type = None, "anonymous"
    if authorization:
        token = authorization.removeprefix("Bearer ").strip()
        u = get_user_by_token(token)
        if u:
            caller_id, caller_type = u["id"], "user"
    if x_api_key and not caller_id:
        a = get_agent_by_key(x_api_key)
        if a:
            caller_id, caller_type = a["id"], "agent"
    return caller_id, caller_type


# ── List & search ──────────────────────────────────────────────────────────────

@router.get("")
def list_apis(
    domain:   Optional[str] = Query(None),
    q:        Optional[str] = Query(None),
    sort:     str           = Query("popular"),   # popular | newest | rating
    limit:    int           = Query(20, le=50),
    offset:   int           = Query(0),
):
    conn = get_conn()
    where_parts = ["aa.status='published'"]
    params: list = []

    if domain:
        where_parts.append("aa.domain=?")
        params.append(domain)
    if q:
        where_parts.append("(aa.name LIKE ? OR aa.description LIKE ?)")
        params += [f"%{q}%", f"%{q}%"]

    where = " AND ".join(where_parts)
    order = {
        "popular": "aa.call_count DESC",
        "newest":  "aa.created_at DESC",
        "rating":  "(CASE WHEN aa.rating_count>0 THEN aa.rating_sum/aa.rating_count ELSE 0 END) DESC",
    }.get(sort, "aa.call_count DESC")

    rows = conn.execute(f"""
        SELECT aa.*, a.name as agent_name, a.trust_score, a.model
        FROM agent_apis aa
        JOIN agents a ON aa.agent_id = a.id
        WHERE {where}
        ORDER BY {order}
        LIMIT ? OFFSET ?
    """, params + [limit, offset]).fetchall()

    total = conn.execute(f"""
        SELECT COUNT(*) as cnt FROM agent_apis aa WHERE {where}
    """, params).fetchone()["cnt"]

    conn.close()
    return {"items": [_fmt_api(r) for r in rows], "total": total}


# ── Single API detail ──────────────────────────────────────────────────────────

@router.get("/{api_id}")
def get_api(api_id: str):
    conn = get_conn()
    row = conn.execute("""
        SELECT aa.*, a.name as agent_name, a.trust_score, a.model, a.address as agent_address
        FROM agent_apis aa
        JOIN agents a ON aa.agent_id = a.id
        WHERE aa.id=?
    """, (api_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "API not found")

    recent_calls = conn.execute(
        "SELECT status, duration_ms, created_at FROM api_calls WHERE api_id=? ORDER BY created_at DESC LIMIT 10",
        (api_id,)
    ).fetchall()
    conn.close()
    result = _fmt_api(row)
    result["recent_calls"] = [dict(c) for c in recent_calls]
    return result


# ── Execute API ────────────────────────────────────────────────────────────────

# Trust score milestones: when call_count crosses these, reward the agent
_CALL_MILESTONES = {10, 50, 100, 500, 1000, 5000}

@router.post("/{api_id}/call")
def call_api(
    api_id:  str,
    body:    ApiCallBody,
    request: Request,
    authorization: Optional[str] = Header(None),
    x_api_key:     Optional[str] = Header(None),
):
    caller_id, caller_type = _resolve_caller(authorization, x_api_key)

    # Rate limit: keyed by (ip, api_id) — authenticated users get 3× headroom
    ip  = (request.client.host if request.client else "unknown")
    rl_key   = f"{ip}:{api_id}"
    rl_limit = _RL_AUTHED if caller_id else _RL_ANON
    _check_rate_limit(rl_key, rl_limit)

    conn = get_conn()
    row = conn.execute("""
        SELECT aa.*, a.model as agent_model
        FROM agent_apis aa JOIN agents a ON aa.agent_id = a.id
        WHERE aa.id=?
    """, (api_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "API not found")
    if row["status"] != "published":
        conn.close()
        raise HTTPException(403, "API is not published")
    api = row

    input_schema  = json.loads(api["input_schema"])  if isinstance(api["input_schema"],  str) else api["input_schema"]
    output_schema = json.loads(api["output_schema"]) if isinstance(api["output_schema"], str) else api["output_schema"]

    user_msg_parts = []
    for field in input_schema:
        val = body.input.get(field["name"])
        if val is None and field.get("required", True):
            conn.close()
            raise HTTPException(422, f"Missing required input field: {field['name']}")
        user_msg_parts.append(f"{field['name']}: {val}")
    user_msg = "\n".join(user_msg_parts) if user_msg_parts else json.dumps(body.input)

    rag_ctx = _rag_context(api["agent_id"], user_msg, conn)
    system_prompt = api["system_prompt"]
    if rag_ctx:
        system_prompt += f"\n\n--- Agent Knowledge Base ---\n{rag_ctx}\n--- End of Knowledge Base ---"

    agent_model = api.get("agent_model") or "other"
    t0 = time.monotonic()
    provider_used = "groq"
    try:
        result, provider_used = _call_model(system_prompt, user_msg, output_schema, agent_model)
        status = "success"
    except HTTPException:
        conn.close()
        raise
    except Exception as e:
        result = {"error": str(e)}
        status = "error"
    duration_ms = int((time.monotonic() - t0) * 1000)

    call_id    = str(uuid.uuid4())[:12]
    new_count  = (api["call_count"] or 0) + 1
    conn.execute(
        "INSERT INTO api_calls (id, api_id, caller_type, caller_id, input_data, output_data, duration_ms, status) VALUES (?,?,?,?,?,?,?,?)",
        (call_id, api_id, caller_type, caller_id,
         json.dumps(body.input), json.dumps(result), duration_ms, status)
    )
    conn.execute("UPDATE agent_apis SET call_count=? WHERE id=?", (new_count, api_id))

    # ── Milestone trust bonus ──────────────────────────────────────────────────
    if status == "success" and new_count in _CALL_MILESTONES:
        bonus = {10: 0.005, 50: 0.008, 100: 0.01, 500: 0.015, 1000: 0.02, 5000: 0.025}.get(new_count, 0.005)
        conn.execute(
            "UPDATE agents SET trust_score=MIN(1.0, trust_score+?) WHERE id=?",
            (bonus, api["agent_id"])
        )
        try:
            agent_addr = conn.execute("SELECT address FROM agents WHERE id=?", (api["agent_id"],)).fetchone()
            if agent_addr:
                from backend.identity import auto_issue_claim
                auto_issue_claim(
                    agent_addr["address"], "INSIGHT_QUALITY",
                    {"api_id": api_id, "call_count": new_count,
                     "milestone": new_count, "value": min(1.0, new_count / 1000)},
                    dedup_key=f"api_milestone_{api_id}_{new_count}"
                )
        except Exception:
            pass

    conn.commit()
    conn.close()
    return {
        "output":       result,
        "duration_ms":  duration_ms,
        "call_id":      call_id,
        "provider":     provider_used,
    }


# ── Create (agent only) ────────────────────────────────────────────────────────

@router.post("")
def create_api(body: ApiCreate, x_api_key: str = Header(...)):
    agent = get_agent_by_key(x_api_key)
    if not agent:
        raise HTTPException(401, "Invalid API key")

    conn = get_conn()
    count = conn.execute(
        "SELECT COUNT(*) as cnt FROM agent_apis WHERE agent_id=?", (agent["id"],)
    ).fetchone()["cnt"]
    if count >= 10:
        conn.close()
        raise HTTPException(400, "Agents may have at most 10 APIs")

    api_id = str(uuid.uuid4())[:12]
    conn.execute("""
        INSERT INTO agent_apis
        (id, agent_id, name, description, system_prompt, input_schema, output_schema,
         example_input, example_output, domain, status)
        VALUES (?,?,?,?,?,?,?,?,?,?,'draft')
    """, (
        api_id, agent["id"], body.name[:80], body.description[:500],
        body.system_prompt[:2000],
        json.dumps([f.dict() for f in body.input_schema]),
        json.dumps([f.dict() for f in body.output_schema]),
        json.dumps(body.example_input), json.dumps(body.example_output),
        body.domain,
    ))
    conn.commit()
    conn.close()
    return {"id": api_id, "status": "draft"}


# ── Update (agent only, must own) ─────────────────────────────────────────────

@router.patch("/{api_id}")
def update_api(api_id: str, body: ApiUpdate, x_api_key: str = Header(...)):
    agent = get_agent_by_key(x_api_key)
    if not agent:
        raise HTTPException(401, "Invalid API key")

    conn = get_conn()
    api = conn.execute("SELECT * FROM agent_apis WHERE id=?", (api_id,)).fetchone()
    if not api or api["agent_id"] != agent["id"]:
        conn.close()
        raise HTTPException(404, "API not found or not owned by this agent")

    updates = {}
    if body.name          is not None: updates["name"]          = body.name[:80]
    if body.description   is not None: updates["description"]   = body.description[:500]
    if body.system_prompt is not None: updates["system_prompt"] = body.system_prompt[:2000]
    if body.input_schema  is not None: updates["input_schema"]  = json.dumps([f.dict() for f in body.input_schema])
    if body.output_schema is not None: updates["output_schema"] = json.dumps([f.dict() for f in body.output_schema])
    if body.example_input  is not None: updates["example_input"]  = json.dumps(body.example_input)
    if body.example_output is not None: updates["example_output"] = json.dumps(body.example_output)

    if updates:
        set_clause = ", ".join(f"{k}=?" for k in updates)
        conn.execute(f"UPDATE agent_apis SET {set_clause}, updated_at=datetime('now') WHERE id=?",
                     list(updates.values()) + [api_id])
        conn.execute("UPDATE agent_apis SET status='draft' WHERE id=?", (api_id,))
        conn.commit()
    conn.close()
    return {"ok": True}


# ── Test run (quality gate) ────────────────────────────────────────────────────

@router.post("/{api_id}/test")
def test_api(api_id: str, x_api_key: str = Header(...)):
    """Run with example_input and verify output matches output_schema keys."""
    agent = get_agent_by_key(x_api_key)
    if not agent:
        raise HTTPException(401, "Invalid API key")

    conn = get_conn()
    row = conn.execute("""
        SELECT aa.*, a.model as agent_model
        FROM agent_apis aa JOIN agents a ON aa.agent_id = a.id
        WHERE aa.id=?
    """, (api_id,)).fetchone()
    if not row or row["agent_id"] != agent["id"]:
        conn.close()
        raise HTTPException(404, "Not found or not yours")
    api = row

    example_input  = json.loads(api["example_input"])  if isinstance(api["example_input"],  str) else {}
    output_schema  = json.loads(api["output_schema"])   if isinstance(api["output_schema"],  str) else []
    rag_ctx        = _rag_context(agent["id"], json.dumps(example_input), conn)
    conn.close()

    system_prompt = api["system_prompt"]
    if rag_ctx:
        system_prompt += f"\n\n--- Agent Knowledge Base ---\n{rag_ctx}\n---"

    agent_model = api.get("agent_model") or "other"
    user_msg    = "\n".join(f"{k}: {v}" for k, v in example_input.items()) or "test"
    result, provider_used = _call_model(system_prompt, user_msg, output_schema, agent_model)

    expected_keys = {f["name"] for f in output_schema}
    missing       = expected_keys - set(result.keys())

    # Check for empty/null/placeholder values in required fields
    weak_fields = []
    for f in output_schema:
        if not f.get("required", True):
            continue
        val = result.get(f["name"])
        if val is None:
            weak_fields.append(f["name"])
        elif f["type"] == "string" and (str(val).strip() == "" or str(val).lower() in ("n/a", "unknown", "null", "none", "...")):
            weak_fields.append(f["name"])
        elif f["type"] == "number" and not isinstance(val, (int, float)):
            weak_fields.append(f["name"])

    quality_score = max(0, 100 - len(missing) * 30 - len(weak_fields) * 15)
    passed        = len(missing) == 0 and quality_score >= 70

    return {
        "passed":        passed,
        "quality_score": quality_score,
        "provider":      provider_used,
        "output":        result,
        "missing_keys":  list(missing),
        "weak_fields":   weak_fields,
        "hint": None if passed else (
            f"Missing fields: {missing}" if missing
            else f"Weak/empty output in: {weak_fields}. Strengthen your system_prompt to always populate these fields."
        ),
    }


# ── Publish ────────────────────────────────────────────────────────────────────

@router.post("/{api_id}/publish")
def publish_api(api_id: str, x_api_key: str = Header(...)):
    agent = get_agent_by_key(x_api_key)
    if not agent:
        raise HTTPException(401, "Invalid API key")

    conn = get_conn()
    api = conn.execute("SELECT * FROM agent_apis WHERE id=?", (api_id,)).fetchone()
    if not api or api["agent_id"] != agent["id"]:
        conn.close()
        raise HTTPException(404, "Not found or not yours")

    conn.execute("UPDATE agent_apis SET status='published' WHERE id=?", (api_id,))
    conn.commit()
    conn.close()
    return {"ok": True, "status": "published"}


# ── Rate ───────────────────────────────────────────────────────────────────────

@router.post("/{api_id}/rate")
def rate_api(
    api_id: str,
    body:   RateBody,
    authorization: Optional[str] = Header(None),
    x_api_key:     Optional[str] = Header(None),
):
    if not 1 <= body.score <= 5:
        raise HTTPException(422, "Score must be 1–5")

    caller_id, _ = _resolve_caller(authorization, x_api_key)
    if not caller_id:
        raise HTTPException(401, "Login required to rate")

    conn = get_conn()
    api = conn.execute("SELECT id, rating_sum, rating_count FROM agent_apis WHERE id=?", (api_id,)).fetchone()
    if not api:
        conn.close()
        raise HTTPException(404, "API not found")

    existing = conn.execute(
        "SELECT score FROM api_ratings WHERE api_id=? AND rater_id=?", (api_id, caller_id)
    ).fetchone()

    if existing:
        old = existing["score"]
        conn.execute("UPDATE api_ratings SET score=? WHERE api_id=? AND rater_id=?",
                     (body.score, api_id, caller_id))
        conn.execute("UPDATE agent_apis SET rating_sum=rating_sum+? WHERE id=?",
                     (body.score - old, api_id))
    else:
        rid = str(uuid.uuid4())[:10]
        conn.execute("INSERT INTO api_ratings (id, api_id, rater_id, score) VALUES (?,?,?,?)",
                     (rid, api_id, caller_id, body.score))
        conn.execute("UPDATE agent_apis SET rating_sum=rating_sum+?, rating_count=rating_count+1 WHERE id=?",
                     (body.score, api_id))

    conn.commit()
    updated = conn.execute("SELECT rating_sum, rating_count FROM agent_apis WHERE id=?", (api_id,)).fetchone()
    conn.close()
    avg = round(updated["rating_sum"] / updated["rating_count"], 2) if updated["rating_count"] else None
    return {"avg_rating": avg, "rating_count": updated["rating_count"]}


# ── OpenAPI spec ───────────────────────────────────────────────────────────────

@router.get("/{api_id}/openapi")
def get_openapi_spec(api_id: str):
    conn = get_conn()
    api = conn.execute("SELECT * FROM agent_apis WHERE id=?", (api_id,)).fetchone()
    if not api:
        conn.close()
        raise HTTPException(404, "API not found")
    conn.close()

    input_schema  = json.loads(api["input_schema"])  if isinstance(api["input_schema"],  str) else []
    output_schema = json.loads(api["output_schema"]) if isinstance(api["output_schema"], str) else []

    def _schema_to_obj(fields: list) -> dict:
        props = {}
        required = []
        for f in fields:
            props[f["name"]] = {"type": f["type"], "description": f.get("description", "")}
            if f.get("example"):
                props[f["name"]]["example"] = f["example"]
            if f.get("required", True):
                required.append(f["name"])
        return {"type": "object", "properties": props, "required": required}

    base_url = os.getenv("API_BASE_URL", "https://api.cogit.ai")

    return {
        "openapi": "3.1.0",
        "info": {
            "title":       api["name"],
            "description": api["description"],
            "version":     "1.0.0",
        },
        "servers": [{"url": f"{base_url}/api-market/{api_id}"}],
        "paths": {
            "/call": {
                "post": {
                    "summary":     api["name"],
                    "operationId": f"call_{api_id}",
                    "requestBody": {
                        "required": True,
                        "content": {"application/json": {"schema": {"type": "object", "properties": {"input": _schema_to_obj(input_schema)}}}}
                    },
                    "responses": {
                        "200": {
                            "description": "Successful response",
                            "content": {"application/json": {"schema": {"type": "object", "properties": {"output": _schema_to_obj(output_schema), "duration_ms": {"type": "integer"}, "call_id": {"type": "string"}}}}}
                        }
                    }
                }
            }
        }
    }


# ── Agent's own APIs ───────────────────────────────────────────────────────────

@router.get("/my/list")
def list_my_apis(x_api_key: str = Header(...)):
    agent = get_agent_by_key(x_api_key)
    if not agent:
        raise HTTPException(401, "Invalid API key")

    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM agent_apis WHERE agent_id=? ORDER BY created_at DESC",
        (agent["id"],)
    ).fetchall()
    conn.close()
    return {"apis": [_fmt_api(r) for r in rows]}
