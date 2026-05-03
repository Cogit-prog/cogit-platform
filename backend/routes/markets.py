import os
import uuid
import json
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

from backend.database import get_conn

router = APIRouter(tags=["markets"])
logger = logging.getLogger(__name__)

COGIT_MASTER_KEY = os.getenv("COGIT_MASTER_KEY", "")

VALID_CATEGORIES = {
    "crypto", "politics", "economy", "tech",
    "sports", "science", "entertainment", "neos",
}


# ── CPMM Math ─────────────────────────────────────────────────────────────────

def get_price_yes(yes_pool: float, no_pool: float) -> float:
    """Current probability of YES (0-1)"""
    return no_pool / (yes_pool + no_pool)


def calc_buy_yes(cgt_amount: float, yes_pool: float, no_pool: float) -> tuple[float, float, float]:
    """
    Returns (shares_out, new_yes_pool, new_no_pool)
    User pays cgt_amount CGT, receives shares_out YES shares
    """
    k = yes_pool * no_pool
    new_no_pool = no_pool + cgt_amount
    new_yes_pool = k / new_no_pool
    shares_out = yes_pool - new_yes_pool
    return shares_out, new_yes_pool, new_no_pool


def calc_buy_no(cgt_amount: float, yes_pool: float, no_pool: float) -> tuple[float, float, float]:
    """Returns (shares_out, new_yes_pool, new_no_pool)"""
    k = yes_pool * no_pool
    new_yes_pool = yes_pool + cgt_amount
    new_no_pool = k / new_yes_pool
    shares_out = no_pool - new_no_pool
    return shares_out, new_yes_pool, new_no_pool


def calc_sell_yes(shares: float, yes_pool: float, no_pool: float) -> tuple[float, float, float]:
    """Returns (cgt_out, new_yes_pool, new_no_pool)"""
    k = yes_pool * no_pool
    new_yes_pool = yes_pool + shares
    new_no_pool = k / new_yes_pool
    cgt_out = no_pool - new_no_pool
    return cgt_out, new_yes_pool, new_no_pool


def calc_sell_no(shares: float, yes_pool: float, no_pool: float) -> tuple[float, float, float]:
    """Returns (cgt_out, new_yes_pool, new_no_pool)"""
    k = yes_pool * no_pool
    new_no_pool = no_pool + shares
    new_yes_pool = k / new_no_pool
    cgt_out = yes_pool - new_yes_pool
    return cgt_out, new_yes_pool, new_no_pool


# ── Auth helper ───────────────────────────────────────────────────────────────

def _get_user_from_header(
    x_authorization: Optional[str],
    x_api_key: Optional[str] = None,
    required: bool = True,
):
    """Accept Bearer token (human users) or x-api-key (agents/NEOS citizens)."""
    if x_api_key:
        from backend.routes.agents import get_agent_by_key
        agent = get_agent_by_key(x_api_key)
        if agent:
            return {
                "id": agent["id"],
                "cgt_balance": float(agent.get("cgt_balance") or 1000),
                "_type": "agent",
            }

    if x_authorization and x_authorization.startswith("Bearer "):
        token = x_authorization.split(" ", 1)[1]
        from backend.auth import get_user_by_token
        user = get_user_by_token(token)
        if user:
            return dict(user)

    if required:
        raise HTTPException(401, "Authentication required")
    return None


def _deduct_cgt(user: dict, amount: float, conn):
    """Deduct CGT from either users or agents table."""
    if user.get("_type") == "agent":
        conn.execute(
            "UPDATE agents SET cgt_balance = cgt_balance - ? WHERE id=?",
            (amount, str(user["id"])),
        )
    else:
        conn.execute(
            "UPDATE users SET cgt_balance = cgt_balance - ? WHERE id=?",
            (amount, str(user["id"])),
        )


def _add_cgt(user_id: str, amount: float, conn, user_type: str = "user"):
    """Add CGT to either users or agents table."""
    if user_type == "agent":
        conn.execute(
            "UPDATE agents SET cgt_balance = cgt_balance + ? WHERE id=?",
            (amount, str(user_id)),
        )
    else:
        conn.execute(
            "UPDATE users SET cgt_balance = cgt_balance + ? WHERE id=?",
            (amount, str(user_id)),
        )


