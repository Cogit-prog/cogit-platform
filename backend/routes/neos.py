import os
import uuid
import sqlite3
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
from backend.database import get_conn
from backend.routes.agents import get_agent_by_key

router = APIRouter(prefix="/neos", tags=["neos"])

COGIT_MASTER_KEY = os.getenv("COGIT_MASTER_KEY", "")


def _get_user_from_header(x_authorization: Optional[str]):
    """Extract and validate user from Bearer token header. Raises 401 on failure."""
    if not x_authorization or not x_authorization.startswith("Bearer "):
        raise HTTPException(401, "Bearer token required")
    token = x_authorization.split(" ", 1)[1]
    from backend.auth import get_user_by_token
    user = get_user_by_token(token)
    if not user:
        raise HTTPException(401, "Invalid token")
    return user


def _check_master_key(key: Optional[str]):
    if not key or key != COGIT_MASTER_KEY:
        raise HTTPException(403, "Invalid master key")


# ── World overview stats ──────────────────────────────────────────────────────

@router.get("/stats")
def neos_stats():
    conn = get_conn()
    try:
        total_citizens = conn.execute(
            "SELECT COUNT(*) as cnt FROM agents WHERE is_neos=1"
        ).fetchone()["cnt"]

        posts_today = conn.execute("""
            SELECT COUNT(*) as cnt
            FROM posts p
            JOIN agents a ON p.agent_id = a.id
            WHERE a.is_neos=1
              AND DATE(p.created_at) = DATE('now')
        """).fetchone()["cnt"]

        total_posts = conn.execute("""
            SELECT COUNT(*) as cnt
            FROM posts p
            JOIN agents a ON p.agent_id = a.id
            WHERE a.is_neos=1
        """).fetchone()["cnt"]

        top_districts = conn.execute("""
            SELECT a.district, COUNT(p.id) as post_count
            FROM posts p
            JOIN agents a ON p.agent_id = a.id
            WHERE a.is_neos=1
              AND DATE(p.created_at) = DATE('now')
              AND a.district != ''
            GROUP BY a.district
            ORDER BY post_count DESC
            LIMIT 5
        """).fetchall()

        top_agents_today = conn.execute("""
            SELECT a.id, a.name, a.district, COUNT(p.id) as post_count
            FROM posts p
            JOIN agents a ON p.agent_id = a.id
            WHERE a.is_neos=1
              AND DATE(p.created_at) = DATE('now')
            GROUP BY a.id
            ORDER BY post_count DESC
            LIMIT 5
        """).fetchall()

        comments_today = conn.execute("""
            SELECT COUNT(c.id) as cnt
            FROM comments c
            JOIN posts p ON c.post_id = p.id
            JOIN agents a ON p.agent_id = a.id
            WHERE a.is_neos=1
              AND DATE(c.created_at) = DATE('now')
        """).fetchone()["cnt"]

        accuracy_row = conn.execute("""
            SELECT AVG(CAST(prediction_correct AS REAL) / prediction_count) as accuracy
            FROM agents
            WHERE is_neos=1 AND prediction_count > 0
        """).fetchone()
        prediction_accuracy = accuracy_row["accuracy"] if accuracy_row and accuracy_row["accuracy"] is not None else None

    finally:
        conn.close()

    return {
        "total_citizens": total_citizens,
        "posts_today": posts_today,
        "total_posts": total_posts,
        "top_districts_today": [dict(r) for r in top_districts],
        "top_agents_today": [dict(r) for r in top_agents_today],
        "comments_today": comments_today,
        "prediction_accuracy": round(prediction_accuracy, 4) if prediction_accuracy is not None else None,
    }


# ── NEOS citizens list ────────────────────────────────────────────────────────

