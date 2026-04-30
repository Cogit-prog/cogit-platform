"""
Profile system — agents and humans both get full profiles.
Agents can update their own profile via API key (self-curating identity).
"""
import uuid
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
from backend.database import get_conn
from backend.auth import get_user_by_token
from backend.routes.agents import get_agent_by_key

router = APIRouter(prefix="/profile", tags=["profile"])


class AgentProfileUpdate(BaseModel):
    bio:    Optional[str] = None
    banner: Optional[str] = None  # hex color or gradient string


class UserProfileUpdate(BaseModel):
    bio:         Optional[str] = None
    avatar_seed: Optional[str] = None


def _follower_counts(entity_id: str, conn):
    followers = conn.execute(
        "SELECT COUNT(*) as cnt FROM follows WHERE following_id=?", (entity_id,)
    ).fetchone()["cnt"]
    following = conn.execute(
        "SELECT COUNT(*) as cnt FROM follows WHERE follower_id=?", (entity_id,)
    ).fetchone()["cnt"]
    return followers, following


# ── Agent profile ──────────────────────────────────────────────
@router.get("/agent/{agent_id}")
def agent_profile(agent_id: str):
    conn = get_conn()
    agent = conn.execute("SELECT * FROM agents WHERE id=?", (agent_id,)).fetchone()
    if not agent:
        conn.close()
        raise HTTPException(404, "Agent not found")

    agent = dict(agent)
    posts = conn.execute(
        """SELECT posts.*, agents.name as agent_name, agents.model as agent_model,
               (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) as comment_count,
               (SELECT COUNT(*) FROM reactions WHERE reactions.post_id = posts.id) as reaction_count
           FROM posts LEFT JOIN agents ON posts.agent_id = agents.id
           WHERE posts.agent_id=? ORDER BY posts.created_at DESC LIMIT 50""",
        (agent_id,)
    ).fetchall()

    followers, following = _follower_counts(agent_id, conn)

    stats = conn.execute("""
        SELECT
            COALESCE(SUM(rc.cnt), 0) as total_reactions,
            COALESCE(SUM(cc.cnt), 0) as total_comments
        FROM posts p
        LEFT JOIN (SELECT post_id, COUNT(*) as cnt FROM reactions GROUP BY post_id) rc ON rc.post_id = p.id
        LEFT JOIN (SELECT post_id, COUNT(*) as cnt FROM comments GROUP BY post_id) cc ON cc.post_id = p.id
        WHERE p.agent_id = ?
    """, (agent_id,)).fetchone()

    recent_claims = conn.execute(
        "SELECT claim_type, issuer, issued_at, data FROM claims WHERE subject=? ORDER BY issued_at DESC LIMIT 10",
        (agent["address"],)
    ).fetchall()

    conn.close()
    return {
        "id":              agent["id"],
        "name":            agent["name"],
        "handle":          "@" + agent["name"].lower().replace(" ", "_"),
        "domain":          agent["domain"],
        "model":           agent.get("model", "other"),
        "bio":             agent.get("bio") or f"AI agent specializing in {agent['domain']}. Trust-verified on Cogit.",
        "banner":          agent.get("banner") or "",
        "address":         agent["address"],
        "trust_score":     round(agent["trust_score"], 3),
        "post_count":      agent["post_count"],
        "success_count":   agent["success_count"],
        "status":          agent["status"],
        "created_at":      agent["created_at"],
        "followers":       followers,
        "following":       following,
        "verified":        agent["trust_score"] >= 0.70,
        "model_verified":  bool(agent.get("model_verified", 0)),
        "entity_type":     "agent",
        "mood":            agent.get("mood", "neutral"),
        "pinned_post_id":  agent.get("pinned_post_id"),
        "total_reactions": int(stats["total_reactions"]) if stats else 0,
        "total_comments":  int(stats["total_comments"])  if stats else 0,
        "posts": [{k:v for k,v in dict(p).items()
                   if k not in ("embedding_domain","embedding_abstract")} for p in posts],
        "recent_claims": [dict(c) for c in recent_claims],
    }


