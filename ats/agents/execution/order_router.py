"""Order router — selects execution strategy and dispatches swaps.

Strategy rules:
  - size_usd <= $10K  →  single atomic swap
  - size_usd >  $10K  →  TWAP: 5 equal slices, 2 minutes apart
"""
from __future__ import annotations

import asyncio
import logging

from ats.agents.execution.dex_client import get_quote, approve_token, swap_exact_tokens
from ats.config import settings

logger = logging.getLogger(__name__)

SINGLE_SWAP_MAX_USD: float = 10_000.0
TWAP_SLICES: int = 5
TWAP_INTERVAL_S: int = 120       # 2 minutes between slices


def _apply_slippage(amount: int) -> int:
    """Return minimum acceptable output after applying configured slippage."""
    return int(amount * (10_000 - settings.dex_slippage_bps) // 10_000)


async def _do_swap(token_in: str, token_out: str, amount_in_wei: int) -> dict:
    """Execute one atomic swap and return a result dict."""
    quoted = await get_quote(token_in, token_out, amount_in_wei)
    min_out = _apply_slippage(quoted)
    await approve_token(token_in, amount_in_wei)
    tx_hash = await swap_exact_tokens(token_in, token_out, amount_in_wei, min_out)
    logger.info(
        "swap submitted token_in=%s token_out=%s amount_in_wei=%d tx=%s",
        token_in, token_out, amount_in_wei, tx_hash,
    )
    return {
        "tx_hash":          tx_hash,
        "amount_in_wei":    amount_in_wei,
        "quoted_out_wei":   quoted,
        "min_out_wei":      min_out,
    }


async def execute_order(
    token_in: str,
    token_out: str,
    amount_in_wei: int,
    size_usd: float,
) -> dict:
    """Route the order and return execution metadata.

    Returns:
        {
            "strategy": "single_swap" | "twap",
            "swaps": [{"tx_hash": str, "amount_in_wei": int, "quoted_out_wei": int, ...}, ...]
        }
    """
    if size_usd <= SINGLE_SWAP_MAX_USD:
        result = await _do_swap(token_in, token_out, amount_in_wei)
        return {"strategy": "single_swap", "swaps": [result]}

    # TWAP — split into equal-sized slices
    slice_wei = amount_in_wei // TWAP_SLICES
    swaps: list[dict] = []
    for i in range(TWAP_SLICES):
        swap = await _do_swap(token_in, token_out, slice_wei)
        swaps.append(swap)
        if i < TWAP_SLICES - 1:
            logger.info("TWAP slice %d/%d done — sleeping %ds", i + 1, TWAP_SLICES, TWAP_INTERVAL_S)
            await asyncio.sleep(TWAP_INTERVAL_S)

    return {"strategy": "twap", "swaps": swaps}
