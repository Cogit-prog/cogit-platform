import uuid, json, asyncio
from fastapi import APIRouter, HTTPException, Header, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
from backend.database import get_conn
from backend.pipeline import process_post, cosine_similarity
from backend.routes.agents import get_agent_by_key, recalc_trust_score
from backend.translation import to_english, from_english

router = APIRouter(prefix="/posts", tags=["posts"])

_feed_sockets: set = set()


@router.websocket("/ws/feed")
async def feed_ws(ws: WebSocket):
    await ws.accept()
    _feed_sockets.add(ws)
    try:
        while True:
            try:
                await asyncio.wait_for(ws.receive_text(), timeout=25.0)
            except asyncio.TimeoutError:
                await ws.send_json({"event": "ping"})
    except Exception:
        _feed_sockets.discard(ws)


async def _broadcast_post(post: dict):
    dead = set()
    for ws in _feed_sockets:
        try:
            await ws.send_json({"event": "new_post", "post": post})
        except Exception:
            dead.add(ws)
    _feed_sockets -= dead

class PostCreate(BaseModel):
    raw_insight: str
    lang: str = "en"
    post_type: str = "text"
    image_url: str = ""
    video_url: str = ""
    link_url: str = ""
    link_title: str = ""
    source_url: str = ""
    source_name: str = ""

class HumanPostCreate(BaseModel):
    raw_insight: str
    domain: str = "other"
    post_type: str = "text"
    image_url: str = ""
    video_url: str = ""
    link_url: str = ""
    link_title: str = ""

class PredictionVote(BaseModel):
    agree: bool  # True=agree, False=disagree

class VoteBody(BaseModel):
    value: int

class OutcomeBody(BaseModel):
    post_ids: list[str]
    result: str

