import uuid, secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
from backend.database import get_conn
from backend.routes.agents import get_agent_by_key

router = APIRouter(prefix="/gpu", tags=["gpu-market"])

GPU_MODELS = [
    "NVIDIA A100 80GB", "NVIDIA A100 40GB", "NVIDIA H100 80GB",
    "NVIDIA RTX 4090", "NVIDIA RTX 3090", "NVIDIA A40",
    "NVIDIA V100 32GB", "NVIDIA L40S", "AMD MI250X",
]


class GPUServiceCreate(BaseModel):
    provider_name:  str
    gpu_model:      str
    vram_gb:        int
    vcpu:           int = 8
    ram_gb:         int = 32
    storage_gb:     int = 100
    price_per_hour: float       # MATIC/hour
    min_hours:      int = 1
    max_hours:      int = 24
    region:         str = "global"
    description:    str = ""


class RentalConfirm(BaseModel):
    service_id:       str
    tx_hash:          str
    hours:            float
    amount_matic:     float
    renter_address:   str
    provider_address: str
    network:          str = "polygon-amoy"


# ── List GPU services ────────────────────────────────────────────────────────

@router.get("/services")
def list_gpu_services(available_only: bool = True, limit: int = 20):
    conn = get_conn()
    where = "WHERE g.available=1" if available_only else ""
    rows = conn.execute(f"""
        SELECT g.*, a.name as agent_name, a.address as agent_address,
               a.trust_score, a.model as agent_model,
               COUNT(r.id) as rental_count,
               COALESCE(SUM(r.amount_matic), 0) as total_earned
        FROM gpu_services g
        JOIN agents a ON g.agent_id = a.id
        LEFT JOIN gpu_rentals r ON g.id = r.service_id
        {where}
        GROUP BY g.id
        ORDER BY rental_count DESC, a.trust_score DESC
        LIMIT ?
    """, (limit,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.get("/services/{service_id}")
def get_gpu_service(service_id: str):
    conn = get_conn()
    row = conn.execute("""
        SELECT g.*, a.name as agent_name, a.address as agent_address,
               a.trust_score, a.bio as agent_bio,
               COUNT(r.id) as rental_count,
               COALESCE(SUM(r.amount_matic), 0) as total_earned
        FROM gpu_services g
        JOIN agents a ON g.agent_id = a.id
        LEFT JOIN gpu_rentals r ON g.id = r.service_id
        WHERE g.id=?
        GROUP BY g.id
    """, (service_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404, "GPU service not found")
    return dict(row)


# ── Register GPU service ─────────────────────────────────────────────────────

@router.post("/services")
def register_gpu(body: GPUServiceCreate, x_api_key: str = Header(...)):
    agent = get_agent_by_key(x_api_key)
    if not agent:
        raise HTTPException(401, "Invalid API key")
    if body.price_per_hour <= 0:
        raise HTTPException(400, "Price must be > 0")
    if body.vram_gb <= 0:
        raise HTTPException(400, "VRAM must be > 0")

    service_id = str(uuid.uuid4())[:12]
    conn = get_conn()
    try:
        conn.execute("""
            INSERT INTO gpu_services
              (id, agent_id, provider_name, gpu_model, vram_gb, vcpu, ram_gb,
               storage_gb, price_per_hour, min_hours, max_hours, region, description)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (service_id, agent["id"], body.provider_name, body.gpu_model,
              body.vram_gb, body.vcpu, body.ram_gb, body.storage_gb,
              body.price_per_hour, body.min_hours, body.max_hours,
              body.region, body.description))
        conn.commit()
    finally:
        conn.close()

    # Build on-chain registration tx if contract available
    from backend import web3_service as w3svc
    on_chain_tx = None
    if w3svc.has_contract() and w3svc._w3:
        try:
            from web3 import Web3
            sid = w3svc._service_id_bytes(service_id)
            price_wei = w3svc._w3.to_wei(body.price_per_hour, "ether")
            on_chain_tx = {
                "contract": w3svc.CONTRACT_ADDR,
                "method": "registerGPU",
                "args": [sid.hex(), body.gpu_model, body.vram_gb,
                         price_wei, body.min_hours, body.max_hours, body.region],
            }
        except Exception:
            pass

    # Auto-post announcement to Cogit feed
    _announce_gpu_service(agent, body, service_id)

    return {
        "service_id":    service_id,
        "agent_address": agent["address"],
        "on_chain_tx":   on_chain_tx,
        "message":       "GPU 서비스 등록 완료",
    }


def _announce_gpu_service(agent: dict, body: GPUServiceCreate, service_id: str):
    """Auto-post a listing announcement to the Cogit feed."""
    try:
        from backend.pipeline import process_post
        content = (
            f"🖥️ Now offering GPU compute: {body.gpu_model} ({body.vram_gb}GB VRAM) "
            f"at {body.price_per_hour} MATIC/hour via Cogit Marketplace. "
            f"Region: {body.region}. Minimum {body.min_hours}h rental. "
            f"Pay directly with MATIC — no account needed. "
            f"Service ID: {service_id}"
        )
        processed = process_post(content, "coding")
        post_id = str(uuid.uuid4())[:8]
        conn = get_conn()
        conn.execute("""
            INSERT INTO posts
              (id, agent_id, domain, raw_insight, abstract, pattern_type,
               embedding_domain, embedding_abstract, post_type, tags)
            VALUES (?,?,?,?,?,?,?,?,?,?)
        """, (
            post_id, agent["id"], "coding", content,
            processed["abstract"], processed["pattern_type"],
            processed["embedding_domain"], processed["embedding_abstract"],
            "text", '["gpu","cloud","compute","infrastructure"]',
        ))
        conn.execute("UPDATE agents SET post_count=post_count+1 WHERE id=?", (agent["id"],))
        conn.commit()
        conn.close()

        # Broadcast to WebSocket
        try:
            from backend.routes.posts import _broadcast_post
            import asyncio
            asyncio.create_task(_broadcast_post({
                "id": post_id, "agent_id": agent["id"],
                "agent_name": agent["name"], "domain": "coding",
                "raw_insight": content, "abstract": processed["abstract"],
                "pattern_type": "observation", "post_type": "text",
                "score": 0.5, "vote_count": 0, "use_count": 0,
                "created_at": "just now",
            }))
        except Exception:
            pass
    except Exception:
        pass  # announcement is optional


# ── Payment intent ───────────────────────────────────────────────────────────

@router.get("/services/{service_id}/rent-intent")
def rent_intent(service_id: str, hours: float, renter_address: str):
    conn = get_conn()
    svc = conn.execute(
        "SELECT g.*, a.address as provider_address FROM gpu_services g "
        "JOIN agents a ON g.agent_id=a.id WHERE g.id=?",
        (service_id,)
    ).fetchone()
    conn.close()
    if not svc:
        raise HTTPException(404, "GPU service not found")
    svc = dict(svc)

    if hours < svc["min_hours"]:
        raise HTTPException(400, f"Minimum {svc['min_hours']} hours")
    if hours > svc["max_hours"]:
        raise HTTPException(400, f"Maximum {svc['max_hours']} hours")

    total_matic = svc["price_per_hour"] * hours

    from backend import web3_service as w3svc
    tx = w3svc.build_pay_tx(
        service_id=service_id,
        price_matic=total_matic,
        from_address=renter_address,
        provider_address=svc["provider_address"],
    )

    return {
        "service_id":       service_id,
        "gpu_model":        svc["gpu_model"],
        "hours":            hours,
        "price_per_hour":   svc["price_per_hour"],
        "total_matic":      round(total_matic, 6),
        "provider_address": svc["provider_address"],
        "tx":               tx,
        "network":          "polygon-amoy",
    }


# ── Confirm rental after MetaMask tx ─────────────────────────────────────────

@router.post("/rentals/confirm")
def confirm_rental(body: RentalConfirm):
    conn = get_conn()
    svc = conn.execute(
        "SELECT * FROM gpu_services WHERE id=?", (body.service_id,)
    ).fetchone()
    if not svc:
        conn.close()
        raise HTTPException(404, "Service not found")

    rental_id  = str(uuid.uuid4())[:10]
    ends_at    = (datetime.utcnow() + timedelta(hours=body.hours)).isoformat()
    # Generate temporary access token
    access_token = secrets.token_urlsafe(24)

    try:
        conn.execute("""
            INSERT OR IGNORE INTO gpu_rentals
              (id, service_id, renter_address, provider_address, hours,
               amount_matic, tx_hash, status, access_token, ends_at, network)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
        """, (rental_id, body.service_id, body.renter_address,
              body.provider_address, body.hours, body.amount_matic,
              body.tx_hash, "active", access_token, ends_at, body.network))
        conn.execute("""
            UPDATE gpu_services
            SET total_hours_sold = total_hours_sold + ?,
                total_earned     = total_earned + ?
            WHERE id=?
        """, (body.hours, body.amount_matic, body.service_id))
        conn.commit()
    finally:
        conn.close()

    return {
        "rental_id":      rental_id,
        "status":         "active",
        "access_token":   access_token,
        "ends_at":        ends_at,
        "hours":          body.hours,
        "tx_hash":        body.tx_hash,
        "explorer_url":   f"https://amoy.polygonscan.com/tx/{body.tx_hash}",
        "message":        "GPU 렌탈 활성화됨",
    }


# ── Active rentals for a wallet ──────────────────────────────────────────────

@router.get("/rentals")
def my_rentals(renter_address: str, limit: int = 10):
    conn = get_conn()
    rows = conn.execute("""
        SELECT r.*, g.gpu_model, g.vram_gb, g.provider_name
        FROM gpu_rentals r
        JOIN gpu_services g ON r.service_id = g.id
        WHERE r.renter_address = ?
        ORDER BY r.started_at DESC LIMIT ?
    """, (renter_address, limit)).fetchall()
    conn.close()
    now = datetime.utcnow().isoformat()
    result = []
    for r in rows:
        d = dict(r)
        d["is_active"] = d["ends_at"] > now and d["status"] == "active"
        d.pop("access_token", None)  # don't expose token in list
        result.append(d)
    return result


# ── Stats ────────────────────────────────────────────────────────────────────

@router.get("/stats")
def gpu_stats():
    conn = get_conn()
    stats = conn.execute("""
        SELECT
          (SELECT COUNT(*) FROM gpu_services WHERE available=1)       as available_gpus,
          (SELECT COUNT(*) FROM gpu_services)                         as total_gpus,
          (SELECT COUNT(*) FROM gpu_rentals WHERE status='active')    as active_rentals,
          (SELECT COUNT(*) FROM gpu_rentals)                          as total_rentals,
          (SELECT COALESCE(SUM(amount_matic),0) FROM gpu_rentals)     as total_volume_matic,
          (SELECT COALESCE(SUM(hours),0) FROM gpu_rentals)            as total_hours_rented
    """).fetchone()
    conn.close()
    return dict(stats)
