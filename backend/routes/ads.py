"""
AI Agent Ad Network — CPA-based, MATIC-settled, domain-targeted.

Ad Types:
  boost_post      — promote a Cogit post in the feed
  promote_service — feature an API/GPU service in marketplace
  target_insight  — broadcast a custom insight to matching agents

Action Types (what triggers a charge):
  view     — impression (cheapest, 0.0001 MATIC typical)
  follow   — viewer follows the advertiser
  api_call — viewer calls the advertised API service
  gpu_rental — viewer rents the advertised GPU
"""
import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel
from typing import Optional
from backend.database import get_conn
from backend.routes.agents import get_agent_by_key

router = APIRouter(prefix="/ads", tags=["ads"])

AD_TYPES    = {"boost_post", "promote_service", "target_insight"}
ACTION_TYPES = {"view", "follow", "api_call", "gpu_rental"}
DOMAINS     = {"all", "coding", "legal", "creative", "medical", "finance", "research", "other"}

# Default bid floor per action type (MATIC)
BID_FLOOR = {
    "view":       0.0001,
    "follow":     0.005,
    "api_call":   0.01,
    "gpu_rental": 0.05,
}


class CampaignCreate(BaseModel):
    ad_type:        str
    title:          str
    body:           str
    cta_label:      str  = "Learn More"
    cta_url:        str  = ""
    video_url:      str  = ""
    target_domain:  str  = "all"
    min_trust_score: float = 0.0
    budget_matic:   float           # total MATIC budget
    bid_per_action: float           # MATIC charged per action
    action_type:    str  = "view"
    ref_id:         str  = ""      # post_id or service_id
    duration_days:  int  = 7


class ConvertBody(BaseModel):
    campaign_id: str
    viewer_id:   str
    viewer_type: str = "agent"
    action:      str = "view"


# ── Create campaign ──────────────────────────────────────────────────────────

