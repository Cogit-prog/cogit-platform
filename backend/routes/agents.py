import uuid, json
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
from backend.database import get_conn
from backend.identity import generate_identity, sign_claim, verify_claim, CLAIM_TYPES
from backend.security import encrypt, decrypt, hash_api_key, verify_api_key, generate_api_key

router = APIRouter(prefix="/agents", tags=["agents"])

DOMAINS = [
    "coding", "legal", "creative", "medical", "finance", "research",
    "science", "technology", "philosophy", "history", "psychology",
    "education", "gaming", "music", "art", "sports", "food", "travel",
    "politics", "environment", "space", "economics", "startup", "design",
    "security", "blockchain", "robotics", "data", "ai", "health", "other",
]
MODELS = [
    # Frontier / commercial
    "claude", "gpt-4", "gemini", "grok", "copilot", "perplexity",
    "cohere", "command-r", "nova",
    # Open-weight families
    "llama", "mistral", "mixtral", "deepseek", "qwen", "phi",
    "falcon", "yi", "solar", "inflection",
    # Fine-tuned / chat / specialized
    "vicuna", "wizard", "orca", "hermes", "openchat", "zephyr",
    "codellama", "starcoder", "deepseekcoder", "tinyllama",
    "other",
]


class AgentRegister(BaseModel):
    name:          str
    domain:        str
    model:         str = "other"
    bio:           str = ""
    model_api_key: str = ""  # optional — used for one-time verification, never stored


class ClaimIssue(BaseModel):
    subject_address: str
    claim_type: str
    data: dict


def recalc_trust_score(agent_id: str, conn) -> float:
    """Claims received + avg post vote score + outcome success rate → weighted trust."""
    addr_row = conn.execute("SELECT address FROM agents WHERE id=?", (agent_id,)).fetchone()
    if not addr_row:
        return 0.5
    address = addr_row["address"]

    claim_count = conn.execute(
        "SELECT COUNT(*) as cnt FROM claims WHERE subject=?", (address,)
    ).fetchone()["cnt"]

    avg_row = conn.execute(
        "SELECT AVG(score) as avg FROM posts WHERE agent_id=?", (agent_id,)
    ).fetchone()
    avg_score = avg_row["avg"] if avg_row["avg"] is not None else 0.5

    total = conn.execute(
        "SELECT COUNT(*) as cnt FROM outcomes WHERE agent_id=?", (agent_id,)
    ).fetchone()["cnt"]
    success = conn.execute(
        "SELECT COUNT(*) as cnt FROM outcomes WHERE agent_id=? AND result='success'", (agent_id,)
    ).fetchone()["cnt"]
    success_rate = (success / total) if total > 0 else 0.5

    score = (
        0.20
        + min(0.25, claim_count * 0.03)
        + avg_score * 0.30
        + success_rate * 0.25
    )
    return round(min(1.0, score), 3)


def get_agent_by_key(api_key: str):
    """Look up agent by raw API key. Supports both hashed (new) and plaintext (legacy)."""
    conn = get_conn()
    # Try hash-based lookup first (new secure storage)
    key_hash = hash_api_key(api_key)
    row = conn.execute("SELECT * FROM agents WHERE api_key=?", (key_hash,)).fetchone()
    if not row:
        # Legacy fallback: plaintext key stored before security migration
        row = conn.execute("SELECT * FROM agents WHERE api_key=?", (api_key,)).fetchone()
    conn.close()
    if not row:
        return None
    agent = dict(row)
    # Decrypt private_key if encrypted
    try:
        agent["private_key"] = decrypt(agent["private_key"])
    except Exception:
        pass
    return agent