# ── Pydantic models ───────────────────────────────────────────────────────────

class MarketCreate(BaseModel):
    title: str
    description: str
    category: str
    resolution_criteria: str
    closes_at: str
    initial_liquidity: float = 500.0
    oracle_type: str = "manual"
    oracle_data: dict = {}


class TradeRequest(BaseModel):
    outcome: str            # "yes" or "no"
    cgt_amount: float       # CGT to spend (for buy) or shares to sell (for sell)
    trade_type: str         # "buy" or "sell"
    min_shares: float = 0   # slippage protection


class ResolveRequest(BaseModel):
    outcome: str            # "yes" or "no"
    master_key: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/markets")
def create_market(
    body: MarketCreate,
    x_authorization: Optional[str] = Header(None),
    x_api_key: Optional[str] = Header(None),
):
    user = _get_user_from_header(x_authorization, x_api_key)

    # Validations
    if not body.title.strip():
        raise HTTPException(400, "title must not be empty")
    if body.initial_liquidity < 100:
        raise HTTPException(400, "initial_liquidity must be at least 100 CGT")
    if body.category not in VALID_CATEGORIES:
        raise HTTPException(400, f"category must be one of: {', '.join(sorted(VALID_CATEGORIES))}")

    try:
        closes_dt = datetime.fromisoformat(body.closes_at)
    except ValueError:
        raise HTTPException(400, "closes_at must be a valid ISO datetime string")

    if closes_dt <= datetime.utcnow():
        raise HTTPException(400, "closes_at must be in the future")

    market_id = str(uuid.uuid4())[:12]
    now = datetime.utcnow().isoformat()

    conn = get_conn()
    try:
        balance = float(user.get("cgt_balance") or 0)
        if balance < body.initial_liquidity:
            raise HTTPException(400, "Insufficient CGT balance")

        _deduct_cgt(user, body.initial_liquidity, conn)

        conn.execute(
            """INSERT INTO prediction_markets
               (id, title, description, category, creator_id, creator_type,
                yes_pool, no_pool, initial_liquidity, total_volume,
                resolution_criteria, oracle_type, oracle_data,
                status, closes_at, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'open', ?, ?)""",
            (
                market_id,
                body.title.strip(),
                body.description,
                body.category,
                str(user["id"]),
                user.get("_type", "user"),
                body.initial_liquidity,
                body.initial_liquidity,
                body.initial_liquidity,
                body.resolution_criteria,
                body.oracle_type,
                json.dumps(body.oracle_data),
                body.closes_at,
                now,
            ),
        )
        conn.commit()

        market = conn.execute(
            "SELECT * FROM prediction_markets WHERE id=?", (market_id,)
        ).fetchone()
    finally:
        conn.close()

    result = dict(market)
    result["probability_yes"] = round(get_price_yes(result["yes_pool"], result["no_pool"]), 4)
    return result


@router.get("/markets")
def list_markets(
    category: Optional[str] = None,
    status: str = "open",
    limit: int = 20,
    offset: int = 0,
):
    conn = get_conn()
    try:
        sql = """
            SELECT id, title, category, yes_pool, no_pool, total_volume, closes_at,
                   status, resolved_outcome
            FROM prediction_markets
            WHERE status=?
        """
        params: list = [status]

        if category:
            sql += " AND category=?"
            params.append(category)

        sql += " ORDER BY total_volume DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        rows = conn.execute(sql, params).fetchall()
    finally:
        conn.close()

    results = []
    for r in rows:
        item = {
            "id": r["id"],
            "title": r["title"],
            "category": r["category"],
            "probability_yes": round(get_price_yes(r["yes_pool"], r["no_pool"]), 4),
            "total_volume": round(r["total_volume"] or 0, 2),
            "closes_at": r["closes_at"],
            "status": r["status"],
            "resolved_outcome": r["resolved_outcome"],
        }
        results.append(item)
    return results


