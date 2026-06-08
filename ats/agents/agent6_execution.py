"""Agent 6 — Execution Agent.

Responsibilities:
  1. Receive an approved RiskDecision from the orchestrator.
  2. Select an execution strategy (single swap or TWAP) based on order size.
  3. Submit the swap transaction(s) to the 0G DEX via web3.py.
  4. Wait for on-chain confirmation of every tx.
  5. Persist fill data to Redis (portfolio state) and Postgres (DecisionReceipt).
  6. Launch the stop-loss background monitor at startup.

Token convention:
  - The ATS always quotes against USDC (6-decimal ERC-20 on 0G Chain).
  - LONG  → buy asset token with USDC  (token_in=USDC, token_out=asset)
  - SHORT → sell asset token for USDC  (token_in=asset, token_out=USDC)
"""
from __future__ import annotations

import asyncio
import logging

from ats.models.state import AgentState
from ats.agents.execution.order_router import execute_order
from ats.agents.execution.fill_monitor import wait_for_receipts
from ats.agents.execution.portfolio_updater import (
    update_portfolio_after_fill,
    update_receipt_with_fill,
)
from ats.agents.execution.stop_loss_monitor import stop_loss_monitor_loop
from ats.data.postgres_client import get_session

logger = logging.getLogger(__name__)

# Maps ATS ticker → 0G Chain DEX token symbol
TICKER_TO_TOKEN: dict[str, str] = {
    "BTCUSDT":  "WBTC",
    "WBTCUSDT": "WBTC",
    "ETHUSDT":  "WETH",
}
QUOTE_TOKEN = "USDC"     # all buys/sells are vs USDC

# USDC has 6 decimals; WBTC has 8
_DECIMALS: dict[str, int] = {
    "USDC": 6,
    "WBTC": 8,
    "WETH": 18,
    "W0G":  18,
}


def _to_wei(amount: float, token: str) -> int:
    decimals = _DECIMALS.get(token, 18)
    return int(amount * (10 ** decimals))


class Agent6Execution:
    """Execution agent — wraps strategy selection, confirmation, and state update."""

    _stop_loss_task: asyncio.Task | None = None

    async def start(self) -> None:
        """Launch the stop-loss background monitor (call once at API startup)."""
        if self._stop_loss_task is None or self._stop_loss_task.done():
            self._stop_loss_task = asyncio.create_task(
                stop_loss_monitor_loop(),
                name="stop_loss_monitor",
            )
            logger.info("Agent6: stop-loss monitor task started")

    async def execute(self, state: AgentState) -> AgentState:
        """Execute the approved order and return updated state.

        Returns state unchanged if risk_decision is absent or not approved.
        """
        risk = state.risk_decision
        if not risk or not risk.approved:
            logger.info(
                "Agent6: skipping execution — approved=%s veto=%s",
                risk.approved if risk else None,
                risk.veto_code if risk else None,
            )
            return state

        direction   = state.signal_vote.direction          # "LONG" | "SHORT"
        asset_token = TICKER_TO_TOKEN.get(state.trigger_ticker, "W0G")
        size_usd    = risk.size_usd or 0.0
        shares      = risk.shares or 0.0

        if direction == "LONG":
            token_in, token_out = QUOTE_TOKEN, asset_token
            # Convert USD notional to USDC wei (6 decimals)
            amount_in_wei = _to_wei(size_usd, QUOTE_TOKEN)
        else:
            # SHORT: sell the asset position back to USDC
            token_in, token_out = asset_token, QUOTE_TOKEN
            amount_in_wei = _to_wei(shares, asset_token)

        logger.info(
            "Agent6: executing %s %s→%s amount_in_wei=%d size_usd=%.2f",
            direction, token_in, token_out, amount_in_wei, size_usd,
        )

        result = await execute_order(token_in, token_out, amount_in_wei, size_usd)

        # Wait for confirmations — partial failures are captured, not raised
        tx_hashes = [swap["tx_hash"] for swap in result["swaps"]]
        receipts  = await wait_for_receipts(tx_hashes)

        avg_price = (size_usd / shares) if shares > 0 else 0.0
        fill_data = {
            "strategy":  result["strategy"],
            "avg_price": round(avg_price, 6),
            "size_usd":  size_usd,
            "tx_hashes": tx_hashes,
            "receipts":  receipts,
        }

        await update_portfolio_after_fill(
            ticker=state.trigger_ticker,
            direction=direction,
            amount_in_wei=amount_in_wei,
            avg_price=avg_price,
            size_usd=size_usd,
            stop_loss_price=risk.stop_loss_price or 0.0,
        )

        if state.receipt_id:
            async with get_session() as session:
                await update_receipt_with_fill(state.receipt_id, fill_data, session)

        logger.info(
            "Agent6: fill complete receipt_id=%s strategy=%s txs=%s",
            state.receipt_id, result["strategy"], tx_hashes,
        )
        return state
