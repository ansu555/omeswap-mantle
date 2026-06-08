"""
Binance perpetual funding rate fetcher.

Accepts any list of USDT-margined perp symbols. Default anchors are BTC + ETH
because they drive system-wide sentiment, but any agent can pass custom symbols.
"""
from __future__ import annotations

import httpx

BINANCE_FUTURES_URL = "https://fapi.binance.com/fapi/v1/fundingRate"
# Default anchor pairs — representative of broad market sentiment
DEFAULT_PAIRS = ["BTCUSDT", "ETHUSDT"]


async def get_funding_rates(symbols: list[str] | None = None) -> dict[str, float]:
    """
    Fetch the latest funding rate for each symbol.

    Args:
        symbols: list of Binance perp symbols, e.g. ["SOLUSDT", "AVAXUSDT"].
                 Defaults to DEFAULT_PAIRS (BTC + ETH) if omitted.

    Returns:
        Dict mapping symbol → funding_rate float. Missing symbols are omitted.
    """
    pairs = symbols or DEFAULT_PAIRS
    result: dict[str, float] = {}
    async with httpx.AsyncClient(timeout=5) as client:
        for symbol in pairs:
            try:
                resp = await client.get(
                    BINANCE_FUTURES_URL,
                    params={"symbol": symbol, "limit": 1},
                )
                data = resp.json()
                if data:
                    result[symbol] = float(data[-1]["fundingRate"])
            except Exception:
                pass
    return result


async def get_avg_funding_rate(symbols: list[str] | None = None) -> float:
    """
    Return the average funding rate across the given symbols.
    Returns 0.0 if no data is available (safe fallback).
    """
    rates = await get_funding_rates(symbols)
    values = list(rates.values())
    return sum(values) / len(values) if values else 0.0
