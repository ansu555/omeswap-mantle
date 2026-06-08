"""
Feature matrix builder for regime detection.

Any agent can call build_features(ticker) to get a (1, 3) feature row for
any token that has data in Redis. The HMM is trained on BTC because it is the
market-wide regime anchor, but the same function works for SOL, AVAX, etc.

Feature columns:
  0: latest_return      — most-recent bar return (price direction proxy)
  1: realized_vol_30d   — annualized 30-bar realized volatility
  2: funding_rate       — average perp funding rate (filled by caller or auto-fetched)

Usage:
    # For the global BTC-anchored regime (Agent 4 default):
    features = await build_features("BTC")

    # For any other token an agent wants to analyze:
    features = await build_features("SOL")
    features = await build_features("AVAX", funding_symbols=["AVAXUSDT"])
"""
from __future__ import annotations

import numpy as np

from ats.agents.regime.price_reader import (
    get_price_buffer,
    compute_returns,
    compute_realized_vol,
)
from ats.agents.regime.funding_rate import get_avg_funding_rate

MIN_BARS = 30  # minimum bars required to compute realized vol


async def build_features(
    ticker: str = "BTC",
    funding_symbols: list[str] | None = None,
    prefetched_funding_rate: float | None = None,
) -> np.ndarray | None:
    """
    Build a (1, 3) feature matrix for `ticker`.

    Args:
        ticker: uppercase token symbol — "BTC", "ETH", "SOL", "AVAX", etc.
        funding_symbols: Binance perp symbols to average for funding rate.
                         Defaults to ["BTCUSDT", "ETHUSDT"] when None.
        prefetched_funding_rate: if the caller already fetched the rate, pass it
                                  here to avoid a redundant HTTP call.

    Returns:
        np.ndarray of shape (1, 3) or None if not enough data in Redis.
    """
    prices = await get_price_buffer(ticker, n=60)
    if prices is None or len(prices) < MIN_BARS:
        return None

    returns = compute_returns(prices)
    realized_vol = compute_realized_vol(prices, window=30)
    latest_return = float(returns[-1]) if len(returns) > 0 else 0.0

    if prefetched_funding_rate is not None:
        funding_rate = prefetched_funding_rate
    else:
        funding_rate = await get_avg_funding_rate(funding_symbols)

    return np.array([[latest_return, realized_vol, funding_rate]], dtype=float)


async def build_multi_token_features(
    tickers: list[str],
    funding_symbols: list[str] | None = None,
) -> dict[str, np.ndarray]:
    """
    Build feature matrices for multiple tickers in one call.
    Fetches the funding rate once and reuses it across all tickers.

    Returns a dict of {ticker: feature_array} for tickers that had enough data.
    Tickers with insufficient Redis data are omitted from the result.
    """
    funding_rate = await get_avg_funding_rate(funding_symbols)
    result: dict[str, np.ndarray] = {}
    for ticker in tickers:
        features = await build_features(
            ticker,
            prefetched_funding_rate=funding_rate,
        )
        if features is not None:
            result[ticker] = features
    return result
