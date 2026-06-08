"""
Generic price reader — any agent can call get_price_buffer("SOL"), get_price_buffer("AVAX"),
get_latest_price("BTC"), etc. Data flows in from Agent 1 via price_buffer:{TICKER} in Redis.

Redis key pattern written by normalizer.py:
  price_buffer:{TICKER}   → list of JSON payloads, newest-first, up to 60 bars
  price:{TICKER}          → latest float price (written by coingecko_poller)
"""
from __future__ import annotations

import json
import numpy as np
from ats.data.redis_client import get_redis, get_float


async def get_price_buffer(ticker: str, n: int = 60) -> list[float] | None:
    """
    Return up to `n` prices for `ticker` in chronological order (oldest first).
    Returns None if fewer than 2 data points exist.

    ticker: uppercase symbol, e.g. "BTC", "ETH", "SOL", "AVAX"
    """
    r = await get_redis()
    # Redis list is newest-first (lpush), so we reverse to get oldest-first
    raw = await r.lrange(f"price_buffer:{ticker}", 0, n - 1)
    if len(raw) < 2:
        return None
    prices = []
    for b in reversed(raw):
        try:
            payload = json.loads(b)
            price = payload.get("price", 0)
            if price and price > 0:
                prices.append(float(price))
        except (json.JSONDecodeError, ValueError):
            pass
    return prices if len(prices) >= 2 else None


async def get_latest_price(ticker: str) -> float | None:
    """
    Return the most recent price for any ticker from Redis.
    Falls back to the head of the price buffer if the scalar key is missing.
    """
    price = await get_float(f"price:{ticker}")
    if price is not None and price > 0:
        return price
    # Fall back to first entry in the buffer
    r = await get_redis()
    raw = await r.lindex(f"price_buffer:{ticker}", 0)
    if raw:
        try:
            return float(json.loads(raw).get("price", 0)) or None
        except (json.JSONDecodeError, ValueError):
            pass
    return None


async def get_available_tickers() -> list[str]:
    """Return all tickers that currently have a price_buffer in Redis."""
    r = await get_redis()
    keys = await r.keys("price_buffer:*")
    return [k.replace("price_buffer:", "") for k in keys]


def compute_returns(prices: list[float]) -> np.ndarray:
    """Convert a price series to percentage returns."""
    arr = np.array(prices, dtype=float)
    return np.diff(arr) / arr[:-1]


def compute_realized_vol(prices: list[float], window: int = 30) -> float:
    """Annualized realized volatility over `window` most-recent bars."""
    returns = compute_returns(prices)
    if len(returns) < 2:
        return 0.0
    return float(np.std(returns[-window:]) * np.sqrt(365))
