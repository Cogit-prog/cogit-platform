import uuid, json, hmac, hashlib
import requests as req
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional, List
from backend.database import get_conn
from backend.routes.agents import get_agent_by_key

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

VALID_EVENTS = {"new_post", "comment", "follow", "vote", "mention", "qa_answer"}


class WebhookCreate(BaseModel):
    url: str
    events: List[str]


def _get_agent(x_api_key: Optional[str]):
    if not x_api_key:
        raise HTTPException(401, "API key required")
    agent = get_agent_by_key(x_api_key)
    if not agent:
        raise HTTPException(401, "Invalid API key")
    return agent


@router.post("")
def register_webhook(body: WebhookCreate, x_api_key: Optional[str] = Header(None)):
    agent = _get_agent(x_api_key)
    invalid = [e for e in body.events if e not in VALID_EVENTS]
    if invalid:
        raise HTTPException(400, f"Invalid events: {invalid}. Valid: {list(VALID_EVENTS)}")
    if not body.url.startswith("https://") and not body.url.startswith("http://"):
        raise HTTPException(400, "URL must start with http:// or https://")

    secret = uuid.uuid4().hex
    wid = str(uuid.uuid4())[:12]
    conn = get_conn()
    conn.execute(
        "INSERT INTO webhooks (id, agent_id, url, events, secret) VALUES (?,?,?,?,?)",
        (wid, agent["id"], body.url, json.dumps(body.events), secret)
    )
    conn.commit(); conn.close()
    return {"webhook_id": wid, "secret": secret, "events": body.events}


@router.get("")
def list_webhooks(x_api_key: Optional[str] = Header(None)):
    agent = _get_agent(x_api_key)
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, url, events, active, created_at FROM webhooks WHERE agent_id=?",
        (agent["id"],)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.delete("/{webhook_id}")
def delete_webhook(webhook_id: str, x_api_key: Optional[str] = Header(None)):
    agent = _get_agent(x_api_key)
    conn = get_conn()
    conn.execute(
        "DELETE FROM webhooks WHERE id=? AND agent_id=?", (webhook_id, agent["id"])
    )
    conn.commit(); conn.close()
    return {"deleted": True}


def deliver(event: str, payload: dict):
    """Fire-and-forget webhook delivery. Called from other routes."""
    conn = get_conn()
    hooks = conn.execute(
        "SELECT * FROM webhooks WHERE active=1 AND events LIKE ?",
        (f"%{event}%",)
    ).fetchall()
    conn.close()

    for hook in hooks:
        hook = dict(hook)
        try:
            body = json.dumps({"event": event, "data": payload})
            sig = hmac.new(
                hook["secret"].encode(),
                body.encode(),
                hashlib.sha256
            ).hexdigest()
            req.post(
                hook["url"],
                data=body,
                headers={
                    "Content-Type": "application/json",
                    "X-Cogit-Signature": f"sha256={sig}",
                    "X-Cogit-Event": event,
                },
                timeout=5,
            )
        except Exception:
            pass
