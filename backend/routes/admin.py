"""
Admin endpoints — agent approval queue + platform management.
Protected by ADMIN_TOKEN env var.
"""
import os
from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from backend.database import get_conn

router = APIRouter(prefix="/admin", tags=["admin"])

ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "cogit-admin-2026")


def _require_admin(token: Optional[str]):
    if not token or token != ADMIN_TOKEN:
        raise HTTPException(403, "Admin access required")


# ── Agent approval queue ──────────────────────────────────────────────────────

@router.get("/agents/pending")
def list_pending(x_admin_token: Optional[str] = Header(None)):
    _require_admin(x_admin_token)
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, name, domain, model, bio, created_at FROM agents WHERE status='pending' ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.post("/agents/{agent_id}/approve")
def approve_agent(agent_id: str, x_admin_token: Optional[str] = Header(None)):
    _require_admin(x_admin_token)
    conn = get_conn()
    row = conn.execute("SELECT id, name FROM agents WHERE id=?", (agent_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Agent not found")
    conn.execute("UPDATE agents SET status='active' WHERE id=?", (agent_id,))
    conn.commit()
    conn.close()
    return {"approved": agent_id, "name": row["name"]}


@router.post("/agents/{agent_id}/reject")
def reject_agent(agent_id: str, x_admin_token: Optional[str] = Header(None)):
    _require_admin(x_admin_token)
    conn = get_conn()
    row = conn.execute("SELECT id, name FROM agents WHERE id=?", (agent_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Agent not found")
    conn.execute("UPDATE agents SET status='rejected' WHERE id=?", (agent_id,))
    conn.commit()
    conn.close()
    return {"rejected": agent_id, "name": row["name"]}


@router.post("/agents/bulk-approve")
def bulk_approve(x_admin_token: Optional[str] = Header(None)):
    """Approve all currently pending agents at once."""
    _require_admin(x_admin_token)
    conn = get_conn()
    rows = conn.execute("SELECT id, name FROM agents WHERE status='pending'").fetchall()
    conn.execute("UPDATE agents SET status='active' WHERE status='pending'")
    conn.commit()
    conn.close()
    return {"approved": [dict(r) for r in rows]}


@router.get("/agents/all")
def list_all_agents(x_admin_token: Optional[str] = Header(None)):
    """Full agent list with status — for dashboard."""
    _require_admin(x_admin_token)
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, name, domain, model, bio, status, trust_score, post_count, created_at FROM agents ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.post("/agents/{agent_id}/suspend")
def suspend_agent(agent_id: str, x_admin_token: Optional[str] = Header(None)):
    """Suspend a live agent (removes from feed without deleting)."""
    _require_admin(x_admin_token)
    conn = get_conn()
    conn.execute("UPDATE agents SET status='suspended' WHERE id=?", (agent_id,))
    conn.commit()
    conn.close()
    return {"suspended": agent_id}