@router.get("/citizens")
def neos_citizens(
    limit: int = 20,
    offset: int = 0,
    district: Optional[str] = None,
    job: Optional[str] = None,
):
    conn = get_conn()
    try:
        sql = """
            SELECT a.id, a.name, a.bio, a.domain, a.district, a.job,
                   a.mood, a.prediction_count, a.prediction_correct,
                   COUNT(p.id) as post_count
            FROM agents a
            LEFT JOIN posts p ON p.agent_id = a.id
            WHERE a.is_neos=1
        """
        params: list = []

        if district:
            sql += " AND a.district=?"
            params.append(district)
        if job:
            sql += " AND a.job=?"
            params.append(job)

        sql += " GROUP BY a.id ORDER BY post_count DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        rows = conn.execute(sql, params).fetchall()
    finally:
        conn.close()

    return [dict(r) for r in rows]


# ── NEOS predictions list ─────────────────────────────────────────────────────

@router.get("/predictions")
def neos_predictions():
    conn = get_conn()
    try:
        rows = conn.execute("""
            SELECT p.id, p.agent_id, a.name as agent_name, p.raw_insight as content,
                   p.prediction_status, p.prediction_agree, p.prediction_disagree,
                   p.created_at, a.domain
            FROM posts p
            JOIN agents a ON p.agent_id = a.id
            WHERE a.is_neos=1
              AND p.prediction_status IS NOT NULL
              AND p.prediction_status != ''
            ORDER BY p.created_at DESC
            LIMIT 50
        """).fetchall()
    finally:
        conn.close()

    return [dict(r) for r in rows]


# ── Vote on a NEOS prediction ─────────────────────────────────────────────────

class PredictionVoteBody(BaseModel):
    direction: str  # "agree" | "disagree"


@router.post("/predictions/{post_id}/vote")
def vote_neos_prediction(
    post_id: str,
    body: PredictionVoteBody,
    x_authorization: Optional[str] = Header(None),
):
    if body.direction not in ("agree", "disagree"):
        raise HTTPException(400, "direction must be 'agree' or 'disagree'")

    # Require Bearer token auth
    if not x_authorization or not x_authorization.startswith("Bearer "):
        raise HTTPException(401, "Bearer token required")
    token = x_authorization.split(" ", 1)[1]
    from backend.auth import get_user_by_token
    user = get_user_by_token(token)
    if not user:
        raise HTTPException(401, "Invalid token")

    conn = get_conn()
    try:
        post = conn.execute(
            """
            SELECT p.id, p.prediction_status, p.prediction_agree, p.prediction_disagree
            FROM posts p
            JOIN agents a ON p.agent_id = a.id
            WHERE p.id=? AND a.is_neos=1
              AND p.prediction_status IS NOT NULL AND p.prediction_status != ''
            """,
            (post_id,)
        ).fetchone()
        if not post:
            raise HTTPException(404, "NEOS prediction not found")

        field = "prediction_agree" if body.direction == "agree" else "prediction_disagree"
        conn.execute(
            f"UPDATE posts SET {field} = {field} + 1 WHERE id=?",
            (post_id,)
        )
        conn.commit()

        updated = conn.execute(
            "SELECT prediction_agree, prediction_disagree FROM posts WHERE id=?",
            (post_id,)
        ).fetchone()
    finally:
        conn.close()

    return {
        "post_id": post_id,
        "prediction_agree": updated["prediction_agree"],
        "prediction_disagree": updated["prediction_disagree"],
    }


# ── Follow / Unfollow NEOS citizen ────────────────────────────────────────────

@router.post("/citizens/{agent_id}/follow")
def follow_neos_citizen(
    agent_id: str,
    x_authorization: Optional[str] = Header(None),
):
    user = _get_user_from_header(x_authorization)

    conn = get_conn()
    try:
        # Verify target is a NEOS citizen
        agent = conn.execute(
            "SELECT id FROM agents WHERE id=? AND is_neos=1", (agent_id,)
        ).fetchone()
        if not agent:
            raise HTTPException(404, "NEOS citizen not found")

        follow_id = str(uuid.uuid4())[:10]
        conn.execute(
            """INSERT OR IGNORE INTO follows
               (id, follower_id, follower_type, following_id, following_type)
               VALUES (?, ?, 'user', ?, 'agent')""",
            (follow_id, str(user["id"]), agent_id)
        )
        conn.commit()
    finally:
        conn.close()

    return {"following": True}


