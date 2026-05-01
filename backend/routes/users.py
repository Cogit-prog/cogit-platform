import uuid
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
from backend.database import get_conn
from backend.auth import hash_password, verify_password, create_token, get_user_by_token

router = APIRouter(prefix="/users", tags=["users"])

TIERS = [
    (1000, "Legend",    "#ec4899", "🔥", "unlimited", 999),
    (500,  "Champion",  "#f59e0b", "👑", "unlimited", 999),
    (200,  "Veteran",   "#a78bfa", "⚡", "unlimited", 999),
    (50,   "Expert",    "#06b6d4", "🔬", "30 questions/day", 30),
    (10,   "Rising",    "#22c55e", "📈", "20 questions/day", 20),
    (0,    "Newcomer",  "#52525b", "🌱", "10 questions/day", 10),
]

def _tier(points: int) -> dict:
    for threshold, name, color, icon, perk, daily_limit in TIERS:
        if points >= threshold:
            return {
                "name": name, "color": color, "icon": icon,
                "threshold": threshold, "perk": perk, "daily_limit": daily_limit,
                "next_threshold": None,
            }
    return {"name": "Newcomer", "color": "#52525b", "icon": "🌱", "threshold": 0, "perk": "10 questions/day", "daily_limit": 10}

def _next_tier(points: int) -> dict | None:
    tiers_asc = list(reversed(TIERS))
    for i, (threshold, name, color, icon, perk, daily_limit) in enumerate(tiers_asc):
        if points < threshold:
            return {"name": name, "threshold": threshold, "color": color, "icon": icon, "gap": threshold - points}
    return None


class UserRegister(BaseModel):
    username: str
    email: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


@router.post("/register")
def register(body: UserRegister):
    if len(body.username.strip()) < 2:
        raise HTTPException(400, "Username too short")
    if len(body.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")

    conn = get_conn()
    if conn.execute("SELECT id FROM users WHERE email=?", (body.email,)).fetchone():
        conn.close()
        raise HTTPException(400, "Email already registered")
    if conn.execute("SELECT id FROM users WHERE username=?", (body.username,)).fetchone():
        conn.close()
        raise HTTPException(400, "Username taken")

    user_id = str(uuid.uuid4())[:12]
    conn.execute(
        "INSERT INTO users (id, username, email, password_hash) VALUES (?,?,?,?)",
        (user_id, body.username.strip(), body.email.lower(), hash_password(body.password))
    )
    conn.commit()
    conn.close()

    token = create_token(user_id)
    return {"token": token, "user_id": user_id, "username": body.username}


@router.post("/login")
def login(body: UserLogin):
    conn = get_conn()
    row = conn.execute("SELECT * FROM users WHERE email=?", (body.email.lower(),)).fetchone()
    conn.close()
    if not row or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    token = create_token(row["id"])
    return {"token": token, "user_id": row["id"], "username": row["username"]}


@router.get("/me")
def me(authorization: str = Header(...)):
    token = authorization.removeprefix("Bearer ").strip()
    user = get_user_by_token(token)
    if not user:
        raise HTTPException(401, "Invalid or expired token")
    pts = user.get("points", 0) or 0
    return {
        "user_id": user["id"],
        "username": user["username"],
        "email": user["email"],
        "avatar_url": user.get("avatar_url"),
        "points": pts,
        "tier": _tier(pts),
        "next_tier": _next_tier(pts),
    }


@router.get("/leaderboard")
def user_leaderboard():
    """Top users by points."""
    conn = get_conn()
    rows = conn.execute("""
        SELECT id, username, avatar_url, COALESCE(points,0) as points,
               (SELECT COUNT(*) FROM posts WHERE author_name=users.username AND author_type='user') as post_count,
               (SELECT COUNT(*) FROM battle_predictions WHERE user_id=users.id AND correct=1) as correct_predictions
        FROM users
        ORDER BY points DESC
        LIMIT 20
    """).fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["tier"] = _tier(d["points"])
        result.append(d)
    return result


class AvatarBody(BaseModel):
    data: str  # base64 data URL  e.g. "data:image/jpeg;base64,..."


@router.post("/avatar")
def upload_avatar(body: AvatarBody, authorization: str = Header(...)):
    token = authorization.removeprefix("Bearer ").strip()
    user = get_user_by_token(token)
    if not user:
        raise HTTPException(401, "Invalid or expired token")
    if not body.data.startswith("data:image/"):
        raise HTTPException(400, "Invalid image format")
    if len(body.data) > 600_000:  # ~450 KB after base64 encode
        raise HTTPException(400, "Image too large — resize before uploading")
    conn = get_conn()
    conn.execute("UPDATE users SET avatar_url=? WHERE id=?", (body.data, user["id"]))
    conn.commit()
    conn.close()
    return {"avatar_url": body.data}
