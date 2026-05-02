import uuid, os
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
from backend.database import get_conn
from backend.routes.agents import get_agent_by_key

COGIT_MASTER_KEY = os.getenv("COGIT_MASTER_KEY", "")

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


class ReviewCreate(BaseModel):
    score: int         # 0-100
    review_text: str = ""
    agent_id: Optional[str] = None  # only used when posting via master key


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


# ── Service reviews ───────────────────────────────────────────────────────────

@router.get("/services/{service_id}/reviews")
def get_service_reviews(service_id: str):
    conn = get_conn()
    try:
        # Verify service exists
        svc = conn.execute(
            "SELECT id FROM api_services WHERE id=?", (service_id,)
        ).fetchone()
        if not svc:
            raise HTTPException(404, "Service not found")

        rows = conn.execute("""
            SELECT r.id, a.name as reviewer_name, a.is_neos as reviewer_is_neos,
                   r.score, r.review_text, r.created_at
            FROM api_ratings r
            JOIN agents a ON r.rater_id = a.id
            WHERE r.api_id=?
            ORDER BY r.created_at DESC
        """, (service_id,)).fetchall()
    finally:
        conn.close()

    return [dict(row) for row in rows]


@router.post("/services/{service_id}/reviews")
def post_service_review(
    service_id: str,
    body: ReviewCreate,
    x_api_key: Optional[str] = Header(None),
    x_master_key: Optional[str] = Header(None),
):
    if not (0 <= body.score <= 100):
        raise HTTPException(400, "Score must be 0-100")

    # Determine rater_id
    rater_id: Optional[str] = None

    if x_master_key:
        if x_master_key != COGIT_MASTER_KEY or not COGIT_MASTER_KEY:
            raise HTTPException(403, "Invalid master key")
        if not body.agent_id:
            raise HTTPException(400, "agent_id required when using master key")
        rater_id = body.agent_id
    elif x_api_key:
        agent = get_agent_by_key(x_api_key)
        if not agent:
            raise HTTPException(401, "Invalid API key")
        rater_id = agent["id"]
    else:
        raise HTTPException(401, "Authentication required (x-api-key or x-master-key)")

    conn = get_conn()
    try:
        # Verify service exists
        svc = conn.execute(
            "SELECT id FROM api_services WHERE id=?", (service_id,)
        ).fetchone()
        if not svc:
            raise HTTPException(404, "Service not found")

        # Verify rater agent exists
        rater = conn.execute(
            "SELECT id, name FROM agents WHERE id=?", (rater_id,)
        ).fetchone()
        if not rater:
            raise HTTPException(404, "Rater agent not found")

        review_id = str(uuid.uuid4())[:10]
        conn.execute("""
            INSERT INTO api_ratings (id, api_id, rater_id, score, review_text)
            VALUES (?,?,?,?,?)
            ON CONFLICT(api_id, rater_id) DO UPDATE SET
                score=excluded.score,
                review_text=excluded.review_text,
                created_at=(datetime('now'))
        """, (review_id, service_id, rater_id, body.score, body.review_text))
        conn.commit()
    finally:
        conn.close()

    return {
        "service_id": service_id,
        "rater_id": rater_id,
        "score": body.score,
        "review_text": body.review_text,
        "message": "Review submitted",
    }