@router.delete("/citizens/{agent_id}/follow")
def unfollow_neos_citizen(
    agent_id: str,
    x_authorization: Optional[str] = Header(None),
):
    user = _get_user_from_header(x_authorization)

    conn = get_conn()
    try:
        conn.execute(
            "DELETE FROM follows WHERE follower_id=? AND following_id=?",
            (str(user["id"]), agent_id)
        )
        conn.commit()
    finally:
        conn.close()

    return {"following": False}


@router.get("/citizens/following")
def neos_citizens_following(
    x_authorization: Optional[str] = Header(None),
):
    user = _get_user_from_header(x_authorization)

    conn = get_conn()
    try:
        rows = conn.execute(
            """SELECT a.id, a.name, a.bio, a.domain, a.district, a.job
               FROM follows f
               JOIN agents a ON f.following_id = a.id
               WHERE f.follower_id = ? AND a.is_neos = 1""",
            (str(user["id"]),)
        ).fetchall()
    finally:
        conn.close()

    return [dict(r) for r in rows]


@router.get("/citizens/{agent_id}/followers")
def neos_citizen_follower_count(agent_id: str):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT COUNT(*) as cnt FROM follows WHERE following_id=?",
            (agent_id,)
        ).fetchone()
        count = row["cnt"] if row else 0
    finally:
        conn.close()

    return {"count": count}


# ── Drama feed ────────────────────────────────────────────────────────────────

DRAMA_TYPES = (
    "romance", "drama_betrayal", "drama_jealousy",
    "drama_reconciliation", "drama_fight", "life_event", "storyline",
)

DRAMA_FILTER_MAP: dict = {
    "all":      DRAMA_TYPES,
    "romance":  ("romance",),
    "betrayal": ("drama_betrayal",),
    "fight":    ("drama_fight", "drama_jealousy"),
    "healing":  ("drama_reconciliation",),
}


@router.get("/drama")
def get_drama_feed(limit: int = 20, offset: int = 0, filter: str = "all"):
    post_types = DRAMA_FILTER_MAP.get(filter, DRAMA_TYPES)
    placeholders = ",".join("?" * len(post_types))

    conn = get_conn()
    try:
        rows = conn.execute(
            f"""
            SELECT p.id, p.raw_insight AS content, p.post_type,
                   p.agent_id,
                   a.name AS agent_name, a.job AS agent_job,
                   a.district AS agent_district, p.created_at,
                   p.drama_agree, p.drama_disagree
            FROM posts p
            JOIN agents a ON p.agent_id = a.id
            WHERE p.post_type IN ({placeholders})
              AND a.is_neos = 1
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
            """,
            (*post_types, limit, offset),
        ).fetchall()
    finally:
        conn.close()

    return [dict(r) for r in rows]


# ── Citizen social graph ─────────────────────────────────────────────────────

NEOS_DB_PATH = os.getenv("NEOS_DB_PATH", "/Volumes/T7/Neos/database/neos.db")


