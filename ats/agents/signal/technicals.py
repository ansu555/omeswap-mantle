"""
Technical indicator sub-module.

Regime-gated: which indicator fires depends on the market context written to
regime:current by Agent 4.

  Trending regimes  (low_vol_bull, high_vol_bull) → MACD histogram
  Choppy regime     (choppy)                       → Bollinger Band %B
  Stand-down        (bear, high_vol_bear, crisis)  → always NEUTRAL

Price buffers for ANY ticker are available in Redis (written by Agent 1 normalizer),
so this module works with any symbol, not just BTC/ETH.
"""
from __future__ import annotations

import json

import pandas as pd
import pandas_ta as ta

from ats.data.redis_client import get_redis
from ats.models.state import Direction, Regime

TRENDING_REGIMES:      frozenset[str] = frozenset({"low_vol_bull", "high_vol_bull"})
MEAN_REVERSION_REGIMES: frozenset[str] = frozenset({"choppy"})
STAND_DOWN_REGIMES:    frozenset[str] = frozenset({"bear", "high_vol_bear", "crisis"})

MIN_BARS = 20   # minimum bars to compute any indicator


async def compute_technical_signal(ticker: str, regime: Regime) -> Direction:
    """
    Read price_buffer:{ticker} from Redis and compute the regime-appropriate
    technical indicator signal.

    Args:
        ticker: uppercase symbol — "BTC", "SOL", "AVAX", etc.
        regime: current market regime label from regime:current

    Returns:
        "LONG" | "SHORT" | "NEUTRAL"
    """
    if regime in STAND_DOWN_REGIMES:
        return "NEUTRAL"

    r = await get_redis()
    raw = await r.lrange(f"price_buffer:{ticker}", 0, 59)
    if len(raw) < MIN_BARS:
        return "NEUTRAL"

    bars = [json.loads(b) for b in reversed(raw)]
    df = pd.DataFrame(bars)

    # Normalise column name: some sources write "price", others "close"
    if "close" not in df.columns and "price" in df.columns:
        df["close"] = df["price"]
    if "close" not in df.columns:
        return "NEUTRAL"

    close = df["close"].astype(float)

    if regime in TRENDING_REGIMES:
        return _macd_signal(close)

    if regime in MEAN_REVERSION_REGIMES:
        return _bb_signal(close)

    return "NEUTRAL"


def _macd_signal(close: pd.Series) -> Direction:
    """MACD histogram crossover — positive = LONG, negative = SHORT."""
    macd_df = ta.macd(close)
    if macd_df is None or macd_df.empty:
        return "NEUTRAL"
    col = next((c for c in macd_df.columns if "MACDh" in c), None)
    if col is None:
        return "NEUTRAL"
    hist = float(macd_df.iloc[-1][col])
    if hist > 0.001:
        return "LONG"
    if hist < -0.001:
        return "SHORT"
    return "NEUTRAL"


def _bb_signal(close: pd.Series) -> Direction:
    """Bollinger Band %B mean-reversion — near lower band = LONG, near upper = SHORT."""
    bb_df = ta.bbands(close, length=20)
    if bb_df is None or bb_df.empty:
        return "NEUTRAL"
    pct_b_col = next((c for c in bb_df.columns if "BBP" in c), None)
    if pct_b_col is None:
        return "NEUTRAL"
    pct_b = float(bb_df.iloc[-1][pct_b_col])
    if pct_b < 0.20:
        return "LONG"
    if pct_b > 0.80:
        return "SHORT"
    return "NEUTRAL"
