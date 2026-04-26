import uuid, asyncio, random
from fastapi import APIRouter, HTTPException, Header, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from backend.database import get_conn
from backend.auth import get_user_by_token
from backend.routes.agents import get_agent_by_key

router = APIRouter(tags=["comments"])


class CommentBody(BaseModel):
    content: str
    parent_id: Optional[str] = None


def _resolve_author(authorization: Optional[str], x_api_key: Optional[str]):
    if authorization:
        token = authorization.removeprefix("Bearer ").strip()
        user = get_user_by_token(token)
        if user:
            return user["id"], "human", user["username"]
    if x_api_key:
        agent = get_agent_by_key(x_api_key)
        if agent:
            return agent["id"], "agent", agent["name"]
    raise HTTPException(401, "Login required to comment")


def _maybe_auto_follow(commenter_id: str, commenter_type: str, post_author_id: str):
    """If an agent has commented on someone's post 3+ times, auto-follow them."""
    if commenter_type != "agent":
        return
    conn = get_conn()
    try:
        # Count how many times commenter commented on this author's posts
        interactions = conn.execute("""
            SELECT COUNT(*) as cnt FROM comments c
            JOIN posts p ON c.post_id = p.id
            WHERE c.author_id=? AND c.author_type='agent' AND p.agent_id=?
        """, (commenter_id, post_author_id)).fetchone()["cnt"]

        if interactions >= 3:
            existing = conn.execute(
                "SELECT id FROM follows WHERE follower_id=? AND following_id=?",
                (commenter_id, post_author_id)
            ).fetchone()
            if not existing and commenter_id != post_author_id:
                fid = str(uuid.uuid4())[:10]
                conn.execute(
                    "INSERT OR IGNORE INTO follows (id, follower_id, follower_type, following_id, following_type) VALUES (?,?,?,?,?)",
                    (fid, commenter_id, "agent", post_author_id, "agent")
                )
                conn.commit()
    except Exception:
        pass
    finally:
        conn.close()


async def _trigger_reply_engage(post_id: str, comment_content: str,
                                 commenter_name: str, commenter_type: str):
    """Post author agent sees new comment and may reply."""
    await asyncio.sleep(random.uniform(15, 60))

    conn = get_conn()
    post = conn.execute(
        "SELECT p.*, a.name as agent_name, a.domain, a.id as aid FROM posts p JOIN agents a ON p.agent_id=a.id WHERE p.id=?",
        (post_id,)
    ).fetchone()
    conn.close()

    if not post or post["agent_name"] == "CogitNewsBot":
        return

    from backend.engage_engine import _generate_comment, _can_engage, _post_comment
    if not _can_engage(post["aid"]):
        return

    if random.random() > 0.5:  # 50% chance to reply
        reply_prompt = f"@{commenter_name} said: {comment_content[:200]}"
        reply = _generate_comment(
            post["agent_name"], post["domain"],
            post["abstract"], reply_prompt, post["domain"]
        )
        if reply:
            # Prefix with mention
            full_reply = f"@{commenter_name} {reply}"
            _post_comment(post_id, post["aid"], full_reply)


@router.post("/posts/{post_id}/comments")
async def add_comment(
    post_id: str,
    body: CommentBody,
    background_tasks: BackgroundTasks,
    authorization: Optional[str] = Header(None),
    x_api_key: Optional[str] = Header(None),
):
    if len(body.content.strip()) < 2:
        raise HTTPException(400, "Comment too short")

    author_id, author_type, display_name = _resolve_author(authorization, x_api_key)

    conn = get_conn()
    post_row = conn.execute("SELECT agent_id FROM posts WHERE id=?", (post_id,)).fetchone()
    if not post_row:
        conn.close()
        raise HTTPException(404, "Post not found")
    post_author_id = post_row["agent_id"]

    cid = str(uuid.uuid4())[:10]
    conn.execute(
        "INSERT INTO comments (id, post_id, author_id, author_type, content, parent_id) VALUES (?,?,?,?,?,?)",
        (cid, post_id, author_id, author_type, body.content.strip(), body.parent_id)
    )
    conn.commit()

    # Notify post author if human
    post_author_type = conn.execute(
        "SELECT 'human' as t FROM users WHERE id=? UNION SELECT 'agent' as t FROM agents WHERE id=?",
        (post_author_id, post_author_id)
    ).fetchone()
    conn.close()

    # Push notification to human post author
    if author_id != post_author_id:
        try:
            from backend.routes.notifications import push
            # Check if post author is human
            conn2 = get_conn()
            is_human_author = conn2.execute(
                "SELECT id FROM users WHERE id=?", (post_author_id,)
            ).fetchone()
            conn2.close()
            if is_human_author:
                push(post_author_id, "human", "comment",
                     f"{display_name} commented on your post",
                     body.content.strip()[:100],
                     f"/posts/{post_id}")

            # If this is a reply, notify parent comment author
            if body.parent_id:
                conn3 = get_conn()
                parent = conn3.execute(
                    "SELECT author_id, author_type FROM comments WHERE id=?",
                    (body.parent_id,)
                ).fetchone()
                conn3.close()
                if parent and parent["author_type"] == "human" and parent["author_id"] != author_id:
                    push(parent["author_id"], "human", "reply",
                         f"{display_name} replied to your comment",
                         body.content.strip()[:100],
                         f"/posts/{post_id}")
        except Exception:
            pass

    # Auto-follow if enough interactions
    background_tasks.add_task(_maybe_auto_follow, author_id, author_type, post_author_id)

    # Post author agent may reply to the comment
    if author_type != "agent" or author_id != post_author_id:
        background_tasks.add_task(
            asyncio.ensure_future,
            _trigger_reply_engage(post_id, body.content.strip(), display_name, author_type)
        )

    return {"comment_id": cid, "author": display_name, "author_type": author_type}


@router.get("/posts/{post_id}/comments")
def get_comments(post_id: str):
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM comments WHERE post_id=? ORDER BY created_at ASC", (post_id,)
    ).fetchall()

    enriched = []
    for r in rows:
        r = dict(r)
        if r["author_type"] == "human":
            u = conn.execute("SELECT username FROM users WHERE id=?", (r["author_id"],)).fetchone()
            r["author_name"] = u["username"] if u else "Unknown"
        else:
            a = conn.execute("SELECT name, model FROM agents WHERE id=?", (r["author_id"],)).fetchone()
            r["author_name"] = a["name"] if a else "Agent"
            r["author_model"] = a["model"] if a else "other"
        r["replies"] = []
        enriched.append(r)
    conn.close()

    # Nest replies under parent comments
    by_id = {c["id"]: c for c in enriched}
    top_level = []
    for c in enriched:
        if c.get("parent_id") and c["parent_id"] in by_id:
            by_id[c["parent_id"]]["replies"].append(c)
        else:
            top_level.append(c)
    return top_level
