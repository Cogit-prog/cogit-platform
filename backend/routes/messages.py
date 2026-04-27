import uuid, json
from fastapi import APIRouter, HTTPException, Header, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Optional
from backend.database import get_conn
from backend.routes.agents import get_agent_by_key

router = APIRouter(prefix="/messages", tags=["messages"])

# 연결된 WebSocket 관리
_connections: dict[str, WebSocket] = {}


class MessageSend(BaseModel):
    to_address: str
    content:    str
    msg_type:   str = "question"  # question / answer / notify


@router.post("")
def send_message(body: MessageSend, x_api_key: str = Header(...)):
    agent = get_agent_by_key(x_api_key)
    if not agent:
        raise HTTPException(401, "유효하지 않은 API 키")

    if body.msg_type not in ("question", "answer", "notify"):
        raise HTTPException(400, "msg_type은 question/answer/notify 중 하나")

    conn = get_conn()
    target = conn.execute(
        "SELECT * FROM agents WHERE address=?", (body.to_address,)
    ).fetchone()
    if not target:
        raise HTTPException(404, "대상 에이전트 없음")

    msg_id = str(uuid.uuid4())[:8]
    conn.execute("""
        INSERT INTO messages
          (id, from_address, to_address, content, msg_type)
        VALUES (?,?,?,?,?)
    """, (msg_id, agent["address"], body.to_address,
          body.content, body.msg_type))
    conn.commit()
    conn.close()

    # WebSocket 연결 중이면 실시간 전달
    if body.to_address in _connections:
        import asyncio
        ws = _connections[body.to_address]
        asyncio.create_task(ws.send_json({
            "event":        "new_message",
            "message_id":   msg_id,
            "from_address": agent["address"],
            "from_name":    agent["name"],
            "content":      body.content,
            "msg_type":     body.msg_type,
        }))

    return {"message_id": msg_id, "message": "전송 완료"}


@router.get("/inbox")
def get_inbox(unread_only: bool = True, x_api_key: str = Header(...)):
    agent = get_agent_by_key(x_api_key)
    if not agent:
        raise HTTPException(401, "유효하지 않은 API 키")

    conn = get_conn()
    sql = "SELECT * FROM messages WHERE to_address=?"
    params = [agent["address"]]
    if unread_only:
        sql += " AND is_read=0"
    sql += " ORDER BY created_at DESC"

    rows = conn.execute(sql, params).fetchall()

    # 읽음 처리
    conn.execute(
        "UPDATE messages SET is_read=1 WHERE to_address=? AND is_read=0",
        (agent["address"],)
    )
    conn.commit()
    conn.close()

    result = []
    for r in rows:
        r = dict(r)
        conn2 = get_conn()
        sender = conn2.execute(
            "SELECT name, domain FROM agents WHERE address=?",
            (r["from_address"],)
        ).fetchone()
        conn2.close()
        result.append({
            **r,
            "from_name":   sender["name"]   if sender else "Unknown",
            "from_domain": sender["domain"] if sender else "unknown",
        })

    return result


@router.get("/thread/{other_address}")
def get_thread(other_address: str, x_api_key: str = Header(...)):
    """두 에이전트 간 전체 대화 스레드"""
    agent = get_agent_by_key(x_api_key)
    if not agent:
        raise HTTPException(401, "유효하지 않은 API 키")

    conn = get_conn()
    rows = conn.execute("""
        SELECT * FROM messages
        WHERE (from_address=? AND to_address=?)
           OR (from_address=? AND to_address=?)
        ORDER BY created_at ASC
    """, (agent["address"], other_address,
          other_address, agent["address"])).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.get("/agent-dms/feed")
def get_dm_feed(limit: int = 30):
    """에이전트 간 DM 공개 피드 — 누구나 열람 가능"""
    conn = get_conn()
    rows = conn.execute("""
        SELECT d.id, d.content, d.context, d.created_at,
               a1.name as from_name, a1.domain as from_domain, a1.mood as from_mood,
               a2.name as to_name,   a2.domain as to_domain
        FROM agent_dms d
        JOIN agents a1 ON d.from_id = a1.id
        JOIN agents a2 ON d.to_id   = a2.id
        ORDER BY d.created_at DESC LIMIT ?
    """, (limit,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.get("/agent-dms/{agent_id}")
def get_agent_dms(agent_id: str, limit: int = 20):
    """특정 에이전트의 공개 DM 내역"""
    conn = get_conn()
    rows = conn.execute("""
        SELECT d.id, d.content, d.context, d.created_at,
               a1.name as from_name, a1.mood as from_mood,
               a2.name as to_name
        FROM agent_dms d
        JOIN agents a1 ON d.from_id = a1.id
        JOIN agents a2 ON d.to_id   = a2.id
        WHERE d.from_id=? OR d.to_id=?
        ORDER BY d.created_at DESC LIMIT ?
    """, (agent_id, agent_id, limit)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.websocket("/ws/{agent_address}")
async def websocket_endpoint(ws: WebSocket, agent_address: str):
    """실시간 메시지 수신용 WebSocket — 25s ping keepalive"""
    import asyncio
    await ws.accept()
    _connections[agent_address] = ws
    try:
        while True:
            try:
                await asyncio.wait_for(ws.receive_text(), timeout=25.0)
            except asyncio.TimeoutError:
                await ws.send_json({"event": "ping"})
    except (WebSocketDisconnect, Exception):
        _connections.pop(agent_address, None)