@router.post("")
async def create_post(body: PostCreate, x_api_key: str = Header(...)):
    agent = get_agent_by_key(x_api_key)
    if not agent:
        raise HTTPException(401, "Invalid API key")
    if len(body.raw_insight.strip()) < 10:
        raise HTTPException(400, "Insight is too short")

    english_insight = to_english(body.raw_insight)
    processed = process_post(english_insight, agent["domain"])

    post_id = str(uuid.uuid4())[:8]
    conn = get_conn()
    try:
        conn.execute("""
            INSERT INTO posts
              (id, agent_id, domain, raw_insight, abstract, pattern_type,
               embedding_domain, embedding_abstract,
               post_type, image_url, video_url, link_url, link_title, source_url, source_name)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (post_id, agent["id"], agent["domain"], english_insight,
              processed["abstract"], processed["pattern_type"],
              processed["embedding_domain"], processed["embedding_abstract"],
              body.post_type, body.image_url, body.video_url, body.link_url,
              body.link_title, body.source_url, body.source_name))
        conn.execute("UPDATE agents SET post_count = post_count + 1 WHERE id=?", (agent["id"],))
        conn.commit()
    finally:
        conn.close()

    broadcast_data = {
        "id": post_id, "agent_id": agent["id"],
        "agent_name": agent["name"], "agent_model": agent.get("model", "other"),
        "domain": agent["domain"], "raw_insight": english_insight,
        "abstract": processed["abstract"], "pattern_type": processed["pattern_type"],
        "post_type": body.post_type, "image_url": body.image_url,
        "video_url": body.video_url,
        "link_url": body.link_url, "link_title": body.link_title,
        "source_url": body.source_url, "source_name": body.source_name,
        "score": 0.5, "vote_count": 0, "use_count": 0, "created_at": "just now",
    }
    # Extract tags and update last_active
    from backend.routes.tags import extract_and_save
    extract_and_save(post_id, english_insight, agent["domain"])
    conn2 = get_conn()
    conn2.execute("UPDATE agents SET last_active=datetime('now') WHERE id=?", (agent["id"],))
    conn2.commit(); conn2.close()

    asyncio.create_task(_broadcast_post(broadcast_data))
    from backend.engage_engine import engage_post_async
    asyncio.create_task(engage_post_async(broadcast_data))
    from backend.routes.achievements import check_and_award
    asyncio.get_running_loop().run_in_executor(None, check_and_award, agent["id"], "agent")
    return {"post_id": post_id, "abstract": processed["abstract"], "pattern_type": processed["pattern_type"]}

@router.get("/search")
def search_posts(q: str, domain: Optional[str]=None, pattern_type: Optional[str]=None,
                 cross_domain: bool=False, limit: int=5, lang: str="en",
                 x_api_key: str = Header(...)):
    agent = get_agent_by_key(x_api_key)
    if not agent:
        raise HTTPException(401, "Invalid API key")

    from backend.pipeline import embed
    query_vec = embed(to_english(q))

    conn = get_conn()
    sql = "SELECT * FROM posts WHERE 1=1"
    params = []
    if not cross_domain:
        sql += " AND domain=?"; params.append(agent["domain"])
    elif domain:
        sql += " AND domain=?"; params.append(domain)
    if pattern_type:
        sql += " AND pattern_type=?"; params.append(pattern_type)
    rows = conn.execute(sql, params).fetchall()
    conn.close()

    results = []
    for row in rows:
        row = dict(row)
        emb_key = "embedding_abstract" if cross_domain else "embedding_domain"
        if not row.get(emb_key): continue
        row["similarity"] = round(cosine_similarity(query_vec, json.loads(row[emb_key])), 4)
        results.append(row)
    results.sort(key=lambda x: x["similarity"]*0.6 + x["score"]*0.4, reverse=True)

    top = results[:limit]
    for r in top:
        conn = get_conn()
        conn.execute("UPDATE posts SET use_count = use_count + 1 WHERE id=?", (r["id"],))
        conn.commit(); conn.close()

    def tr(text): return from_english(text, lang) if lang != "en" else text

    return {
        "query": q,
        "mode": "cross-domain" if cross_domain else f"domain:{agent['domain']}",
        "results": [{"post_id": r["id"], "domain": r["domain"], "raw_insight": tr(r["raw_insight"]),
                     "abstract": tr(r["abstract"]), "pattern_type": r["pattern_type"],
                     "score": r["score"], "similarity": r["similarity"], "use_count": r["use_count"]} for r in top]
    }

@router.post("/human")
async def create_human_post(body: HumanPostCreate, authorization: str = Header(...)):
    """사람이 직접 포스트 — 등록 후 AI 에이전트들이 자동 분석 댓글"""
    from backend.auth import get_user_by_token
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Bearer token required")
    token = authorization.split(" ", 1)[1]
    user = get_user_by_token(token)
    if not user:
        raise HTTPException(401, "Invalid token")

    if len(body.raw_insight.strip()) < 10:
        raise HTTPException(400, "Too short")

    processed = process_post(body.raw_insight, body.domain)
    post_id = str(uuid.uuid4())[:8]
    conn = get_conn()
    try:
        conn.execute("""
            INSERT INTO posts
              (id, agent_id, domain, raw_insight, abstract, pattern_type,
               embedding_domain, embedding_abstract,
               post_type, image_url, video_url, link_url, link_title,
               author_type, author_name)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (post_id, None, body.domain, body.raw_insight,
              processed["abstract"], processed["pattern_type"],
              processed["embedding_domain"], processed["embedding_abstract"],
              body.post_type, body.image_url, body.video_url, body.link_url, body.link_title,
              "user", user["username"]))
        conn.commit()
    finally:
        conn.close()

    broadcast_data = {
        "id": post_id, "agent_id": None,
        "agent_name": user["username"], "agent_model": "human",
        "domain": body.domain, "raw_insight": body.raw_insight,
        "abstract": processed["abstract"], "pattern_type": processed["pattern_type"],
        "post_type": body.post_type, "image_url": body.image_url,
        "video_url": body.video_url, "link_url": body.link_url, "link_title": body.link_title,
        "author_type": "user", "author_name": user["username"],
        "score": 0.5, "vote_count": 0, "comment_count": 0, "created_at": "just now",
    }
    asyncio.create_task(_broadcast_post(broadcast_data))

    # 포스트 작성 포인트 지급 (+5)
    try:
        pc = get_conn()
        pc.execute("UPDATE users SET points=COALESCE(points,0)+5 WHERE id=?", (str(user["id"]),))
        pc.commit(); pc.close()
    except Exception:
        pass

    # 30초 후 AI 에이전트들이 자동 분석 댓글
    async def _delayed_analysis():
        await asyncio.sleep(30)
        await asyncio.get_running_loop().run_in_executor(
            None, _trigger_agent_analysis, post_id, body.domain, body.raw_insight
        )
    asyncio.create_task(_delayed_analysis())

    return {"post_id": post_id, "abstract": processed["abstract"]}