def _verify_model_api_key(model: str, key: str) -> bool:
    """모델 API 키를 실제로 호출해 검증. 키는 이 함수 안에서만 사용되고 저장되지 않음."""
    import requests as _req
    try:
        if model == "claude":
            r = _req.post("https://api.anthropic.com/v1/messages",
                headers={"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                json={"model": "claude-haiku-4-5-20251001", "messages": [{"role": "user", "content": "hi"}], "max_tokens": 3},
                timeout=10)
            return r.status_code == 200
        elif model == "gpt-4":
            r = _req.post("https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={"model": "gpt-4o-mini", "messages": [{"role": "user", "content": "hi"}], "max_tokens": 3},
                timeout=10)
            return r.status_code == 200
        elif model == "gemini":
            r = _req.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={key}",
                headers={"Content-Type": "application/json"},
                json={"contents": [{"parts": [{"text": "hi"}]}]},
                timeout=10)
            return r.status_code == 200
        elif model == "grok":
            r = _req.post("https://api.x.ai/v1/chat/completions",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={"model": "grok-3-mini", "messages": [{"role": "user", "content": "hi"}], "max_tokens": 3},
                timeout=10)
            return r.status_code == 200
        elif model in ("llama", "mixtral", "deepseek", "mistral"):
            r = _req.post("https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={"model": "llama-3.1-8b-instant", "messages": [{"role": "user", "content": "hi"}], "max_tokens": 3},
                timeout=10)
            return r.status_code == 200
    except Exception:
        pass
    return False


@router.get("/my")
def get_my_agent(authorization: str = Header(default="")):
    """로그인 유저의 에이전트 조회."""
    if not authorization:
        raise HTTPException(401, "로그인이 필요합니다")
    token = authorization.removeprefix("Bearer ").strip()
    from backend.auth import get_user_by_token
    user = get_user_by_token(token)
    if not user:
        raise HTTPException(401, "유효하지 않은 토큰")
    conn = get_conn()
    row = conn.execute("SELECT id, name, domain, model, model_verified FROM agents WHERE owner_user_id=?", (user["id"],)).fetchone()
    conn.close()
    if not row:
        return {"agent": None}
    return {"agent": dict(row)}


class ModelVerifyBody(BaseModel):
    model:         str
    model_api_key: str

class ModelVerifyUpdateBody(BaseModel):
    model_api_key: str

@router.post("/verify-model")
def verify_model_key(body: ModelVerifyBody):
    """등록 전 모델 API 키 유효성 실시간 확인. 키는 저장되지 않음."""
    ok = _verify_model_api_key(body.model, body.model_api_key.strip())
    return {"verified": ok}


@router.patch("/me/verify-model")
def update_model_verification(body: ModelVerifyUpdateBody, x_api_key: str = Header(...)):
    """등록 후 모델 인증 — 에이전트가 자신의 API 키로 모델 검증."""
    agent = get_agent_by_key(x_api_key)
    if not agent:
        raise HTTPException(401, "유효하지 않은 API 키")
    if agent.get("model_verified"):
        return {"model_verified": True, "message": "이미 인증됨"}

    ok = _verify_model_api_key(agent["model"], body.model_api_key.strip())
    if not ok:
        raise HTTPException(400, "API 키 인증 실패 — 키를 확인해주세요")

    conn = get_conn()
    conn.execute("UPDATE agents SET model_verified=1 WHERE id=?", (agent["id"],))
    conn.commit()
    conn.close()

    try:
        from backend.identity import auto_issue_claim
        auto_issue_claim(
            agent["address"], "MODEL_VERIFIED",
            {"model": agent["model"], "value": 1.0},
            dedup_key=f"model_verified_{agent['id']}"
        )
    except Exception:
        pass

    return {"model_verified": True, "message": "모델 인증 완료"}


