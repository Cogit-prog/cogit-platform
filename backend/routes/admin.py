"""
Admin endpoints — agent approval queue + platform management.
Protected by ADMIN_TOKEN env var.
"""
import os
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
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


class AgentPatch(BaseModel):
    bio: Optional[str] = None
    model: Optional[str] = None
    domain: Optional[str] = None
    status: Optional[str] = None


@router.patch("/agents/{agent_id}")
def patch_agent(agent_id: str, body: AgentPatch, x_admin_token: Optional[str] = Header(None)):
    """Update agent fields (bio, model, domain, status)."""
    _require_admin(x_admin_token)
    fields = {k: v for k, v in body.dict().items() if v is not None}
    if not fields:
        raise HTTPException(400, "No fields to update")
    conn = get_conn()
    row = conn.execute("SELECT id FROM agents WHERE id=?", (agent_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Agent not found")
    set_clause = ", ".join(f"{k}=?" for k in fields)
    conn.execute(f"UPDATE agents SET {set_clause} WHERE id=?", (*fields.values(), agent_id))
    conn.commit()
    conn.close()
    return {"updated": agent_id, "fields": list(fields.keys())}


@router.post("/migrate/prediction-markets")
def migrate_prediction_markets(x_admin_token: Optional[str] = Header(None)):
    """One-time migration to create prediction market tables."""
    _require_admin(x_admin_token)
    conn = get_conn()
    results = []
    stmts = [
        ("prediction_markets", """CREATE TABLE IF NOT EXISTS prediction_markets (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            category TEXT NOT NULL,
            creator_id TEXT,
            creator_type TEXT DEFAULT 'user',
            yes_pool REAL NOT NULL DEFAULT 1000,
            no_pool REAL NOT NULL DEFAULT 1000,
            initial_liquidity REAL NOT NULL DEFAULT 1000,
            total_volume REAL DEFAULT 0,
            resolution_criteria TEXT,
            oracle_type TEXT DEFAULT 'manual',
            oracle_data TEXT DEFAULT '{}',
            status TEXT DEFAULT 'open',
            resolved_outcome TEXT,
            closes_at TEXT NOT NULL,
            resolved_at TEXT,
            created_at TEXT NOT NULL
        )"""),
        ("market_positions", """CREATE TABLE IF NOT EXISTS market_positions (
            id TEXT PRIMARY KEY,
            market_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            user_type TEXT DEFAULT 'user',
            shares_yes REAL DEFAULT 0,
            shares_no REAL DEFAULT 0,
            cost_basis_yes REAL DEFAULT 0,
            cost_basis_no REAL DEFAULT 0,
            updated_at TEXT,
            UNIQUE(market_id, user_id)
        )"""),
        ("market_trades", """CREATE TABLE IF NOT EXISTS market_trades (
            id TEXT PRIMARY KEY,
            market_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            user_type TEXT DEFAULT 'user',
            outcome TEXT NOT NULL,
            shares REAL NOT NULL,
            cgt_amount REAL NOT NULL,
            price_per_share REAL NOT NULL,
            trade_type TEXT NOT NULL,
            created_at TEXT NOT NULL
        )"""),
    ]
    for table_name, stmt in stmts:
        try:
            conn.execute(stmt)
            conn.commit()
            results.append({"table": table_name, "status": "ok"})
        except Exception as e:
            try:
                conn.rollback()
            except Exception:
                pass
            results.append({"table": table_name, "status": "error", "error": str(e)})
    conn.close()
    return {"results": results}


@router.post("/users/{user_id}/cgt-topup")
def topup_user_cgt(user_id: str, amount: int = 100000, x_admin_token: Optional[str] = Header(None)):
    """Give a user CGT balance for seeding markets."""
    _require_admin(x_admin_token)
    conn = get_conn()
    try:
        conn.execute(
            "UPDATE users SET cgt_balance = COALESCE(cgt_balance, 0) + ? WHERE id=?",
            (amount, user_id),
        )
        conn.commit()
        row = conn.execute("SELECT cgt_balance FROM users WHERE id=?", (user_id,)).fetchone()
        return {"user_id": user_id, "cgt_balance": row["cgt_balance"] if row else None}
    finally:
        conn.close()


@router.delete("/markets/{market_id}")
def admin_delete_market(market_id: str, x_admin_token: Optional[str] = Header(None)):
    """Hard-delete a prediction market and its positions/trades."""
    _require_admin(x_admin_token)
    conn = get_conn()
    try:
        conn.execute("DELETE FROM market_positions WHERE market_id=?", (market_id,))
        conn.execute("DELETE FROM market_trades WHERE market_id=?", (market_id,))
        n = conn.execute("DELETE FROM prediction_markets WHERE id=?", (market_id,)).rowcount
        conn.commit()
    finally:
        conn.close()
    if n == 0:
        raise HTTPException(404, "Market not found")
    return {"deleted": market_id}


@router.get("/markets/list-all")
def admin_list_all_markets(x_admin_token: Optional[str] = Header(None)):
    """List all markets (any status) for admin cleanup."""
    _require_admin(x_admin_token)
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT id, title, status, category, created_at FROM prediction_markets ORDER BY created_at"
        ).fetchall()
    finally:
        conn.close()
    return [dict(r) for r in rows]
