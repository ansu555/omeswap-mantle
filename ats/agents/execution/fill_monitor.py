"""Fill monitor — polls the chain until a transaction is confirmed or times out."""
from __future__ import annotations

import asyncio
import logging

from ats.agents.execution.dex_client import get_w3

logger = logging.getLogger(__name__)

POLL_INTERVAL_S: int = 2     # seconds between receipt polls
MAX_WAIT_S: int = 120        # hard timeout before raising TimeoutError


async def wait_for_receipt(tx_hash: str) -> dict:
    """Block until `tx_hash` is mined and return the transaction receipt dict.

    Raises:
        TimeoutError: if the tx is not confirmed within MAX_WAIT_S seconds.
    """
    w3 = get_w3()
    attempts = MAX_WAIT_S // POLL_INTERVAL_S
    for attempt in range(attempts):
        receipt = await w3.eth.get_transaction_receipt(tx_hash)
        if receipt is not None:
            status = receipt.get("status", -1)
            logger.info(
                "tx %s confirmed block=%s status=%s",
                tx_hash, receipt.get("blockNumber"), status,
            )
            return dict(receipt)
        logger.debug(
            "waiting for tx %s (attempt %d/%d)", tx_hash, attempt + 1, attempts
        )
        await asyncio.sleep(POLL_INTERVAL_S)

    raise TimeoutError(
        f"Tx {tx_hash} was not confirmed within {MAX_WAIT_S}s"
    )


async def wait_for_receipts(tx_hashes: list[str]) -> list[dict]:
    """Confirm multiple transactions concurrently.

    Failed (timed-out) receipts are replaced with an error dict rather than
    raising, so a partial TWAP fill is still recorded.
    """
    async def _safe(tx: str) -> dict:
        try:
            return await wait_for_receipt(tx)
        except TimeoutError as exc:
            logger.warning("receipt timeout: %s", exc)
            return {"tx_hash": tx, "status": "timeout", "error": str(exc)}

    return list(await asyncio.gather(*[_safe(tx) for tx in tx_hashes]))