@router.get("/markets/portfolio/me")
def get_my_portfolio(
    x_authorization: Optional[str] = Header(None),
):
    user = _get_user_from_header(x_authorization)

    conn = get_conn()
    try:
        positions = conn.execute(
            """
            SELECT mp.id, mp.market_id, mp.shares_yes, mp.shares_no,
                   mp.cost_basis_yes, mp.cost_basis_no,
                   pm.title, pm.yes_pool, pm.no_pool, pm.status, pm.resolved_outcome
            FROM market_positions mp
            JOIN prediction_markets pm ON mp.market_id = pm.id
            WHERE mp.user_id=?
              AND (mp.shares_yes > 0 OR mp.shares_no > 0)
            """,
            (str(user["id"]),),
        ).fetchall()
    finally:
        conn.close()

    results = []
    for p in positions:
        prob_yes = get_price_yes(p["yes_pool"], p["no_pool"])
        prob_no = 1.0 - prob_yes

        current_value_yes = round(p["shares_yes"] * prob_yes, 2)
        current_value_no = round(p["shares_no"] * prob_no, 2)
        total_cost = (p["cost_basis_yes"] or 0) + (p["cost_basis_no"] or 0)
        total_value = current_value_yes + current_value_no
        profit_loss = round(total_value - total_cost, 2)

        results.append({
            "position_id": p["id"],
            "market_id": p["market_id"],
            "market_title": p["title"],
            "market_status": p["status"],
            "resolved_outcome": p["resolved_outcome"],
            "shares_yes": round(p["shares_yes"], 4),
            "shares_no": round(p["shares_no"], 4),
            "cost_basis_yes": round(p["cost_basis_yes"] or 0, 2),
            "cost_basis_no": round(p["cost_basis_no"] or 0, 2),
            "current_value_yes": current_value_yes,
            "current_value_no": current_value_no,
            "profit_loss": profit_loss,
            "probability_yes": round(prob_yes, 4),
        })
    return results


@router.get("/markets/{market_id}")
def get_market(
    market_id: str,
    x_authorization: Optional[str] = Header(None),
):
    conn = get_conn()
    try:
        market = conn.execute(
            "SELECT * FROM prediction_markets WHERE id=?", (market_id,)
        ).fetchone()
        if not market:
            raise HTTPException(404, "Market not found")

        trades = conn.execute(
            """SELECT id, user_id, outcome, shares, cgt_amount, price_per_share,
                      trade_type, created_at
               FROM market_trades
               WHERE market_id=?
               ORDER BY created_at DESC
               LIMIT 10""",
            (market_id,),
        ).fetchall()

        user_position = None
        user = _get_user_from_header(x_authorization, required=False)
        if user:
            pos = conn.execute(
                "SELECT * FROM market_positions WHERE market_id=? AND user_id=?",
                (market_id, str(user["id"])),
            ).fetchone()
            if pos:
                user_position = dict(pos)
    finally:
        conn.close()

    result = dict(market)
    result["probability_yes"] = round(
        get_price_yes(result["yes_pool"], result["no_pool"]), 4
    )
    result["yes_pool"] = round(result["yes_pool"], 2)
    result["no_pool"] = round(result["no_pool"], 2)
    result["total_volume"] = round(result["total_volume"] or 0, 2)
    result["recent_trades"] = [
        {
            "id": t["id"],
            "user_id": t["user_id"][:8],
            "outcome": t["outcome"],
            "shares": round(t["shares"], 4),
            "cgt_amount": round(t["cgt_amount"], 2),
            "price_per_share": round(t["price_per_share"], 4),
            "trade_type": t["trade_type"],
            "created_at": t["created_at"],
        }
        for t in trades
    ]
    result["user_position"] = user_position
    return result


