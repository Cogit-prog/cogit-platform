import uuid
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
from backend.database import get_conn
from backend.routes.agents import get_agent_by_key

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

DOMAINS = ["coding", "legal", "creative", "medical", "finance", "research", "other"]


class ServiceCreate(BaseModel):
    name:         str
    description:  str
    endpoint_url: str
    price_matic:  float          # MATIC per API call
    domain:       str = "other"
    category:     str = "general"


class PaymentConfirm(BaseModel):
    service_id:       str
    tx_hash:          str
    amount_matic:     float
    caller_address:   str
    provider_address: str
    network:          str = "polygon-amoy"


class RatingBody(BaseModel):
    provider_address: str
    score: int  # 0-100


# ── Register a new API service ───────────────────────────────────────────────

@router.post("/services")
def register_service(body: ServiceCreate, x_api_key: str = Header(...)):
    agent = get_agent_by_key(x_api_key)
    if not agent:
        raise HTTPException(401, "Invalid API key")
    if body.price_matic <= 0:
        raise HTTPException(400, "Price must be > 0")
    if body.domain not in DOMAINS:
        body.domain = "other"

    service_id = str(uuid.uuid4())[:12]
    conn = get_conn()
    try:
        conn.execute("""
            INSERT INTO api_services
              (id, agent_id, name, description, endpoint_url, price_matic, domain, category)
            VALUES (?,?,?,?,?,?,?,?)
        """, (service_id, agent["id"], body.name, body.description,
              body.endpoint_url, body.price_matic, body.domain, body.category))
        conn.commit()
    finally:
        conn.close()

    # Try to build on-chain registration tx for MetaMask
    from backend import web3_service as w3svc
    on_chain_tx = None
    if w3svc.has_contract():
        on_chain_tx = w3svc.build_register_tx(
            service_id=service_id,
            price_matic=body.price_matic,
            name=body.name,
            description=body.description,
            endpoint_url=body.endpoint_url,
            domain=body.domain,
            from_address=agent["address"],
        )

    return {
        "service_id":   service_id,
        "agent_address": agent["address"],
        "on_chain_tx":  on_chain_tx,  # None = off-chain only mode
        "message": "서비스 등록 완료",
    }


# ── List services ────────────────────────────────────────────────────────────

@router.get("/services")
def list_services(domain: str = "", limit: int = 20, offset: int = 0):
    conn = get_conn()
    params: list = []
    where = "WHERE s.active=1"
    if domain:
        where += " AND s.domain=?"
        params.append(domain)
    rows = conn.execute(f"""
        SELECT s.*, a.name as agent_name, a.address as agent_address,
               a.trust_score, a.model as agent_model,
               COUNT(p.id)              as call_count,
               COALESCE(SUM(p.amount_matic), 0) as total_earned_matic
        FROM api_services s
        JOIN agents a ON s.agent_id = a.id
        LEFT JOIN api_payments p ON s.id = p.service_id
        {where}
        GROUP BY s.id
        ORDER BY call_count DESC, a.trust_score DESC
        LIMIT ? OFFSET ?
    """, [*params, limit, offset]).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.get("/services/{service_id}")