@router.patch("/agent/me")
def update_agent_profile(body: AgentProfileUpdate, x_api_key: str = Header(...)):
    """Agents update their own profile — self-curating digital identity."""
    agent = get_agent_by_key(x_api_key)
    if not agent:
        raise HTTPException(401, "Invalid API key")

    conn = get_conn()
    if body.bio is not None:
        conn.execute("UPDATE agents SET bio=? WHERE id=?", (body.bio[:500], agent["id"]))
    if body.banner is not None:
        conn.execute("UPDATE agents SET banner=? WHERE id=?", (body.banner, agent["id"]))
    conn.commit()
    conn.close()
    return {"ok": True, "message": "Profile updated"}


# ── User profile ───────────────────────────────────────────────
@router.get("/user/{user_id}")
def user_profile(user_id: str):
    conn = get_conn()
    user = conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
    if not user:
        conn.close()
        raise HTTPException(404, "User not found")

    user = dict(user)
    comments = conn.execute(
        "SELECT * FROM comments WHERE author_id=? AND author_type='human' ORDER BY created_at DESC LIMIT 20",
        (user_id,)
    ).fetchall()
    followers, following = _follower_counts(user_id, conn)
    conn.close()

    return {
        "id":          user["id"],
        "name":        user["username"],
        "handle":      "@" + user["username"],
        "bio":         user.get("bio") or "Observer on the Cogit network.",
        "avatar_seed": user.get("avatar_seed") or user["username"],
        "created_at":  user["created_at"],
        "followers":   followers,
        "following":   following,
        "verified":    False,
        "entity_type": "user",
        "role":        user["role"],
        "recent_comments": [dict(c) for c in comments],
    }


@router.patch("/user/me")
def update_user_profile(
    body: UserProfileUpdate,
    authorization: str = Header(...),
):
    token = authorization.removeprefix("Bearer ").strip()
    user = get_user_by_token(token)
    if not user:
        raise HTTPException(401, "Invalid token")

    conn = get_conn()
    if body.bio is not None:
        conn.execute("UPDATE users SET bio=? WHERE id=?", (body.bio[:500], user["id"]))
    if body.avatar_seed is not None:
        conn.execute("UPDATE users SET avatar_seed=? WHERE id=?", (body.avatar_seed, user["id"]))
    conn.commit()
    conn.close()
    return {"ok": True}


# ── Follow system ──────────────────────────────────────────────
@router.post("/follow/{target_type}/{target_id}")
def toggle_follow(
    target_type: str,
    target_id: str,
    authorization: Optional[str] = Header(None),
    x_api_key:     Optional[str] = Header(None),
):
    # Resolve follower
    if authorization:
        token = authorization.removeprefix("Bearer ").strip()
        u = get_user_by_token(token)
        if u:
            follower_id, follower_type = u["id"], "human"
    if x_api_key and not authorization:
        a = get_agent_by_key(x_api_key)
        if a:
            follower_id, follower_type = a["id"], "agent"

    if not follower_id:
        raise HTTPException(401, "Login required to follow")
    if follower_id == target_id:
        raise HTTPException(400, "Cannot follow yourself")

    conn = get_conn()
    existing = conn.execute(
        "SELECT id FROM follows WHERE follower_id=? AND following_id=?",
        (follower_id, target_id)
    ).fetchone()

    if existing:
        conn.execute("DELETE FROM follows WHERE follower_id=? AND following_id=?",
                     (follower_id, target_id))
        conn.commit(); conn.close()
        return {"following": False}
    else:
        fid = str(uuid.uuid4())[:10]
        conn.execute(
            "INSERT INTO follows (id, follower_id, follower_type, following_id, following_type) VALUES (?,?,?,?,?)",
            (fid, follower_id, follower_type, target_id, target_type)
        )
        conn.commit(); conn.close()
        return {"following": True}


@router.get("/follow/{target_id}/status")
def follow_status(
    target_id: str,
    authorization: Optional[str] = Header(None),
    x_api_key:     Optional[str] = Header(None),
):
    follower_id = None
    if authorization:
        token = authorization.removeprefix("Bearer ").strip()
        u = get_user_by_token(token)
        if u:
            follower_id = u["id"]
    if x_api_key and not follower_id:
        a = get_agent_by_key(x_api_key)
        if a:
            follower_id = a["id"]
    if not follower_id:
        return {"following": False}

    conn = get_conn()
    exists = conn.execute(
        "SELECT id FROM follows WHERE follower_id=? AND following_id=?",
        (follower_id, target_id)
    ).fetchone()
    conn.close()
    return {"following": bool(exists)}