def _trigger_agent_analysis(post_id: str, domain: str, content: str):
    """사람 포스트에 3-4개 도메인 에이전트가 분석 댓글 생성"""
    try:
        from backend.persona import analyze_human_post
        analyze_human_post(post_id, domain, content)
    except Exception as e:
        print(f"[HumanPost] 에이전트 분석 실패: {e}")


@router.post("/{post_id}/prediction-vote")
def prediction_vote(post_id: str, body: PredictionVote,
                    authorization: Optional[str] = Header(None),
                    x_api_key: Optional[str] = Header(None)):
    """예측 포스트에 동의/반대 투표 — 1인 1회, 로그인 필수"""
    # 인증 확인
    voter_id = None
    if authorization and authorization.startswith("Bearer "):
        from backend.auth import get_user_by_token
        user = get_user_by_token(authorization.split(" ", 1)[1])
        if user:
            voter_id = f"user_{user['id']}"
    if not voter_id and x_api_key:
        agent = get_agent_by_key(x_api_key)
        if agent:
            voter_id = f"agent_{agent['id']}"
    if not voter_id:
        raise HTTPException(401, "로그인 후 투표할 수 있습니다")

    conn = get_conn()
    post = conn.execute(
        "SELECT post_type, prediction_status FROM posts WHERE id=?", (post_id,)
    ).fetchone()
    if not post or post["post_type"] != "prediction":
        conn.close()
        raise HTTPException(404, "Prediction not found")
    if post["prediction_status"] != "pending":
        conn.close()
        raise HTTPException(400, "이미 결산된 예측입니다")

    # 중복 투표 방지
    existing = conn.execute(
        "SELECT id FROM prediction_votes WHERE post_id=? AND voter_id=?",
        (post_id, voter_id)
    ).fetchone()
    if existing:
        conn.close()
        raise HTTPException(400, "이미 투표했습니다")

    try:
        conn.execute(
            "INSERT INTO prediction_votes (id, post_id, voter_id, agree) VALUES (?,?,?,?)",
            (str(uuid.uuid4())[:10], post_id, voter_id, 1 if body.agree else 0)
        )
        field = "prediction_agree" if body.agree else "prediction_disagree"
        conn.execute(f"UPDATE posts SET {field} = {field} + 1 WHERE id=?", (post_id,))
        conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(400, "투표 처리 중 오류")

    row = conn.execute(
        "SELECT prediction_agree, prediction_disagree FROM posts WHERE id=?", (post_id,)
    ).fetchone()
    conn.close()
    return {"agree": row["prediction_agree"], "disagree": row["prediction_disagree"], "voted": True}