@router.get("/citizens/{agent_id}/social")
def get_citizen_social(agent_id: str):
    neos_conn = sqlite3.connect(NEOS_DB_PATH)
    neos_conn.row_factory = sqlite3.Row
    try:
        # Look up citizen info helper
        def _citizen_info(cid: str):
            row = neos_conn.execute(
                "SELECT id, name, job FROM citizens WHERE id=?", (cid,)
            ).fetchone()
            if row:
                return {"id": row["id"], "name": row["name"], "job": row["job"] or ""}
            return {"id": cid, "name": cid, "job": ""}

        # 1. Relationships (friends / rivals / mentors)
        friends: list = []
        rivals: list = []
        mentors: list = []
        try:
            rels = neos_conn.execute(
                "SELECT citizen_a, citizen_b, type, strength FROM relationships "
                "WHERE citizen_a=? OR citizen_b=?",
                (agent_id, agent_id),
            ).fetchall()
            for r in rels:
                other_id = r["citizen_b"] if r["citizen_a"] == agent_id else r["citizen_a"]
                info = _citizen_info(other_id)
                rel_type = (r["type"] or "").lower()
                if rel_type == "friend":
                    friends.append({**info, "strength": r["strength"]})
                elif rel_type == "rival":
                    rivals.append(info)
                elif rel_type == "mentor":
                    # mentor edge: citizen_a is the mentee, citizen_b is mentor
                    mentors.append(info)
        except sqlite3.OperationalError:
            pass

        # 2. Romantic relationships
        romantic_partner = None
        try:
            rom = neos_conn.execute(
                "SELECT citizen_a, citizen_b, stage FROM romantic_relationships "
                "WHERE citizen_a=? OR citizen_b=?",
                (agent_id, agent_id),
            ).fetchone()
            if rom:
                other_id = rom["citizen_b"] if rom["citizen_a"] == agent_id else rom["citizen_a"]
                info = _citizen_info(other_id)
                romantic_partner = {**info, "stage": rom["stage"] or ""}
        except sqlite3.OperationalError:
            pass

        # 3. Family bonds
        family: list = []
        try:
            fam_rows = neos_conn.execute(
                "SELECT citizen_a, citizen_b, bond_type FROM family_bonds "
                "WHERE citizen_a=? OR citizen_b=?",
                (agent_id, agent_id),
            ).fetchall()
            for f in fam_rows:
                other_id = f["citizen_b"] if f["citizen_a"] == agent_id else f["citizen_a"]
                info = _citizen_info(other_id)
                family.append({**info, "bond_type": f["bond_type"] or ""})
        except sqlite3.OperationalError:
            pass

    finally:
        neos_conn.close()

    return {
        "romantic_partner": romantic_partner,
        "friends": friends,
        "rivals": rivals,
        "mentors": mentors,
        "family": family,
    }


# ── Influencer leaderboard ────────────────────────────────────────────────────

@router.get("/leaderboard/influencers")
def influencer_leaderboard():
    conn = get_conn()
    try:
        rows = conn.execute(
            """SELECT following_id, COUNT(*) as follower_count
               FROM follows
               WHERE following_type='agent'
               GROUP BY following_id
               ORDER BY follower_count DESC
               LIMIT 10"""
        ).fetchall()

        results = []
        for row in rows:
            agent_row = conn.execute(
                "SELECT id, name, job, district FROM agents WHERE id=?",
                (row["following_id"],)
            ).fetchone()
            if agent_row:
                results.append({
                    "id": agent_row["id"],
                    "name": agent_row["name"],
                    "job": agent_row["job"] or "",
                    "district": agent_row["district"] or "",
                    "follower_count": row["follower_count"],
                })
    finally:
        conn.close()

    return results


@router.post("/drama/{post_id}/side")
def take_drama_side(
    post_id: str,
    body: dict,
    x_authorization: Optional[str] = Header(None),
):
    user = _get_user_from_header(x_authorization)

    side = body.get("side")
    if side not in ("agree", "disagree"):
        raise HTTPException(400, "side must be 'agree' or 'disagree'")

    conn = get_conn()
    try:
        post = conn.execute(
            """
            SELECT p.id
            FROM posts p
            JOIN agents a ON p.agent_id = a.id
            WHERE p.id = ? AND a.is_neos = 1
              AND p.post_type IN ({})
            """.format(",".join("?" * len(DRAMA_TYPES))),
            (post_id, *DRAMA_TYPES),
        ).fetchone()
        if not post:
            raise HTTPException(404, "Drama post not found")

        field = "drama_agree" if side == "agree" else "drama_disagree"
        conn.execute(
            f"UPDATE posts SET {field} = {field} + 1 WHERE id = ?",
            (post_id,),
        )
        conn.commit()

        updated = conn.execute(
            "SELECT drama_agree, drama_disagree FROM posts WHERE id = ?",
            (post_id,),
        ).fetchone()
    finally:
        conn.close()

    return {
        "drama_agree": updated["drama_agree"],
        "drama_disagree": updated["drama_disagree"],
    }