@router.post("/register")
def register_agent(body: AgentRegister, authorization: str = Header(default="")):
    if body.domain not in DOMAINS:
        raise HTTPException(400, f"domain은 {DOMAINS} 중 하나여야 합니다")
    model = body.model if body.model in MODELS else "other"

    # 유저 인증 & 1인 1에이전트 체크
    owner_user_id = None
    if authorization:
        token = authorization.removeprefix("Bearer ").strip()
        from backend.auth import get_user_by_token
        user = get_user_by_token(token)
        if user:
            owner_user_id = user["id"]
            conn_check = get_conn()
            existing = conn_check.execute(
                "SELECT id, name FROM agents WHERE owner_user_id=?", (owner_user_id,)
            ).fetchone()
            conn_check.close()
            if existing:
                raise HTTPException(400, f"이미 에이전트가 있습니다: '{existing['name']}'. 계정당 1개만 생성 가능합니다.")

    # 모델 API 키 검증 (제공된 경우)
    model_verified = 0
    if body.model_api_key.strip():
        model_verified = 1 if _verify_model_api_key(model, body.model_api_key.strip()) else 0

    identity  = generate_identity()
    agent_id  = str(uuid.uuid4())[:8]
    raw_key   = generate_api_key()
    api_key   = "cg_" + raw_key
    key_hash  = hash_api_key(api_key)
    enc_pk    = encrypt(identity["private_key"])

    conn = get_conn()
    try:
        conn.execute(
            """INSERT INTO agents
               (id, name, domain, model, bio, address, private_key, api_key, status, owner_user_id, model_verified)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (agent_id, body.name.strip(), body.domain, model, body.bio.strip(),
             identity["address"], enc_pk, key_hash, "pending", owner_user_id, model_verified)
        )
        conn.commit()
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        conn.close()

    # 인증된 경우 MODEL_VERIFIED 클레임 즉시 발행
    if model_verified:
        try:
            from backend.identity import auto_issue_claim
            auto_issue_claim(
                identity["address"], "MODEL_VERIFIED",
                {"model": model, "value": 1.0},
                dedup_key=f"model_verified_{agent_id}"
            )
        except Exception:
            pass

    return {
        "agent_id":       agent_id,
        "address":        identity["address"],
        "api_key":        api_key,
        "status":         "pending",
        "model_verified": bool(model_verified),
        "message":        "Registration received. Your agent will appear after review (usually within 24h)."
    }


@router.post("/claims/issue")
def issue_claim(body: ClaimIssue, x_api_key: str = Header(...)):
    """다른 에이전트에 대해 신뢰 클레임 발행"""
    agent = get_agent_by_key(x_api_key)
    if not agent:
        raise HTTPException(401, "유효하지 않은 API 키")

    if body.claim_type not in CLAIM_TYPES:
        raise HTTPException(400, f"claim_type은 {list(CLAIM_TYPES.keys())} 중 하나")

    # 대상 에이전트 주소 확인
    conn = get_conn()
    subject = conn.execute(
        "SELECT * FROM agents WHERE address=?", (body.subject_address,)
    ).fetchone()
    if not subject:
        raise HTTPException(404, "대상 에이전트 없음")

    claim = sign_claim(
        issuer_private_key = agent["private_key"],
        subject_address    = body.subject_address,
        claim_type         = body.claim_type,
        data               = body.data,
    )

    claim_id = str(uuid.uuid4())[:8]
    try:
        conn.execute(
            """INSERT INTO claims
               (id, issuer, subject, claim_type, data, signature, hash, issued_at)
               VALUES (?,?,?,?,?,?,?,?)""",
            (claim_id, claim["issuer"], claim["subject"],
             claim["claim_type"], json.dumps(claim["data"]),
             claim["signature"], claim["hash"], claim["issued_at"])
        )

        subj_id = conn.execute(
            "SELECT id FROM agents WHERE address=?", (body.subject_address,)
        ).fetchone()["id"]
        new_score = recalc_trust_score(subj_id, conn)
        conn.execute(
            "UPDATE agents SET trust_score=? WHERE id=?", (new_score, subj_id)
        )
        import uuid as _uuid
        conn.execute(
            "INSERT INTO trust_score_history (id, agent_id, score) VALUES (?,?,?)",
            (_uuid.uuid4().hex[:10], subj_id, new_score)
        )
        conn.commit()
    finally:
        conn.close()

    return {
        "claim_id":   claim_id,
        "issuer":     claim["issuer"],
        "subject":    claim["subject"],
        "claim_type": claim["claim_type"],
        "signature":  claim["signature"][:20] + "...",
        "verified":   verify_claim(claim),
        "message":    "클레임 발행 완료"
    }


@router.get("/{agent_id}/identity")
def get_identity(agent_id: str):
    """에이전트 신원 + 클레임 전체 조회"""
    conn = get_conn()
    agent = conn.execute("SELECT * FROM agents WHERE id=?", (agent_id,)).fetchone()
    if not agent:
        raise HTTPException(404, "에이전트 없음")

    agent = dict(agent)
    claims = conn.execute(
        "SELECT * FROM claims WHERE subject=? ORDER BY issued_at DESC",
        (agent["address"],)
    ).fetchall()
    conn.close()

    claim_list = []
    for c in claims:
        c = dict(c)
        full_claim = {
            "issuer":     c["issuer"],
            "subject":    c["subject"],
            "claim_type": c["claim_type"],
            "data":       json.loads(c["data"]),
            "issued_at":  c["issued_at"],
            "signature":  c["signature"],
            "hash":       c["hash"],
        }
        claim_list.append({
            **{k: v for k, v in c.items() if k not in ("signature",)},
            "verified": verify_claim(full_claim),
        })

    return {
        "agent_id":    agent["id"],
        "name":        agent["name"],
        "domain":      agent["domain"],
        "address":     agent["address"],
        "trust_score": round(agent["trust_score"], 3),
        "post_count":  agent["post_count"],
        "claims":      claim_list,
        "claim_count": len(claim_list),
    }


@router.get("/{agent_id}/trust")
def get_trust(agent_id: str):
    conn = get_conn()
    row = conn.execute("SELECT * FROM agents WHERE id=?", (agent_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404, "에이전트 없음")
    row = dict(row)
    return {
        "agent_id":    row["id"],
        "name":        row["name"],
        "domain":      row["domain"],
        "address":     row["address"],
        "trust_score": round(row["trust_score"], 3),
        "post_count":  row["post_count"],
        "success_rate": round(row["success_count"] / max(row["post_count"], 1), 2),
    }


@router.get("/following")
def get_following_agents(authorization: Optional[str] = Header(None)):
    """Return the list of agent IDs the current user follows."""
    from backend.auth import get_user_by_token
    if not authorization or not authorization.startswith("Bearer "):
        return []
    token = authorization.split(" ", 1)[1]
    user = get_user_by_token(token)
    if not user:
        return []
    conn = get_conn()
    rows = conn.execute("""
        SELECT a.id, a.name, a.domain, a.model, a.bio, a.trust_score,
               a.post_count, COALESCE(a.battle_wins,0) as battle_wins,
               COALESCE(a.battle_total,0) as battle_total
        FROM follows f
        JOIN agents a ON f.following_id = a.id
        WHERE f.follower_id = ? AND f.following_type = 'agent'
        ORDER BY a.trust_score DESC
    """, (str(user["id"]),)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.get("/leaderboard")
def leaderboard():
    conn = get_conn()
    top_agents = conn.execute("""
        SELECT a.id, a.name, a.domain, a.model, a.address, a.trust_score,
               a.post_count, a.success_count,
               COALESCE(a.battle_wins, 0) as battle_wins,
               COALESCE(a.battle_total, 0) as battle_total,
               COUNT(DISTINCT v.id) as total_votes,
               COALESCE(AVG(p.score), 0.5) as avg_post_score
        FROM agents a
        LEFT JOIN posts p ON a.id = p.agent_id
        LEFT JOIN votes v ON p.id = v.post_id
        WHERE a.status='active'
        GROUP BY a.id
        ORDER BY a.trust_score DESC
        LIMIT 50
    """).fetchall()

    top_posts = conn.execute("""
        SELECT posts.id, posts.domain, posts.abstract, posts.pattern_type,
               posts.score, posts.vote_count, posts.use_count, posts.created_at,
               agents.name as agent_name, agents.model as agent_model
        FROM posts LEFT JOIN agents ON posts.agent_id = agents.id
        ORDER BY posts.score DESC, posts.vote_count DESC
        LIMIT 10
    """).fetchall()

    domain_stats = conn.execute("""
        SELECT domain, COUNT(*) as post_count, ROUND(AVG(score),3) as avg_score
        FROM posts GROUP BY domain ORDER BY post_count DESC
    """).fetchall()

    stats = conn.execute("""
        SELECT
          (SELECT COUNT(*) FROM agents WHERE status='active') as agents,
          (SELECT COUNT(*) FROM posts) as posts,
          (SELECT COUNT(*) FROM votes) as votes,
          (SELECT COUNT(*) FROM claims) as claims
    """).fetchone()
    conn.close()

    return {
        "stats": dict(stats),
        "top_agents": [dict(a) for a in top_agents],
        "top_posts": [dict(p) for p in top_posts],
        "domain_stats": [dict(d) for d in domain_stats],
    }


@router.get("/battle-leaderboard")
def battle_leaderboard():
    """Agents ranked by battle performance."""
    conn = get_conn()
    rows = conn.execute("""
        SELECT a.id, a.name, a.domain, a.model, a.trust_score, a.bio,
               COALESCE(a.battle_wins, 0) as battle_wins,
               COALESCE(a.battle_total, 0) as battle_total
        FROM agents a
        WHERE a.status='active' AND COALESCE(a.battle_total, 0) > 0
        ORDER BY
            CAST(COALESCE(a.battle_wins,0) AS FLOAT) / MAX(COALESCE(a.battle_total,1), 1) DESC,
            a.battle_wins DESC,
            a.trust_score DESC
        LIMIT 20
    """).fetchall()
    conn.close()
    return [
        {
            **dict(r),
            "win_rate": round(r["battle_wins"] / max(r["battle_total"], 1) * 100),
        }
        for r in rows
    ]


@router.get("/recommended")
def recommended_agents(x_api_key: str = Header(None),
                       authorization: str = Header(None),
                       limit: int = 5):
    """Friends-of-friends + top agents in your domain you don't follow yet."""
    my_id = None
    my_domain = None

    if x_api_key:
        me = get_agent_by_key(x_api_key)
        if me:
            my_id = me["id"]
            my_domain = me["domain"]
    elif authorization:
        from backend.auth import get_user_by_token
        token = authorization.removeprefix("Bearer ").strip()
        user = get_user_by_token(token)
        if user:
            my_id = user["id"]

    conn = get_conn()
    following_ids: list = []
    if my_id:
        following_ids = [r["following_id"] for r in conn.execute(
            "SELECT following_id FROM follows WHERE follower_id=?", (my_id,)
        ).fetchall()]

    excluded = set(following_ids + ([my_id] if my_id else []))
    placeholders = ",".join(f"'{i}'" for i in excluded) if excluded else "'__none__'"

    # 1. Friends of friends (agents followed by agents you follow)
    fof: list = []
    if following_ids:
        fof_ph = ",".join(f"'{i}'" for i in following_ids)
        fof_rows = conn.execute(f"""
            SELECT f.following_id as id, COUNT(*) as weight
            FROM follows f
            WHERE f.follower_id IN ({fof_ph})
              AND f.following_id NOT IN ({placeholders})
            GROUP BY f.following_id
            ORDER BY weight DESC LIMIT {limit}
        """).fetchall()
        fof = [r["id"] for r in fof_rows]

    # 2. Top agents in same domain
    domain_filter = f"AND domain='{my_domain}'" if my_domain else ""
    top_rows = conn.execute(f"""
        SELECT id FROM agents
        WHERE status='active' AND id NOT IN ({placeholders}) {domain_filter}
        ORDER BY trust_score DESC LIMIT {limit}
    """).fetchall()
    top_ids = [r["id"] for r in top_rows]

    # Merge + deduplicate
    seen: set = set()
    merged = []
    for aid in fof + top_ids:
        if aid not in seen:
            seen.add(aid)
            merged.append(aid)

    if not merged:
        # Fallback: just top trusted agents
        fallback = conn.execute(f"""
            SELECT id FROM agents WHERE status='active' AND id NOT IN ({placeholders})
            ORDER BY trust_score DESC LIMIT {limit}
        """).fetchall()
        merged = [r["id"] for r in fallback]

    result = []
    for aid in merged[:limit]:
        row = conn.execute(
            "SELECT id, name, domain, model, bio, trust_score, last_active FROM agents WHERE id=?",
            (aid,)
        ).fetchone()
        if row:
            d = dict(row)
            from datetime import datetime, timedelta
            d["is_active"] = bool(
                d.get("last_active") and
                datetime.utcnow() - datetime.fromisoformat(d["last_active"]) < timedelta(hours=24)
            ) if d.get("last_active") else False
            result.append(d)

    conn.close()
    return result


@router.post("/pin/{post_id}")
def pin_post(post_id: str, x_api_key: str = Header(...)):
    """Pin a post to your profile."""
    agent = get_agent_by_key(x_api_key)
    if not agent:
        raise HTTPException(401, "Invalid API key")
    conn = get_conn()
    post = conn.execute(
        "SELECT id FROM posts WHERE id=? AND agent_id=?", (post_id, agent["id"])
    ).fetchone()
    if not post:
        conn.close(); raise HTTPException(404, "Post not found or not yours")
    conn.execute("UPDATE agents SET pinned_post_id=? WHERE id=?", (post_id, agent["id"]))
    conn.commit(); conn.close()
    return {"pinned": post_id}


@router.delete("/pin")
def unpin_post(x_api_key: str = Header(...)):
    agent = get_agent_by_key(x_api_key)
    if not agent:
        raise HTTPException(401, "Invalid API key")
    conn = get_conn()
    conn.execute("UPDATE agents SET pinned_post_id=NULL WHERE id=?", (agent["id"],))
    conn.commit(); conn.close()
    return {"unpinned": True}


@router.post("/community/run")
def trigger_community_cycle():
    """커뮤니티 사이클 수동 트리거"""
    import traceback
    from backend.database import get_conn
    try:
        from backend.persona import run_community_cycle
        cycle_log = run_community_cycle(max_agents=5) or []
        conn = get_conn()
        comment_count = conn.execute("SELECT COUNT(*) as cnt FROM comments").fetchone()["cnt"]
        post_count = conn.execute("SELECT COUNT(*) as cnt FROM posts").fetchone()["cnt"]
        conn.close()
        return {"status": "ok", "cycle_log": cycle_log, "total_comments": comment_count, "total_posts": post_count}
    except Exception as e:
        return {"error": str(e), "trace": traceback.format_exc()}


@router.get("/")
def list_agents():
    from fastapi.responses import JSONResponse
    from datetime import datetime, timedelta
    import traceback
    try:
        conn = get_conn()
        rows = conn.execute("""
            SELECT id, name, domain, address, trust_score, post_count, model, last_active, mood
            FROM agents ORDER BY trust_score DESC
        """).fetchall()
        conn.close()
        result = []
        for r in rows:
            d = dict(r)
            is_active = False
            if d.get("last_active"):
                try:
                    la = str(d["last_active"]).replace("+00:00", "").replace("+00", "").replace("Z", "")
                    if "T" not in la:
                        la = la.replace(" ", "T")
                    is_active = (datetime.utcnow() - datetime.fromisoformat(la)) < timedelta(hours=24)
                except Exception:
                    pass
            d["is_active"] = bool(is_active)
            result.append(d)
        return JSONResponse(content=result, headers={"Cache-Control": "no-store, no-cache, must-revalidate"})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "trace": traceback.format_exc()})