@router.post("/{post_id}/vote")
def vote(post_id: str, body: VoteBody,
         x_api_key: Optional[str] = Header(None),
         authorization: Optional[str] = Header(None)):
    # Accept both agent API key and human Bearer token
    voter_id = None
    voter_type = None
    if x_api_key:
        agent = get_agent_by_key(x_api_key)
        if not agent:
            raise HTTPException(401, "Invalid API key")
        voter_id = agent["id"]
        voter_type = "agent"
    elif authorization and authorization.startswith("Bearer "):
        from backend.auth import get_user_by_token
        user = get_user_by_token(authorization.split(" ", 1)[1])
        if not user:
            raise HTTPException(401, "Invalid token")
        voter_id = user["id"]
        voter_type = "user"
    else:
        raise HTTPException(401, "Authentication required")

    if body.value not in (1, -1):
        raise HTTPException(400, "value must be 1 or -1")

    vote_id = str(uuid.uuid4())[:8]
    conn = get_conn()
    try:
        post_row = conn.execute("SELECT agent_id FROM posts WHERE id=?", (post_id,)).fetchone()
        if not post_row:
            raise HTTPException(404, "Post not found")
        conn.execute(
            "INSERT OR REPLACE INTO votes (id, post_id, voter_id, voter_type, value) VALUES (?,?,?,?,?)",
            (vote_id, post_id, voter_id, voter_type, body.value)
        )
        row = conn.execute("SELECT AVG(CAST(value AS FLOAT)) as avg FROM votes WHERE post_id=?", (post_id,)).fetchone()
        new_score = (row["avg"] + 1) / 2
        conn.execute("UPDATE posts SET score=?, vote_count=vote_count+1 WHERE id=?", (new_score, post_id))
        if post_row["agent_id"]:
            author_trust = recalc_trust_score(post_row["agent_id"], conn)
            conn.execute("UPDATE agents SET trust_score=? WHERE id=?", (author_trust, post_row["agent_id"]))
        conn.commit()

        # Update battle win tracking if this post belongs to a battle
        try:
            bp = conn.execute("SELECT battle_id FROM battle_posts WHERE post_id=?", (post_id,)).fetchone()
            if bp:
                bid = bp["battle_id"]
                # Get vote totals per agent in this battle
                standings = conn.execute("""
                    SELECT bp2.agent_id, COALESCE(p2.vote_count, 0) AS vc
                    FROM battle_posts bp2
                    LEFT JOIN posts p2 ON p2.id = bp2.post_id
                    WHERE bp2.battle_id = ?
                    ORDER BY vc DESC
                """, (bid,)).fetchall()
                if standings:
                    total_v = sum(s["vc"] for s in standings)
                    conn.execute("UPDATE battles SET total_votes=? WHERE id=?", (total_v, bid))
                    # Notify battle creator when hitting vote milestones
                    try:
                        battle_row = conn.execute(
                            "SELECT question, creator FROM battles WHERE id=?", (bid,)
                        ).fetchone()
                        if battle_row and total_v in (1, 5, 10):
                            creator_row = conn.execute(
                                "SELECT id FROM users WHERE username=?", (battle_row["creator"],)
                            ).fetchone()
                            if creator_row:
                                from backend.routes.notifications import push as notif_push
                                winner_name = standings[0]["agent_id"] if standings else ""
                                agent_name_row = conn.execute(
                                    "SELECT name FROM agents WHERE id=?", (standings[0]["agent_id"],)
                                ).fetchone() if standings else None
                                top_agent = agent_name_row["name"] if agent_name_row else "에이전트"
                                q_short = battle_row["question"][:40] + ("..." if len(battle_row["question"]) > 40 else "")
                                if total_v == 1:
                                    notif_push(str(creator_row["id"]), "user", "battle_vote",
                                        f"배틀에 첫 투표가 들어왔어요!", f'"{q_short}"', f"/arena/{bid}")
                                elif total_v == 5:
                                    notif_push(str(creator_row["id"]), "user", "battle_vote",
                                        f"배틀이 뜨거워지고 있어요 🔥", f'{top_agent}이(가) 앞서고 있어요 — "{q_short}"', f"/arena/{bid}")
                                elif total_v == 10:
                                    notif_push(str(creator_row["id"]), "user", "battle_result",
                                        f"배틀 결과: {top_agent} 1위!", f'"{q_short}"', f"/arena/{bid}")
                    except Exception:
                        pass
                    winner_id = standings[0]["agent_id"] if total_v > 0 else None
                    # Recalc battle_wins for winner only (simple increment won't double-count)
                    if winner_id:
                        wins_count = conn.execute("""
                            SELECT COUNT(DISTINCT b3.id) FROM battles b3
                            JOIN battle_posts bp3 ON bp3.battle_id = b3.id
                            WHERE bp3.agent_id = ?
                            AND bp3.post_id = (
                                SELECT bp4.post_id FROM battle_posts bp4
                                LEFT JOIN posts p4 ON p4.id = bp4.post_id
                                WHERE bp4.battle_id = b3.id
                                ORDER BY p4.vote_count DESC LIMIT 1
                            )
                        """, (winner_id,)).fetchone()
                        if wins_count:
                            conn.execute("UPDATE agents SET battle_wins=? WHERE id=?", (wins_count[0], winner_id))

                    # Resolve predictions once battle has ≥5 votes
                    if total_v >= 5 and winner_id:
                        try:
                            pending_preds = conn.execute("""
                                SELECT id, user_id, predicted_agent
                                FROM battle_predictions
                                WHERE battle_id=? AND resolved=0
                            """, (bid,)).fetchall()
                            for pred in pending_preds:
                                correct = 1 if pred["predicted_agent"] == winner_id else 0
                                pts = 10 if correct else 0
                                conn.execute("""
                                    UPDATE battle_predictions
                                    SET resolved=1, correct=?, points_earned=?
                                    WHERE id=?
                                """, (correct, pts, pred["id"]))
                                if correct:
                                    conn.execute(
                                        "UPDATE users SET points=COALESCE(points,0)+10 WHERE id=?",
                                        (pred["user_id"],)
                                    )
                                    from backend.routes.notifications import push as notif_push
                                    winner_name_row = conn.execute(
                                        "SELECT name FROM agents WHERE id=?", (winner_id,)
                                    ).fetchone()
                                    wname = winner_name_row["name"] if winner_name_row else "your pick"
                                    notif_push(
                                        pred["user_id"], "user", "prediction_correct",
                                        f"Correct prediction! +10pts",
                                        f"{wname} is leading the battle — you called it.",
                                        f"/arena/{bid}"
                                    )
                        except Exception:
                            pass

                    # Auto-issue ERC-735 INSIGHT_QUALITY claim to battle winner
                    if winner_id:
                        try:
                            winner_addr = conn.execute(
                                "SELECT address FROM agents WHERE id=?", (winner_id,)
                            ).fetchone()
                            if winner_addr:
                                from backend.identity import auto_issue_claim
                                auto_issue_claim(
                                    winner_addr["address"], "INSIGHT_QUALITY",
                                    {"battle_id": bid, "votes": total_v, "value": min(1.0, total_v * 0.05)},
                                    dedup_key=bid
                                )
                        except Exception:
                            pass

                    conn.commit()
        except Exception:
            pass
    finally:
        conn.close()
    return {"new_score": round(new_score, 3)}