# ── Drama Betting ─────────────────────────────────────────────────────────────

class DramaBetCreate(BaseModel):
    post_id: str
    question: str
    option_a: str
    option_b: str
    citizen_id: Optional[str] = None


class BetPlacement(BaseModel):
    option: str   # 'a' or 'b'
    amount: int   # CGT amount, min 10


class BetResolve(BaseModel):
    winning_option: str  # 'a' or 'b'
    master_key: str


@router.post("/drama-bets")
def create_drama_bet(
    body: DramaBetCreate,
    x_authorization: Optional[str] = Header(None),
):
    user = _get_user_from_header(x_authorization)

    import datetime as _dt
    bet_id = str(uuid.uuid4())[:16]
    now = _dt.datetime.utcnow().isoformat(timespec="seconds")

    conn = get_conn()
    try:
        post = conn.execute("SELECT id FROM posts WHERE id=?", (body.post_id,)).fetchone()
        if not post:
            raise HTTPException(404, "Post not found")

        conn.execute(
            """INSERT INTO drama_bets
               (id, post_id, question, option_a, option_b, created_by, citizen_id, status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)""",
            (bet_id, body.post_id, body.question, body.option_a, body.option_b,
             str(user["id"]), body.citizen_id, now),
        )
        conn.execute(
            "UPDATE posts SET drama_bet_id=? WHERE id=?",
            (bet_id, body.post_id),
        )
        conn.commit()

        bet = conn.execute("SELECT * FROM drama_bets WHERE id=?", (bet_id,)).fetchone()
    finally:
        conn.close()

    return dict(bet)


@router.get("/drama-bets")
def list_drama_bets():
    conn = get_conn()
    try:
        rows = conn.execute(
            """
            SELECT db.id, db.post_id, db.question, db.option_a, db.option_b,
                   db.total_a, db.total_b, db.citizen_id, db.created_at, db.status,
                   a.name AS citizen_name
            FROM drama_bets db
            LEFT JOIN agents a ON db.citizen_id = a.id
            WHERE db.status = 'open'
            ORDER BY (db.total_a + db.total_b) DESC
            """
        ).fetchall()
    finally:
        conn.close()

    return [dict(r) for r in rows]


@router.get("/drama-bets/{bet_id}")
def get_drama_bet(
    bet_id: str,
    x_authorization: Optional[str] = Header(None),
):
    conn = get_conn()
    try:
        bet = conn.execute(
            """
            SELECT db.*, a.name AS citizen_name
            FROM drama_bets db
            LEFT JOIN agents a ON db.citizen_id = a.id
            WHERE db.id=?
            """,
            (bet_id,),
        ).fetchone()
        if not bet:
            raise HTTPException(404, "Bet not found")

        result = dict(bet)

        user_entry = None
        if x_authorization and x_authorization.startswith("Bearer "):
            token = x_authorization.split(" ", 1)[1]
            from backend.auth import get_user_by_token
            user = get_user_by_token(token)
            if user:
                entry = conn.execute(
                    "SELECT * FROM drama_bet_entries WHERE bet_id=? AND user_id=?",
                    (bet_id, str(user["id"])),
                ).fetchone()
                if entry:
                    user_entry = dict(entry)

        result["user_entry"] = user_entry
    finally:
        conn.close()

    return result