@router.post("/markets/{market_id}/trade")
def trade_market(
    market_id: str,
    body: TradeRequest,
    x_authorization: Optional[str] = Header(None),
    x_api_key: Optional[str] = Header(None),
):
    user = _get_user_from_header(x_authorization, x_api_key)

    if body.outcome not in ("yes", "no"):
        raise HTTPException(400, "outcome must be 'yes' or 'no'")
    if body.trade_type not in ("buy", "sell"):
        raise HTTPException(400, "trade_type must be 'buy' or 'sell'")
    if body.cgt_amount <= 0:
        raise HTTPException(400, "cgt_amount must be positive")
    if body.trade_type == "buy" and body.cgt_amount < 10:
        raise HTTPException(400, "Minimum trade is 10 CGT")

    trade_id = str(uuid.uuid4())[:12]
    pos_id = str(uuid.uuid4())[:12]
    now = datetime.utcnow().isoformat()

    conn = get_conn()
    try:
        market = conn.execute(
            "SELECT * FROM prediction_markets WHERE id=?", (market_id,)
        ).fetchone()
        if not market:
            raise HTTPException(404, "Market not found")
        if market["status"] != "open":
            raise HTTPException(400, "Market is not open")

        try:
            closes_dt = datetime.fromisoformat(market["closes_at"])
        except ValueError:
            closes_dt = datetime.max
        if closes_dt <= datetime.utcnow():
            raise HTTPException(400, "Market has closed")

        yes_pool = float(market["yes_pool"])
        no_pool = float(market["no_pool"])

        balance = float(user.get("cgt_balance") or 0)

        if body.trade_type == "buy":
            if balance < body.cgt_amount:
                raise HTTPException(400, "Insufficient CGT balance")

            if body.outcome == "yes":
                shares_out, new_yes_pool, new_no_pool = calc_buy_yes(body.cgt_amount, yes_pool, no_pool)
            else:
                shares_out, new_yes_pool, new_no_pool = calc_buy_no(body.cgt_amount, yes_pool, no_pool)

            if shares_out < body.min_shares:
                raise HTTPException(400, "Slippage too high")

            price_per_share = round(body.cgt_amount / shares_out, 6) if shares_out > 0 else 0.0

            # Deduct CGT from user or agent
            _deduct_cgt(user, body.cgt_amount, conn)

            # Update pools
            conn.execute(
                "UPDATE prediction_markets SET yes_pool=?, no_pool=?, total_volume=total_volume+? WHERE id=?",
                (new_yes_pool, new_no_pool, body.cgt_amount, market_id),
            )

            # Upsert position
            existing_pos = conn.execute(
                "SELECT id FROM market_positions WHERE market_id=? AND user_id=?",
                (market_id, str(user["id"])),
            ).fetchone()

            if existing_pos:
                if body.outcome == "yes":
                    conn.execute(
                        """UPDATE market_positions
                           SET shares_yes=shares_yes+?, cost_basis_yes=cost_basis_yes+?, updated_at=?
                           WHERE market_id=? AND user_id=?""",
                        (shares_out, body.cgt_amount, now, market_id, str(user["id"])),
                    )
                else:
                    conn.execute(
                        """UPDATE market_positions
                           SET shares_no=shares_no+?, cost_basis_no=cost_basis_no+?, updated_at=?
                           WHERE market_id=? AND user_id=?""",
                        (shares_out, body.cgt_amount, now, market_id, str(user["id"])),
                    )
            else:
                shares_yes = shares_out if body.outcome == "yes" else 0.0
                shares_no = shares_out if body.outcome == "no" else 0.0
                cost_yes = body.cgt_amount if body.outcome == "yes" else 0.0
                cost_no = body.cgt_amount if body.outcome == "no" else 0.0
                conn.execute(
                    """INSERT INTO market_positions
                       (id, market_id, user_id, user_type, shares_yes, shares_no,
                        cost_basis_yes, cost_basis_no, updated_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (pos_id, market_id, str(user["id"]), user.get("_type", "user"),
                     shares_yes, shares_no, cost_yes, cost_no, now),
                )

            # Insert trade record
            conn.execute(
                """INSERT INTO market_trades
                   (id, market_id, user_id, user_type, outcome, shares, cgt_amount,
                    price_per_share, trade_type, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'buy', ?)""",
                (trade_id, market_id, str(user["id"]), user.get("_type", "user"),
                 body.outcome, shares_out, body.cgt_amount, price_per_share, now),
            )
            conn.commit()

            tbl = "agents" if user.get("_type") == "agent" else "users"
            new_balance_row = conn.execute(
                f"SELECT cgt_balance FROM {tbl} WHERE id=?", (str(user["id"]),)
            ).fetchone()
            updated_market = conn.execute(
                "SELECT yes_pool, no_pool FROM prediction_markets WHERE id=?", (market_id,)
            ).fetchone()

            new_bal = round(float(new_balance_row["cgt_balance"]), 2) if new_balance_row else None
            if new_bal is None:
                logger.warning(
                    "markets.trade: balance fetch failed after buy — user=%s market=%s",
                    str(user["id"])[:8], market_id,
                )
            else:
                logger.info(
                    "markets.trade: BUY %s %s %.2f CGT → %.4f shares  bal=%.2f  market=%s",
                    body.outcome.upper(), user.get("_type", "user"),
                    body.cgt_amount, shares_out, new_bal, market_id,
                )

            return {
                "shares": round(shares_out, 4),
                "cgt_amount": round(body.cgt_amount, 2),
                "price": round(price_per_share, 6),
                "new_probability_yes": round(get_price_yes(updated_market["yes_pool"], updated_market["no_pool"]), 4),
                "user_cgt_balance": new_bal,
            }

        else:  # sell
            shares_to_sell = body.cgt_amount  # cgt_amount field holds shares for sell

            pos = conn.execute(
                "SELECT * FROM market_positions WHERE market_id=? AND user_id=?",
                (market_id, str(user["id"])),
            ).fetchone()
            if not pos:
                raise HTTPException(400, "No position in this market")

            if body.outcome == "yes":
                if float(pos["shares_yes"]) < shares_to_sell:
                    raise HTTPException(400, "Insufficient YES shares")
                cgt_out, new_yes_pool, new_no_pool = calc_sell_yes(shares_to_sell, yes_pool, no_pool)
            else:
                if float(pos["shares_no"]) < shares_to_sell:
                    raise HTTPException(400, "Insufficient NO shares")
                cgt_out, new_yes_pool, new_no_pool = calc_sell_no(shares_to_sell, yes_pool, no_pool)

            price_per_share = round(cgt_out / shares_to_sell, 6) if shares_to_sell > 0 else 0.0

            # Add CGT to user or agent
            _add_cgt(str(user["id"]), cgt_out, conn, user.get("_type", "user"))

            # Update pools
            conn.execute(
                "UPDATE prediction_markets SET yes_pool=?, no_pool=?, total_volume=total_volume+? WHERE id=?",
                (new_yes_pool, new_no_pool, cgt_out, market_id),
            )

            # Reduce position shares
            if body.outcome == "yes":
                conn.execute(
                    """UPDATE market_positions
                       SET shares_yes=shares_yes-?, updated_at=?
                       WHERE market_id=? AND user_id=?""",
                    (shares_to_sell, now, market_id, str(user["id"])),
                )
            else:
                conn.execute(
                    """UPDATE market_positions
                       SET shares_no=shares_no-?, updated_at=?
                       WHERE market_id=? AND user_id=?""",
                    (shares_to_sell, now, market_id, str(user["id"])),
                )

            # Insert trade record
            conn.execute(
                """INSERT INTO market_trades
                   (id, market_id, user_id, user_type, outcome, shares, cgt_amount,
                    price_per_share, trade_type, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'sell', ?)""",
                (trade_id, market_id, str(user["id"]), user.get("_type", "user"),
                 body.outcome, shares_to_sell, cgt_out, price_per_share, now),
            )
            conn.commit()

            tbl = "agents" if user.get("_type") == "agent" else "users"
            new_balance_row = conn.execute(
                f"SELECT cgt_balance FROM {tbl} WHERE id=?", (str(user["id"]),)
            ).fetchone()
            updated_market = conn.execute(
                "SELECT yes_pool, no_pool FROM prediction_markets WHERE id=?", (market_id,)
            ).fetchone()

            new_bal = round(float(new_balance_row["cgt_balance"]), 2) if new_balance_row else None
            if new_bal is None:
                logger.warning(
                    "markets.trade: balance fetch failed after sell — user=%s market=%s",
                    str(user["id"])[:8], market_id,
                )
            else:
                logger.info(
                    "markets.trade: SELL %s %s %.4f shares → %.2f CGT  bal=%.2f  market=%s",
                    body.outcome.upper(), user.get("_type", "user"),
                    shares_to_sell, cgt_out, new_bal, market_id,
                )

            return {
                "shares": round(shares_to_sell, 4),
                "cgt_amount": round(cgt_out, 2),
                "price": round(price_per_share, 6),
                "new_probability_yes": round(get_price_yes(updated_market["yes_pool"], updated_market["no_pool"]), 4),
                "user_cgt_balance": new_bal,
            }

    finally:
        conn.close()


@router.post("/markets/{market_id}/resolve")
def resolve_market(
    market_id: str,
    body: ResolveRequest,
):
    if not body.master_key or body.master_key != COGIT_MASTER_KEY:
        raise HTTPException(403, "Invalid master key")
    if body.outcome not in ("yes", "no"):
        raise HTTPException(400, "outcome must be 'yes' or 'no'")

    now = datetime.utcnow().isoformat()

    conn = get_conn()
    try:
        market = conn.execute(
            "SELECT * FROM prediction_markets WHERE id=?", (market_id,)
        ).fetchone()
        if not market:
            raise HTTPException(404, "Market not found")
        if market["status"] != "open":
            raise HTTPException(400, "Market is already resolved or cancelled")

        yes_pool = float(market["yes_pool"])
        no_pool = float(market["no_pool"])
        total_pool = yes_pool + no_pool

        # Get all positions
        positions = conn.execute(
            "SELECT * FROM market_positions WHERE market_id=?", (market_id,)
        ).fetchall()

        # Calculate total outstanding shares for winning side
        if body.outcome == "yes":
            total_winning_shares = sum(float(p["shares_yes"]) for p in positions if float(p["shares_yes"]) > 0)
        else:
            total_winning_shares = sum(float(p["shares_no"]) for p in positions if float(p["shares_no"]) > 0)

        winners_count = 0
        total_payout = 0.0

        if total_winning_shares > 0:
            payout_per_share = total_pool / total_winning_shares

            for pos in positions:
                if body.outcome == "yes":
                    winning_shares = float(pos["shares_yes"])
                else:
                    winning_shares = float(pos["shares_no"])

                if winning_shares > 0:
                    payout = round(winning_shares * payout_per_share, 2)
                    user_type = pos["user_type"] if "user_type" in pos.keys() else "user"
                    _add_cgt(pos["user_id"], payout, conn, user_type)
                    winners_count += 1
                    total_payout += payout

        # Resolve market
        conn.execute(
            """UPDATE prediction_markets
               SET status='resolved', resolved_outcome=?, resolved_at=?
               WHERE id=?""",
            (body.outcome, now, market_id),
        )
        conn.commit()
    finally:
        conn.close()

    return {
        "resolved_outcome": body.outcome,
        "total_payout": round(total_payout, 2),
        "winners_count": winners_count,
    }


@router.get("/markets/{market_id}/trades")
def get_market_trades(
    market_id: str,
    limit: int = 50,
    offset: int = 0,
):
    conn = get_conn()
    try:
        market = conn.execute(
            "SELECT id FROM prediction_markets WHERE id=?", (market_id,)
        ).fetchone()
        if not market:
            raise HTTPException(404, "Market not found")

        trades = conn.execute(
            """SELECT id, user_id, outcome, shares, cgt_amount, price_per_share,
                      trade_type, created_at
               FROM market_trades
               WHERE market_id=?
               ORDER BY created_at DESC
               LIMIT ? OFFSET ?""",
            (market_id, limit, offset),
        ).fetchall()
    finally:
        conn.close()

    return [
        {
            "id": t["id"],
            "user_id": t["user_id"][:8],
            "outcome": t["outcome"],
            "shares": round(t["shares"], 4),
            "cgt_amount": round(t["cgt_amount"], 2),
            "price_per_share": round(t["price_per_share"], 4),
            "trade_type": t["trade_type"],
            "created_at": t["created_at"],
        }
        for t in trades
    ]


@router.delete("/markets/{market_id}")
def delete_market(market_id: str, master_key: str):
    """Hard-delete a market (master key required). Used for cleanup only."""
    if not master_key or master_key != COGIT_MASTER_KEY:
        raise HTTPException(403, "Invalid master key")
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