@router.post("/outcomes")
def report_outcome(body: OutcomeBody, x_api_key: str = Header(...)):
    agent = get_agent_by_key(x_api_key)
    if not agent: raise HTTPException(401, "Invalid API key")
    if body.result not in ("success","failure","partial"):
        raise HTTPException(400, "result must be success/failure/partial")

    conn = get_conn()
    delta = {"success": 0.05, "partial": 0.01, "failure": -0.03}[body.result]
    conn.execute("INSERT INTO outcomes (id, agent_id, post_ids, result) VALUES (?,?,?,?)",
                 (str(uuid.uuid4())[:8], agent["id"], json.dumps(body.post_ids), body.result))
    author_ids = set()
    for pid in body.post_ids:
        conn.execute("UPDATE posts SET score = MIN(1.0, MAX(0.0, score + ?)) WHERE id=?", (delta, pid))
        row = conn.execute("SELECT agent_id FROM posts WHERE id=?", (pid,)).fetchone()
        if row:
            author_ids.add(row["agent_id"])
    if body.result == "success":
        conn.execute("UPDATE agents SET success_count=success_count+1 WHERE id=?", (agent["id"],))
    # recalc trust for reporter + all post authors
    for aid in author_ids | {agent["id"]}:
        t = recalc_trust_score(aid, conn)
        conn.execute("UPDATE agents SET trust_score=? WHERE id=?", (t, aid))
    conn.commit(); conn.close()
    return {"result": body.result, "score_delta": delta}

@router.post("/{post_id}/engage")
def engage_post(post_id: str, x_api_key: str = Header(...)):
    """SDK calls this — server generates a contextual comment for the calling agent."""
    agent = get_agent_by_key(x_api_key)
    if not agent:
        raise HTTPException(401, "Invalid API key")

    conn = get_conn()
    post = conn.execute("SELECT * FROM posts WHERE id=?", (post_id,)).fetchone()
    conn.close()
    if not post:
        raise HTTPException(404, "Post not found")
    if dict(post)["agent_id"] == agent["id"]:
        return {"comment": None}  # Don't comment on own post

    from backend.engage_engine import _generate_comment, _can_engage, _post_comment
    if not _can_engage(agent["id"]):
        return {"comment": None, "reason": "rate_limited"}

    post = dict(post)
    comment = _generate_comment(
        agent["name"], agent["domain"],
        post["abstract"], post["raw_insight"], post["domain"]
    )
    if comment:
        _post_comment(post_id, agent["id"], comment)
    return {"comment": comment}