@router.get("/{agent_id}/trust-history")
def trust_history(agent_id: str):
    conn = get_conn()
    rows = conn.execute(
        "SELECT score, created_at FROM trust_score_history WHERE agent_id=? ORDER BY created_at ASC LIMIT 30",
        (agent_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.get("/citation-graph")
def citation_graph(limit: int = 60):
    """Return citation edges between agents for the influence graph UI."""
    from backend.persona import get_citation_graph
    return get_citation_graph(limit=limit)


@router.get("/{agent_id}/citations")
def agent_citations(agent_id: str):
    """Return how many times this agent has been cited and by whom."""
    conn = get_conn()
    cited_by = conn.execute("""
        SELECT fa.id as from_id, fa.name as from_name, fa.domain as from_domain,
               COUNT(*) as weight
        FROM agent_citations ac
        JOIN agents fa ON fa.id = ac.from_agent_id
        WHERE ac.to_agent_id = ?
        GROUP BY ac.from_agent_id
        ORDER BY weight DESC
        LIMIT 20
    """, (agent_id,)).fetchall()
    cites = conn.execute("""
        SELECT ta.id as to_id, ta.name as to_name, ta.domain as to_domain,
               COUNT(*) as weight
        FROM agent_citations ac
        JOIN agents ta ON ta.id = ac.to_agent_id
        WHERE ac.from_agent_id = ?
        GROUP BY ac.to_agent_id
        ORDER BY weight DESC
        LIMIT 20
    """, (agent_id,)).fetchall()
    conn.close()
    return {
        "cited_by": [dict(r) for r in cited_by],
        "cites": [dict(r) for r in cites],
    }

