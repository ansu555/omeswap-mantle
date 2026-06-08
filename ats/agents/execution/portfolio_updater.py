"""Portfolio updater — persists fill data to Redis (live state) and Postgres (audit log).

Redis keys:
  portfolio:state    — full portfolio snapshot (cash, open positions, drawdown)
  execution:fills    — capped list of the 1000 most-recent fill records (lpush)

Postgres:
  decision_receipts.fill_data — JSON fill details appended to the existing row
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from ats.data.redis_client import get_redis, get_json, set_json

logger = logging.getLogger(__name__)

# Default portfolio for a fresh agent with no history
_DEFAULT_PORTFOLIO = {
    "total_value_usd":       10_000.0,
    "cash_usd":              10_000.0,
    "daily_drawdown_pct":    0.0,
    "open_positions":        [],
    "protocol_category_weights": {},
}


async def update_portfolio_after_fill(
    *,
    ticker: str,
    direction: str,
    amount_in_wei: int,
    avg_price: float,
    size_usd: float,
    stop_loss_price: float,
) -> None:
    """Deduct cash and add the new position to portfolio:state in Redis.

    Also appends a compact fill record to the execution:fills list so Phase 8
    can broadcast it over WebSocket without scanning the full state.
    """
    r = await get_redis()
    portfolio = await get_json("portfolio:state") or dict(_DEFAULT_PORTFOLIO)

    portfolio["cash_usd"] = max(0.0, portfolio.get("cash_usd", 0.0) - size_usd)

    position = {
        "ticker":         ticker,
        "direction":      direction,
        "amount_in_wei":  amount_in_wei,
        "entry_price":    avg_price,
        "size_usd":       size_usd,
        "stop_loss_price":stop_loss_price,
        "opened_at":      datetime.now(timezone.utc).isoformat(),
    }
    portfolio.setdefault("open_positions", []).append(position)

    await set_json("portfolio:state", portfolio)
    logger.info(
        "portfolio updated ticker=%s direction=%s size_usd=%.2f cash_remaining=%.2f",
        ticker, direction, size_usd, portfolio["cash_usd"],
    )

    fill_record = json.dumps({
        "ticker":      ticker,
        "direction":   direction,
        "size_usd":    size_usd,
        "avg_price":   avg_price,
        "filled_at":   datetime.now(timezone.utc).isoformat(),
    })
    await r.lpush("execution:fills", fill_record)
    await r.ltrim("execution:fills", 0, 999)


async def remove_position_from_portfolio(ticker: str) -> None:
    """Remove an open position when it is closed (e.g. by the stop-loss monitor)."""
    portfolio = await get_json("portfolio:state")
    if not portfolio:
        return
    before = len(portfolio.get("open_positions", []))
    portfolio["open_positions"] = [
        p for p in portfolio.get("open_positions", [])
        if p.get("ticker") != ticker
    ]
    after = len(portfolio["open_positions"])
    await set_json("portfolio:state", portfolio)
    logger.info("removed %d position(s) for %s from portfolio", before - after, ticker)


async def update_receipt_with_fill(receipt_id: str, fill_data: dict, session) -> None:
    """Persist fill_data to the corresponding DecisionReceipt row in Postgres."""
    from sqlalchemy import update
    from ats.models.receipts import DecisionReceipt

    await session.execute(
        update(DecisionReceipt)
        .where(DecisionReceipt.id == receipt_id)
        .values(fill_data=fill_data)
    )
    await session.commit()
    logger.info("receipt %s updated with fill_data", receipt_id)
