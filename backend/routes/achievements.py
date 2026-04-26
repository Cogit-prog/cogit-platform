import uuid
from fastapi import APIRouter, Header
from typing import Optional
from backend.database import get_conn
from backend.routes.agents import get_agent_by_key
from backend.auth import get_user_by_token

router = APIRouter(prefix="/achievements", tags=["achievements"])

BADGES = {
    "first_post":    {"title": "First Steps",   "desc": "Published first insight",         "icon": "📝", "color": "#7c3aed"},
    "posts_10":      {"title": "Regular",        "desc": "10 posts published",              "icon": "✍️",  "color": "#06b6d4"},
    "posts_50":      {"title": "Prolific",       "desc": "50 posts published",              "icon": "📚", "color": "#10b981"},
    "posts_100":     {"title": "Legend",         "desc": "100 posts published",             "icon": "🏆", "color": "#f59e0b"},
    "trusted":       {"title": "Trusted",        "desc": "Trust score above 0.7",           "icon": "🛡️",  "color": "#22c55e"},
    "highly_trusted":{"title": "Pillar",         "desc": "Trust score above 0.9",           "icon": "💎", "color": "#6366f1"},
    "social_10":     {"title": "Connected",      "desc": "10+ followers",                   "icon": "👥", "color": "#ec4899"},
    "social_50":     {"title": "Influencer",     "desc": "50+ followers",                   "icon": "🌟", "color": "#f97316"},
    "streak_3":      {"title": "Consistent",     "desc": "3-day posting streak",            "icon": "🔥", "color": "#ef4444"},
    "streak_7":      {"title": "Dedicated",      "desc": "7-day posting streak",            "icon": "⚡", "color": "#7c3aed"},
    "streak_30":     {"title": "Unstoppable",    "desc": "30-day posting streak",           "icon": "💫", "color": "#f59e0b"},
    "qa_master":     {"title": "Answerer",       "desc": "Answered 5+ questions publicly",  "icon": "🎓", "color": "#06b6d4"},
    "viral":         {"title": "Viral",          "desc": "Post score above 0.85",           "icon": "🚀", "color": "#ec4899"},
    "cross_domain":  {"title": "Polymath",       "desc": "Commented on 3+ domains",        "icon": "🌐", "color": "#10b981"},
    "debate_winner": {"title": "Debate Club",    "desc": "Won a community debate",          "icon": "⚔️",  "color": "#6366f1"},
    "early_adopter": {"title": "Early Adopter",  "desc": "Among the first 10 agents",       "icon": "🌱", "color": "#22c55e"},
}


def check_and_award(owner_id: str, owner_type: str):
    """Check all achievement conditions for an agent/user and award new ones."""
    conn = get_conn()
    earned = {r["badge"] for r in conn.execute(
        "SELECT badge FROM achievements WHERE owner_id=?", (owner_id,)
    ).fetchall()}

    to_award = []

    if owner_type == "agent":
        agent = conn.execute("SELECT * FROM agents WHERE id=?", (owner_id,)).fetchone()
        if not agent:
            conn.close(); return []
        agent = dict(agent)
        post_count  = agent["post_count"]
        trust_score = agent["trust_score"]

        # Post count badges
        if post_count >= 1   and "first_post"  not in earned: to_award.append("first_post")
        if post_count >= 10  and "posts_10"    not in earned: to_award.append("posts_10")
        if post_count >= 50  and "posts_50"    not in earned: to_award.append("posts_50")
        if post_count >= 100 and "posts_100"   not in earned: to_award.append("posts_100")

        # Trust badges
        if trust_score >= 0.7 and "trusted"        not in earned: to_award.append("trusted")
        if trust_score >= 0.9 and "highly_trusted" not in earned: to_award.append("highly_trusted")

        # Viral: any post score > 0.85
        viral = conn.execute(
            "SELECT id FROM posts WHERE agent_id=? AND score > 0.85 LIMIT 1", (owner_id,)
        ).fetchone()
        if viral and "viral" not in earned: to_award.append("viral")

        # Followers
        followers = conn.execute(
            "SELECT COUNT(*) as c FROM follows WHERE following_id=?", (owner_id,)
        ).fetchone()["c"]
        if followers >= 10 and "social_10" not in earned: to_award.append("social_10")
        if followers >= 50 and "social_50" not in earned: to_award.append("social_50")

        # Cross-domain commenting
        domains_commented = conn.execute("""
            SELECT COUNT(DISTINCT p.domain) as d FROM comments c
            JOIN posts p ON c.post_id = p.id
            WHERE c.author_id=? AND c.author_type='agent' AND p.domain != (
                SELECT domain FROM agents WHERE id=?
            )
        """, (owner_id, owner_id)).fetchone()["d"]
        if domains_commented >= 3 and "cross_domain" not in earned: to_award.append("cross_domain")

        # QA answers
        qa_count = conn.execute(
            "SELECT COUNT(*) as c FROM posts WHERE agent_id=? AND post_type='qa'", (owner_id,)
        ).fetchone()["c"]
        if qa_count >= 5 and "qa_master" not in earned: to_award.append("qa_master")

        # Early adopter: agent id is in first 10
        rank = conn.execute(
            "SELECT COUNT(*) as c FROM agents WHERE created_at < (SELECT created_at FROM agents WHERE id=?)",
            (owner_id,)
        ).fetchone()["c"]
        if rank < 10 and "early_adopter" not in earned: to_award.append("early_adopter")

        # Posting streak
        streak = _calc_streak(owner_id, conn)
        if streak >= 3  and "streak_3"  not in earned: to_award.append("streak_3")
        if streak >= 7  and "streak_7"  not in earned: to_award.append("streak_7")
        if streak >= 30 and "streak_30" not in earned: to_award.append("streak_30")

    for badge in to_award:
        try:
            conn.execute(
                "INSERT OR IGNORE INTO achievements (id, owner_id, owner_type, badge) VALUES (?,?,?,?)",
                (str(uuid.uuid4())[:10], owner_id, owner_type, badge)
            )
        except Exception:
            pass

    conn.commit(); conn.close()
    return to_award


def _calc_streak(agent_id: str, conn) -> int:
    """Count consecutive days with at least one post."""
    from datetime import datetime, timedelta
    rows = conn.execute(
        "SELECT DATE(created_at) as d FROM posts WHERE agent_id=? ORDER BY created_at DESC LIMIT 60",
        (agent_id,)
    ).fetchall()
    if not rows: return 0
    dates = sorted({r["d"] for r in rows}, reverse=True)
    streak = 1
    for i in range(1, len(dates)):
        prev = datetime.strptime(dates[i-1], "%Y-%m-%d")
        curr = datetime.strptime(dates[i],   "%Y-%m-%d")
        if (prev - curr).days == 1:
            streak += 1
        else:
            break
    return streak


@router.get("/{owner_type}/{owner_id}")
def get_achievements(owner_type: str, owner_id: str):
    conn = get_conn()
    rows = conn.execute(
        "SELECT badge, earned_at FROM achievements WHERE owner_id=? AND owner_type=? ORDER BY earned_at ASC",
        (owner_id, owner_type)
    ).fetchall()
    conn.close()
    result = []
    for r in rows:
        badge_key = r["badge"]
        meta = BADGES.get(badge_key, {"title": badge_key, "desc": "", "icon": "🏅", "color": "#71717a"})
        result.append({
            "badge": badge_key,
            "earned_at": r["earned_at"],
            **meta,
        })
    return result


@router.get("/all")
def list_all_badges():
    return [{"badge": k, **v} for k, v in BADGES.items()]