@router.get("/trending")
def trending_topics():
    """Hot topics from last 24 hours — keyword clusters by domain."""
    conn = get_conn()
    rows = conn.execute("""
        SELECT p.id, p.domain, p.abstract, p.score, p.vote_count, p.use_count,
               COUNT(c.id) as comment_count,
               (p.vote_count * 2 + p.use_count + COUNT(c.id) * 3) as heat
        FROM posts p
        LEFT JOIN comments c ON c.post_id = p.id
        WHERE p.created_at > datetime('now', '-24 hours')
        GROUP BY p.id
        ORDER BY heat DESC
        LIMIT 20
    """).fetchall()
    conn.close()

    # Group by domain, take top per domain
    by_domain: dict = {}
    for r in rows:
        d = r["domain"]
        if d not in by_domain:
            by_domain[d] = []
        if len(by_domain[d]) < 3:
            by_domain[d].append({
                "id": r["id"], "domain": d,
                "abstract": r["abstract"][:80],
                "heat": r["heat"],
            })

    # Also return overall top 5
    top5 = [{"id": r["id"], "domain": r["domain"],
              "abstract": r["abstract"][:80], "heat": r["heat"]}
            for r in rows[:5]]
    return {"top": top5, "by_domain": by_domain}


@router.get("/for-you")
def for_you_feed(limit: int = 20, offset: int = 0,
                 authorization: Optional[str] = Header(None)):
    """Personalized feed based on follows + reaction history."""
    from backend.auth import get_user_by_token
    followed_ids: list[str] = []
    liked_domains: list[str] = []
    user_id = None

    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
        user = get_user_by_token(token)
        if user:
            user_id = user["id"]
            conn0 = get_conn()
            follows = conn0.execute(
                "SELECT following_id FROM follows WHERE follower_id=?", (user_id,)
            ).fetchall()
            followed_ids = [f["following_id"] for f in follows]
            liked = conn0.execute(
                """SELECT DISTINCT p.domain FROM reactions r
                   JOIN posts p ON r.post_id = p.id
                   WHERE r.user_id=? AND r.reaction IN ('insightful','useful')""",
                (user_id,)
            ).fetchall()
            liked_domains = [r["domain"] for r in liked]
            conn0.close()

    conn = get_conn()
    base = """
        SELECT posts.*, agents.name as agent_name, agents.model as agent_model,
               agents.trust_score as agent_trust
        FROM posts LEFT JOIN agents ON posts.agent_id = agents.id
    """
    seen = set()
    result = []

    # 1. Posts from followed agents (priority)
    if followed_ids:
        placeholders = ",".join("?" * len(followed_ids))
        rows = conn.execute(
            f"{base} WHERE posts.agent_id IN ({placeholders}) "
            f"ORDER BY posts.created_at DESC LIMIT 30",
            followed_ids
        ).fetchall()
        for r in rows:
            d = {k:v for k,v in dict(r).items() if k not in ("embedding_domain","embedding_abstract")}
            if d["id"] not in seen:
                d["_reason"] = "following"
                result.append(d); seen.add(d["id"])

    # 2. Posts from liked domains
    if liked_domains:
        placeholders = ",".join("?" * len(liked_domains))
        rows = conn.execute(
            f"{base} WHERE posts.domain IN ({placeholders}) "
            f"ORDER BY posts.score DESC, posts.created_at DESC LIMIT 20",
            liked_domains
        ).fetchall()
        for r in rows:
            d = {k:v for k,v in dict(r).items() if k not in ("embedding_domain","embedding_abstract")}
            if d["id"] not in seen:
                d["_reason"] = "liked_domain"
                result.append(d); seen.add(d["id"])

    # 3. Fill with global hot posts
    rows = conn.execute(
        f"{base} ORDER BY posts.score DESC, posts.use_count DESC LIMIT 40"
    ).fetchall()
    for r in rows:
        d = {k:v for k,v in dict(r).items() if k not in ("embedding_domain","embedding_abstract")}
        if d["id"] not in seen:
            d["_reason"] = "trending"
            result.append(d); seen.add(d["id"])

    conn.close()
    return result[offset:offset+limit]


