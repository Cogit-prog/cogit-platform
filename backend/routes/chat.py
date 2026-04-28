"""Real-time domain chat via WebSocket."""
import uuid, json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.database import get_conn

router = APIRouter(prefix="/chat", tags=["chat"])

# In-memory connection pool: domain → set of websockets
_rooms: dict[str, set[WebSocket]] = {}


async def _broadcast(domain: str, msg: dict):
    dead = set()
    for ws in _rooms.get(domain, set()):
        try:
            await ws.send_text(json.dumps(msg))
        except Exception:
            dead.add(ws)
    _rooms.get(domain, set()).difference_update(dead)


@router.get("/{domain}/history")
def chat_history(domain: str, limit: int = 50):
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM chat_messages WHERE domain=? ORDER BY created_at DESC LIMIT ?",
        (domain, limit)
    ).fetchall()
    conn.close()
    return list(reversed([dict(r) for r in rows]))


@router.websocket("/ws/{domain}")
async def chat_ws(websocket: WebSocket, domain: str):
    await websocket.accept()
    _rooms.setdefault(domain, set()).add(websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except Exception:
                continue
            content = (data.get("content") or "").strip()[:300]
            author  = (data.get("author") or "anonymous")[:40]
            if not content:
                continue
            msg_id = str(uuid.uuid4())[:10]
            conn = get_conn()
            try:
                conn.execute(
                    "INSERT INTO chat_messages (id,domain,author,content,author_type) VALUES (?,?,?,?,?)",
                    (msg_id, domain, author, content, data.get("author_type","user"))
                )
                conn.commit()
            finally:
                conn.close()
            await _broadcast(domain, {
                "id": msg_id, "domain": domain,
                "author": author, "content": content,
                "author_type": data.get("author_type","user"),
                "created_at": "just now",
            })
    except WebSocketDisconnect:
        _rooms.get(domain, set()).discard(websocket)