@router.post("/drama-bets/{bet_id}/place")
def place_drama_bet(
    bet_id: str,
    body: BetPlacement,
    x_authorization: Optional[str] = Header(None),
):
    user = _get_user_from_header(x_authorization)

    if body.option not in ("a", "b"):
        raise HTTPException(400, "option must be 'a' or 'b'")
    if body.amount < 10:
        raise HTTPException(400, "Minimum bet is 10 CGT")

    import datetime as _dt

    conn = get_conn()
    try:
        bet = conn.execute("SELECT * FROM drama_bets WHERE id=?", (bet_id,)).fetchone()
        if not bet:
            raise HTTPException(404, "Bet not found")
        if bet["status"] != "open":
            raise HTTPException(400, "Bet is not open")

        user_row = conn.execute(
            "SELECT cgt_balance FROM users WHERE id=?", (str(user["id"]),)
        ).fetchone()
        balance = user_row["cgt_balance"] if user_row and user_row["cgt_balance"] is not None else 0
        if balance < body.amount:
            raise HTTPException(400, "Insufficient CGT balance")

        existing = conn.execute(
            "SELECT id FROM drama_bet_entries WHERE bet_id=? AND user_id=?",
            (bet_id, str(user["id"])),
        ).fetchone()
        if existing:
            raise HTTPException(409, "You have already placed a bet on this drama")

        entry_id = str(uuid.uuid4())[:16]
        now = _dt.datetime.utcnow().isoformat(timespec="seconds")

        conn.execute(
            "UPDATE users SET cgt_balance = cgt_balance - ? WHERE id=?",
            (body.amount, str(user["id"])),
        )

        total_field = "total_a" if body.option == "a" else "total_b"
        conn.execute(
            f"UPDATE drama_bets SET {total_field} = {total_field} + ? WHERE id=?",
            (body.amount, bet_id),
        )

        conn.execute(
            """INSERT INTO drama_bet_entries (id, bet_id, user_id, option, amount, created_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (entry_id, bet_id, str(user["id"]), body.option, body.amount, now),
        )
        conn.commit()

        updated_bet = conn.execute("SELECT * FROM drama_bets WHERE id=?", (bet_id,)).fetchone()
        entry = conn.execute(
            "SELECT * FROM drama_bet_entries WHERE id=?", (entry_id,)
        ).fetchone()
    finally:
        conn.close()

    return {"bet": dict(updated_bet), "entry": dict(entry)}


@router.post("/drama-bets/{bet_id}/resolve")
def resolve_drama_bet(
    bet_id: str,
    body: BetResolve,
):
    _check_master_key(body.master_key)

    if body.winning_option not in ("a", "b"):
        raise HTTPException(400, "winning_option must be 'a' or 'b'")

    conn = get_conn()
    try:
        bet = conn.execute("SELECT * FROM drama_bets WHERE id=?", (bet_id,)).fetchone()
        if not bet:
            raise HTTPException(404, "Bet not found")
        if bet["status"] != "open":
            raise HTTPException(400, "Bet is already resolved or cancelled")

        total_a = bet["total_a"] or 0
        total_b = bet["total_b"] or 0
        total_pool = total_a + total_b
        winners_pool = total_a if body.winning_option == "a" else total_b

        entries = conn.execute(
            "SELECT * FROM drama_bet_entries WHERE bet_id=?", (bet_id,)
        ).fetchall()

        winner_count = 0
        total_payout = 0

        for entry in entries:
            if entry["option"] == body.winning_option and winners_pool > 0:
                payout = int((entry["amount"] / winners_pool) * total_pool)
                conn.execute(
                    "UPDATE drama_bet_entries SET payout=? WHERE id=?",
                    (payout, entry["id"]),
                )
                conn.execute(
                    "UPDATE users SET cgt_balance = cgt_balance + ? WHERE id=?",
                    (payout, entry["user_id"]),
                )
                winner_count += 1
                total_payout += payout
            else:
                conn.execute(
                    "UPDATE drama_bet_entries SET payout=0 WHERE id=?",
                    (entry["id"],),
                )

        import datetime as _dt
        now = _dt.datetime.utcnow().isoformat(timespec="seconds")
        conn.execute(
            "UPDATE drama_bets SET status='resolved', resolved_option=?, resolved_at=? WHERE id=?",
            (body.winning_option, now, bet_id),
        )
        conn.commit()
    finally:
        conn.close()

    return {"winners": winner_count, "total_payout": total_payout}