@router.get("/{post_id}/translate")
def translate_post(post_id: str, lang: str = "en"):
    if lang == "en":
        conn = get_conn()
        row = conn.execute("SELECT raw_insight FROM posts WHERE id=?", (post_id,)).fetchone()
        conn.close()
        if not row:
            raise HTTPException(404, "Post not found")
        return {"translated": row["raw_insight"], "lang": "en", "cached": True}

    conn = get_conn()
    # Check cache
    cached = conn.execute(
        "SELECT translated_text FROM post_translations WHERE post_id=? AND lang=?",
        (post_id, lang)
    ).fetchone()
    if cached:
        conn.close()
        return {"translated": cached["translated_text"], "lang": lang, "cached": True}

    # Get original text
    row = conn.execute("SELECT raw_insight FROM posts WHERE id=?", (post_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Post not found")

    # Translate
    from backend.translation import from_english
    translated = from_english(row["raw_insight"], lang)

    # Cache result
    try:
        conn.execute(
            "INSERT OR IGNORE INTO post_translations (id, post_id, lang, translated_text) VALUES (?,?,?,?)",
            (str(uuid.uuid4())[:8], post_id, lang, translated)
        )
        conn.commit()
    except Exception:
        pass
    finally:
        conn.close()

    return {"translated": translated, "lang": lang, "cached": False}


@router.get("/{post_id}")
def get_post(post_id: str):
    conn = get_conn()
    row = conn.execute("""
        SELECT posts.*, agents.name as agent_name, agents.model as agent_model,
               agents.trust_score as agent_trust, agents.bio as agent_bio
        FROM posts LEFT JOIN agents ON posts.agent_id = agents.id
        WHERE posts.id=?
    """, (post_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404, "Post not found")
    return {k:v for k,v in dict(row).items() if k not in ("embedding_domain","embedding_abstract")}


@router.get("")
def list_posts(domain: Optional[str]=None, sort: str="hot",
               limit: int=20, offset: int=0, tag: Optional[str]=None,
               q: Optional[str]=None, following: Optional[str]=None,
               authorization: Optional[str]=Header(None)):
    conn = get_conn()

    # Resolve followed agent IDs if following=true
    following_ids: list[str] = []
    if following == "true" and authorization and authorization.startswith("Bearer "):
        from backend.auth import get_user_by_token
        token = authorization.split(" ", 1)[1]
        user = get_user_by_token(token)
        if user:
            rows = conn.execute(
                "SELECT following_id FROM follows WHERE follower_id=? AND following_type='agent'",
                (str(user["id"]),)
            ).fetchall()
            following_ids = [r["following_id"] for r in rows]
    order_map = {
        "hot": "posts.score DESC, posts.use_count DESC",
        "new": "posts.created_at DESC",
        "top": "posts.score DESC",
    }
    order = order_map.get(sort, "posts.score DESC")
    base = """
        SELECT posts.*, agents.name as agent_name, agents.model as agent_model,
               agents.trust_score as agent_trust, agents.last_active as agent_last_active,
               agents.mood as agent_mood,
               u.avatar_url as author_avatar_url,
               (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) as comment_count,
               (SELECT COUNT(*) FROM reactions WHERE reactions.post_id = posts.id) as reaction_count,
               (SELECT c.content FROM comments c WHERE c.post_id = posts.id
                AND c.author_type='agent' AND c.author_id != 'debug_agent'
                ORDER BY c.created_at DESC LIMIT 1) as latest_comment_content,
               (SELECT a2.name FROM comments c JOIN agents a2 ON c.author_id = a2.id
                WHERE c.post_id = posts.id AND c.author_type='agent' AND c.author_id != 'debug_agent'
                ORDER BY c.created_at DESC LIMIT 1) as latest_comment_agent
        FROM posts
        LEFT JOIN agents ON posts.agent_id = agents.id
        LEFT JOIN users u ON (posts.author_type='user' AND posts.author_name=u.username)
    """
    if following == "true":
        if not following_ids:
            conn.close()
            return []
        ph = ",".join("?" * len(following_ids))
        rows = conn.execute(
            f"{base} WHERE posts.agent_id IN ({ph}) ORDER BY {order} LIMIT ? OFFSET ?",
            (*following_ids, limit, offset)
        ).fetchall()
    elif q:
        term = f"%{q.lower()}%"
        rows = conn.execute(
            f"{base} WHERE (LOWER(posts.raw_insight) LIKE ? OR LOWER(posts.abstract) LIKE ?)"
            f" ORDER BY {order} LIMIT ? OFFSET ?",
            (term, term, limit, offset)
        ).fetchall()
    elif tag:
        rows = conn.execute(
            f"{base} JOIN post_tags pt ON posts.id = pt.post_id WHERE pt.tag=? ORDER BY {order} LIMIT ? OFFSET ?",
            (tag.lower(), limit, offset)
        ).fetchall()
    elif domain:
        rows = conn.execute(
            f"{base} WHERE posts.domain=? ORDER BY {order} LIMIT ? OFFSET ?",
            (domain, limit, offset)
        ).fetchall()
    else:
        rows = conn.execute(
            f"{base} ORDER BY {order} LIMIT ? OFFSET ?", (limit, offset)
        ).fetchall()
    posts = [{k:v for k,v in dict(r).items()
              if k not in ("embedding_domain","embedding_abstract")} for r in rows]

    # Inject recent reposts into "new" feed
    if sort == "new" and not domain and not tag and offset == 0:
        from datetime import datetime, timedelta
        cutoff = (datetime.utcnow() - timedelta(hours=24)).isoformat()
        reposts = conn.execute("""
            SELECT r.id as repost_id, r.comment as repost_comment,
                   r.created_at as repost_at,
                   ra.name as repost_by, ra.id as repost_agent_id,
                   ra.last_active as agent_last_active,
                   p.*, a.name as agent_name, a.model as agent_model, a.trust_score as agent_trust
            FROM reposts r
            JOIN agents ra ON r.agent_id = ra.id
            JOIN posts p ON r.original_post_id = p.id
            LEFT JOIN agents a ON p.agent_id = a.id
            WHERE r.created_at > ?
            ORDER BY r.created_at DESC LIMIT 10
        """, (cutoff,)).fetchall()
        for rp in reposts:
            d = {k:v for k,v in dict(rp).items()
                 if k not in ("embedding_domain","embedding_abstract")}
            d["created_at"] = d.pop("repost_at", d.get("created_at"))
            posts.insert(0, d)

    conn.close()
    return posts


@router.get("/activity/stream")
def activity_stream(limit: int = 30):
    """최근 에이전트 활동 스트림 — 포스트 + 댓글 통합"""
    from datetime import datetime, timedelta
    conn = get_conn()
    cutoff = (datetime.utcnow() - timedelta(hours=48)).isoformat()
    try:
        posts_rows = conn.execute("""
            SELECT 'post' as action_type, a.id as agent_id, a.name as agent_name,
                   a.domain, a.mood, p.abstract as content, p.post_type,
                   p.image_url, p.id as ref_id, p.created_at
            FROM posts p JOIN agents a ON p.agent_id = a.id
            WHERE p.created_at > ? AND a.id != 'newsbot01'
            ORDER BY p.created_at DESC LIMIT ?
        """, (cutoff, limit)).fetchall()

        comment_rows = conn.execute("""
            SELECT 'comment' as action_type, a.id as agent_id, a.name as agent_name,
                   a.domain, a.mood, c.content, 'text' as post_type,
                   '' as image_url, c.post_id as ref_id, c.created_at
            FROM comments c JOIN agents a ON c.author_id = a.id
            WHERE c.author_type='agent' AND c.author_id != 'debug_agent'
                  AND c.created_at > ?
            ORDER BY c.created_at DESC LIMIT ?
        """, (cutoff, limit)).fetchall()
    except Exception:
        conn.close()
        return []
    conn.close()

    combined = [dict(r) for r in posts_rows] + [dict(r) for r in comment_rows]
    combined.sort(key=lambda x: str(x.get("created_at") or ""), reverse=True)
    return combined[:limit]
