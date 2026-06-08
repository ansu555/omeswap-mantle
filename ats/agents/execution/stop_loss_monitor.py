"""Stop-loss background monitor.

Runs as a persistent asyncio task (started by Agent6Execution.start()).
On every tick it reads the current portfolio from Redis, checks each open
position against its stop-loss price using the latest price stored in Redis
(written by Agent 1 / data-ingestion layer), and immediately executes a
market exit if the stop level is breached.

Exit logic:
  - LONG position  →  sell the asset token for USDC if price ≤ stop_loss_price
  - SHORT position →  buy the asset token with USDC if price ≥ stop_loss_price
  (The ATS uses a token-balance-based long/short model on-chain.)
"""
from __future__ import annotations

import asyncio
import logging

from ats.data.redis_client import get_json, get_float, set_json
from ats.agents.execution.dex_client import (
    get_quote,
    approve_token,
    swap_exact_tokens,
    TOKEN_ADDRESSES,
)
from ats.config import settings

logger = logging.getLogger(__name__)

CHECK_INTERVAL_S: int = 2   # seconds between portfolio scans

# Maps ATS ticker symbols → on-chain token symbol used in TOKEN_ADDRESSES
_TICKER_TO_TOKEN: dict[str, str] = {
    "BTCUSDT":  "WBTC",
    "WBTCUSDT": "WBTC",
    "ETHUSDT":  "WETH",
}
_QUOTE_TOKEN = "USDC"


def _ticker_to_token(ticker: str) -> str:
    return _TICKER_TO_TOKEN.get(ticker, "W0G")


async def _exit_position(pos: dict) -> bool:
    """Attempt a market swap to exit the position.

    Returns True on success, False on any exception (so the loop can keep
    running and retry on the next tick).
    """
    ticker    = pos["ticker"]
    direction = pos["direction"]
    amount_wei = int(pos.get("amount_in_wei", 0))
    asset_token = _ticker_to_token(ticker)

    if amount_wei <= 0:
        logger.warning("stop-loss: skipping %s — amount_in_wei=0", ticker)
        return False

    # LONG exit: swap asset → USDC
    # SHORT exit: swap USDC → asset (unwind synthetic short)
    if direction == "LONG":
        token_in, token_out = asset_token, _QUOTE_TOKEN
    else:
        token_in, token_out = _QUOTE_TOKEN, asset_token

    try:
        quoted = await get_quote(token_in, token_out, amount_wei)
        min_out = int(quoted * (10_000 - settings.dex_slippage_bps) // 10_000)
        await approve_token(token_in, amount_wei)
        tx_hash = await swap_exact_tokens(token_in, token_out, amount_wei, min_out)
        logger.warning(
            "STOP-LOSS TRIGGERED ticker=%s direction=%s tx=%s",
            ticker, direction, tx_hash,
        )
        return True
    except Exception as exc:
        logger.error("stop-loss exit FAILED for %s: %s", ticker, exc)
        return False


async def stop_loss_monitor_loop() -> None:
    """Infinite loop — called once as a background task at agent startup."""
    logger.info("stop-loss monitor started (interval=%ds)", CHECK_INTERVAL_S)
    while True:
        try:
            portfolio = await get_json("portfolio:state")
            if not portfolio:
                await asyncio.sleep(CHECK_INTERVAL_S)
                continue

            open_positions: list[dict] = list(portfolio.get("open_positions", []))
            positions_to_remove: list[dict] = []

            for pos in open_positions:
                ticker    = pos.get("ticker", "")
                stop      = pos.get("stop_loss_price", None)
                direction = pos.get("direction", "LONG")

                if stop is None or not ticker:
                    continue

                current_price = await get_float(f"price:{ticker}") or 0.0
                if current_price <= 0:
                    continue

                breached = (
                    (direction == "LONG"  and current_price <= stop) or
                    (direction == "SHORT" and current_price >= stop)
                )

                if breached:
                    logger.warning(
                        "stop-loss breach ticker=%s direction=%s price=%.4f stop=%.4f",
                        ticker, direction, current_price, stop,
                    )
                    success = await _exit_position(pos)
                    if success:
                        positions_to_remove.append(pos)

            if positions_to_remove:
                # Re-fetch in case another task modified portfolio concurrently
                portfolio = await get_json("portfolio:state") or portfolio
                remaining = [
                    p for p in portfolio.get("open_positions", [])
                    if p not in positions_to_remove
                ]
                portfolio["open_positions"] = remaining
                await set_json("portfolio:state", portfolio)

        except Exception as exc:
            logger.error("stop-loss monitor loop error: %s", exc)

        await asyncio.sleep(CHECK_INTERVAL_S)