def get_service(service_id: str):
    conn = get_conn()
    row = conn.execute("""
        SELECT s.*, a.name as agent_name, a.address as agent_address,
               a.trust_score, a.model as agent_model, a.bio as agent_bio,
               COUNT(p.id) as call_count,
               COALESCE(SUM(p.amount_matic), 0) as total_earned_matic
        FROM api_services s
        JOIN agents a ON s.agent_id = a.id
        LEFT JOIN api_payments p ON s.id = p.service_id
        WHERE s.id=?
        GROUP BY s.id
    """, (service_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404, "Service not found")
    d = dict(row)

    # Enrich with on-chain data if available
    from backend import web3_service as w3svc
    chain_stats = w3svc.get_on_chain_stats(service_id)
    if chain_stats:
        d.update(chain_stats)
    chain_rep = w3svc.get_reputation_on_chain(d["agent_address"])
    if chain_rep is not None:
        d["on_chain_reputation"] = chain_rep

    return d


# ── Payment intent (unsigned tx for MetaMask) ────────────────────────────────

@router.get("/services/{service_id}/pay-intent")
def pay_intent(service_id: str, caller_address: str):
    conn = get_conn()
    svc = conn.execute(
        "SELECT s.*, a.address as provider_address FROM api_services s JOIN agents a ON s.agent_id=a.id WHERE s.id=?",
        (service_id,)
    ).fetchone()
    conn.close()
    if not svc:
        raise HTTPException(404, "Service not found")
    svc = dict(svc)

    from backend import web3_service as w3svc
    tx = w3svc.build_pay_tx(
        service_id=service_id,
        price_matic=svc["price_matic"],
        from_address=caller_address,
        provider_address=svc["provider_address"],
    )

    return {
        "service_id":       service_id,
        "service_name":     svc["name"],
        "price_matic":      svc["price_matic"],
        "price_wei":        str(int(svc["price_matic"] * 10**18)),
        "provider_address": svc["provider_address"],
        "tx":               tx,
        "network":          "polygon-amoy",
        "network_info":     w3svc.get_network_info(),
    }


# ── Confirm payment after MetaMask broadcast ─────────────────────────────────

@router.post("/payments/confirm")
def confirm_payment(body: PaymentConfirm):
    # Optional: verify tx on-chain
    from backend import web3_service as w3svc
    verified = False
    if w3svc.is_connected():
        result = w3svc.verify_tx(body.tx_hash)
        verified = bool(result and result.get("confirmed"))
    else:
        verified = True  # trust client in off-chain mode

    payment_id = str(uuid.uuid4())[:10]
    conn = get_conn()
    try:
        conn.execute("""
            INSERT OR IGNORE INTO api_payments
              (id, service_id, caller_address, provider_address, tx_hash, amount_matic, network)
            VALUES (?,?,?,?,?,?,?)
        """, (payment_id, body.service_id, body.caller_address,
              body.provider_address, body.tx_hash, body.amount_matic, body.network))
        conn.execute(
            "UPDATE api_services SET call_count = COALESCE(call_count,0)+1 WHERE id=?",
            (body.service_id,)
        )
        conn.commit()
    finally:
        conn.close()

    return {"payment_id": payment_id, "verified": verified, "confirmed": True}


# ── Payment history ──────────────────────────────────────────────────────────

@router.get("/payments/{service_id}")
def payment_history(service_id: str, limit: int = 20):
    conn = get_conn()
    rows = conn.execute("""
        SELECT * FROM api_payments WHERE service_id=?
        ORDER BY created_at DESC LIMIT ?
    """, (service_id, limit)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── On-chain rating ──────────────────────────────────────────────────────────

@router.post("/rate")
def rate_provider(body: RatingBody, x_api_key: str = Header(None)):
    if not (0 <= body.score <= 100):
        raise HTTPException(400, "Score must be 0-100")

    # Build unsigned rating tx for MetaMask
    from backend import web3_service as w3svc
    tx = None
    if w3svc.has_contract() and w3svc._w3:
        try:
            from web3 import Web3
            # We can't easily build this without a from_address, so return contract info
            tx = {
                "contract": w3svc.CONTRACT_ADDR,
                "method":   "rate",
                "args":     [body.provider_address, body.score],
            }
        except Exception:
            pass

    return {
        "provider_address": body.provider_address,
        "score": body.score,
        "on_chain_tx": tx,
        "note": "Sign with MetaMask to record on-chain permanently",
    }


# ── Marketplace stats ────────────────────────────────────────────────────────

@router.get("/stats")
def marketplace_stats():
    conn = get_conn()
    stats = conn.execute("""
        SELECT
          (SELECT COUNT(*) FROM api_services WHERE active=1)       as total_services,
          (SELECT COUNT(*) FROM api_payments)                       as total_calls,
          (SELECT COALESCE(SUM(amount_matic),0) FROM api_payments)  as total_volume_matic,
          (SELECT COUNT(DISTINCT agent_id) FROM api_services WHERE active=1) as providers
    """).fetchone()
    conn.close()

    from backend import web3_service as w3svc
    return {
        **dict(stats),
        "network": w3svc.get_network_info(),
    }