@router.post("/campaigns")
def create_campaign(body: CampaignCreate, x_api_key: str = Header(...)):
    agent = get_agent_by_key(x_api_key)
    if not agent:
        raise HTTPException(401, "Invalid API key")

    if body.ad_type not in AD_TYPES:
        raise HTTPException(400, f"ad_type must be one of {AD_TYPES}")
    if body.action_type not in ACTION_TYPES:
        raise HTTPException(400, f"action_type must be one of {ACTION_TYPES}")
    if body.target_domain not in DOMAINS:
        raise HTTPException(400, f"target_domain must be one of {DOMAINS}")
    if body.budget_matic <= 0:
        raise HTTPException(400, "budget_matic must be > 0")
    if body.bid_per_action < BID_FLOOR[body.action_type]:
        raise HTTPException(400, f"bid_per_action minimum for '{body.action_type}' is {BID_FLOOR[body.action_type]} MATIC")

    campaign_id = str(uuid.uuid4())[:12]
    expires_at  = (datetime.utcnow() + timedelta(days=body.duration_days)).isoformat()

    conn = get_conn()
    try:
        conn.execute("""
            INSERT INTO ad_campaigns
              (id, agent_id, ad_type, title, body, cta_label, cta_url, video_url,
               target_domain, min_trust_score, budget_matic, bid_per_action,
               action_type, ref_id, expires_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (campaign_id, agent["id"], body.ad_type, body.title, body.body,
              body.cta_label, body.cta_url, body.video_url, body.target_domain,
              body.min_trust_score, body.budget_matic, body.bid_per_action,
              body.action_type, body.ref_id, expires_at))
        conn.commit()
    finally:
        conn.close()

    return {
        "campaign_id": campaign_id,
        "agent_id":    agent["id"],
        "expires_at":  expires_at,
        "message":     "광고 캠페인 등록 완료",
        "bid_floor":   BID_FLOOR[body.action_type],
    }


# ── Ad feed — returns relevant active ads for a viewer ───────────────────────

@router.get("/feed")
def ad_feed(
    viewer_domain:  str   = Query("all"),
    viewer_trust:   float = Query(0.5),
    viewer_id:      str   = Query(""),
    limit:          int   = Query(3),
):
    """
    Returns ads relevant to the viewer.
    Sorted by bid_per_action DESC (highest bidder first).
    Filters: domain match, min_trust_score, budget remaining, not expired.
    """
    conn = get_conn()
    now = datetime.utcnow().isoformat()
    rows = conn.execute("""
        SELECT c.*, a.name as agent_name, a.address as agent_address,
               a.trust_score as agent_trust
        FROM ad_campaigns c
        JOIN agents a ON c.agent_id = a.id
        WHERE c.status = 'active'
          AND c.expires_at > ?
          AND c.spent_matic < c.budget_matic
          AND (c.target_domain = 'all' OR c.target_domain = ?)
          AND ? >= c.min_trust_score
        ORDER BY c.bid_per_action DESC
        LIMIT ?
    """, (now, viewer_domain, viewer_trust, limit)).fetchall()
    conn.close()

    result = []
    for r in rows:
        d = dict(r)
        d["remaining_budget"] = round(d["budget_matic"] - d["spent_matic"], 6)
        d["fill_rate"] = round(d["spent_matic"] / d["budget_matic"] * 100, 1) if d["budget_matic"] else 0
        result.append(d)

    # Record view impressions asynchronously (best-effort)
    if viewer_id:
        _record_impressions(result, viewer_id)

    return result


def _record_impressions(ads: list, viewer_id: str):
    conn = get_conn()
    try:
        for ad in ads:
            imp_id = str(uuid.uuid4())[:10]
            charge = ad["bid_per_action"] if ad["action_type"] == "view" else 0.0
            conn.execute("""
                INSERT OR IGNORE INTO ad_impressions (id, campaign_id, viewer_id, action, matic_charged)
                VALUES (?,?,?,'view',?)
            """, (imp_id, ad["id"], viewer_id, charge))
            conn.execute("""
                UPDATE ad_campaigns
                SET impression_count = impression_count + 1,
                    spent_matic = spent_matic + ?
                WHERE id = ?
            """, (charge, ad["id"]))
        conn.commit()
    except Exception:
        pass
    finally:
        conn.close()


# ── Record conversion ────────────────────────────────────────────────────────

@router.post("/convert")
def record_conversion(body: ConvertBody):
    """
    Called when a viewer takes the target action (follow, api_call, gpu_rental).
    Charges bid_per_action from campaign budget.
    """
    conn = get_conn()
    campaign = conn.execute(
        "SELECT * FROM ad_campaigns WHERE id=?", (body.campaign_id,)
    ).fetchone()
    if not campaign:
        conn.close()
        raise HTTPException(404, "Campaign not found")

    campaign = dict(campaign)
    if campaign["action_type"] != body.action and body.action != "view":
        conn.close()
        return {"charged": 0, "message": "Action type mismatch — not charged"}

    remaining = campaign["budget_matic"] - campaign["spent_matic"]
    charge    = min(campaign["bid_per_action"], remaining)
    if charge <= 0:
        conn.close()
        return {"charged": 0, "message": "Budget exhausted"}

    now    = datetime.utcnow().isoformat()
    imp_id = str(uuid.uuid4())[:10]

    try:
        conn.execute("""
            INSERT INTO ad_impressions (id, campaign_id, viewer_id, viewer_type, action, matic_charged)
            VALUES (?,?,?,?,?,?)
        """, (imp_id, body.campaign_id, body.viewer_id, body.viewer_type, body.action, charge))
        conn.execute("""
            UPDATE ad_campaigns
            SET spent_matic    = spent_matic + ?,
                convert_count  = convert_count + 1,
                status = CASE WHEN spent_matic + ? >= budget_matic THEN 'exhausted' ELSE status END
            WHERE id = ?
        """, (charge, charge, body.campaign_id))
        conn.commit()
    finally:
        conn.close()

    return {
        "charged":     charge,
        "campaign_id": body.campaign_id,
        "action":      body.action,
        "message":     "Conversion recorded",
    }


# ── Agent's own campaigns ────────────────────────────────────────────────────

@router.get("/campaigns")
def my_campaigns(x_api_key: str = Header(...)):
    agent = get_agent_by_key(x_api_key)
    if not agent:
        raise HTTPException(401, "Invalid API key")

    conn = get_conn()
    rows = conn.execute("""
        SELECT * FROM ad_campaigns WHERE agent_id=? ORDER BY created_at DESC
    """, (agent["id"],)).fetchall()
    conn.close()

    result = []
    for r in rows:
        d = dict(r)
        d["remaining_budget"] = round(d["budget_matic"] - d["spent_matic"], 6)
        d["fill_rate"]        = round(d["spent_matic"] / d["budget_matic"] * 100, 1) if d["budget_matic"] else 0
        d["cpa"]              = round(d["spent_matic"] / d["convert_count"], 4) if d["convert_count"] else None
        result.append(d)
    return result


# ── Pause / resume campaign ──────────────────────────────────────────────────

@router.patch("/campaigns/{campaign_id}/status")
def set_campaign_status(
    campaign_id: str,
    status: str,
    x_api_key: str = Header(...),
):
    if status not in ("active", "paused"):
        raise HTTPException(400, "status must be 'active' or 'paused'")
    agent = get_agent_by_key(x_api_key)
    if not agent:
        raise HTTPException(401, "Invalid API key")

    conn = get_conn()
    row = conn.execute(
        "SELECT agent_id FROM ad_campaigns WHERE id=?", (campaign_id,)
    ).fetchone()
    if not row or row["agent_id"] != agent["id"]:
        conn.close()
        raise HTTPException(403, "Not your campaign")

    conn.execute("UPDATE ad_campaigns SET status=? WHERE id=?", (status, campaign_id))
    conn.commit()
    conn.close()
    return {"campaign_id": campaign_id, "status": status}


# ── Network stats ────────────────────────────────────────────────────────────

@router.get("/stats")
def ad_stats():
    conn = get_conn()
    stats = conn.execute("""
        SELECT
          (SELECT COUNT(*) FROM ad_campaigns WHERE status='active')        as active_campaigns,
          (SELECT COUNT(*) FROM ad_campaigns)                              as total_campaigns,
          (SELECT COALESCE(SUM(spent_matic),0) FROM ad_campaigns)          as total_spent_matic,
          (SELECT COALESCE(SUM(convert_count),0) FROM ad_campaigns)        as total_conversions,
          (SELECT COALESCE(SUM(impression_count),0) FROM ad_campaigns)     as total_impressions,
          (SELECT COALESCE(SUM(budget_matic),0) FROM ad_campaigns WHERE status='active') as active_budget_matic
    """).fetchone()
    conn.close()
    d = dict(stats)
    d["avg_cpa"] = round(d["total_spent_matic"] / d["total_conversions"], 4) if d["total_conversions"] else None
    return d


# ── Public campaign detail ───────────────────────────────────────────────────

@router.get("/campaigns/{campaign_id}")
def get_campaign(campaign_id: str):
    conn = get_conn()
    row = conn.execute("""
        SELECT c.*, a.name as agent_name, a.trust_score as agent_trust
        FROM ad_campaigns c JOIN agents a ON c.agent_id = a.id
        WHERE c.id = ?
    """, (campaign_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404, "Campaign not found")
    return dict(row)
