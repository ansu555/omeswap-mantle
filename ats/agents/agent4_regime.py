"""
Agent 4 — Market Regime Detection

Runs every 15 minutes, classifies the global market regime using BTC as the
anchor (BTC dominates cross-asset correlation), and writes the result to Redis.

Redis keys written:
  regime:current      → JSON {regime, confidence, btc_vol, funding_rate, updated_at}
  regime:updated_at   → JSON {ts: unix_timestamp}
  market:btc_vol      → float  (read by Agent 5)
  market:funding_rate → float  (read by Agent 5)

Any other agent that needs price data for a specific token can use:

    from ats.agents.regime.price_reader import get_price_buffer, get_latest_price
    from ats.agents.regime.feature_builder import build_features

    prices = await get_price_buffer("SOL", n=60)
    features = await build_features("AVAX")

The feature schema (return, realized_vol, funding_rate) is token-agnostic,
so the same HMM can be applied to any asset for local regime context.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from ats.agents.regime.hmm_model import regime_hmm
from ats.agents.regime.feature_builder import build_features
from ats.agents.regime.funding_rate import get_avg_funding_rate
from ats.data.redis_client import set_json, set_float

BROADCAST_INTERVAL = 15 * 60   # 15 minutes

# BTC is the global regime anchor — highest cross-asset correlation
REGIME_ANCHOR = "BTC"


class Agent4RegimeDetection:
    async def run(self) -> None:
        while True:
            await self._classify_and_broadcast()
            await asyncio.sleep(BROADCAST_INTERVAL)

    async def _classify_and_broadcast(self) -> None:
        # Fetch funding rate once so build_features doesn't make a redundant call
        funding_rate = await get_avg_funding_rate()

        features = await build_features(
            REGIME_ANCHOR,
            prefetched_funding_rate=funding_rate,
        )
        if features is None:
            # Not enough history in Redis yet — skip this cycle silently
            return

        btc_vol = float(features[0, 1])

        # Persist raw signals so Agent 5 can read without re-fetching
        await set_float("market:btc_vol", btc_vol)
        await set_float("market:funding_rate", funding_rate)

        label, confidence = regime_hmm.predict(features)

        now = datetime.now(timezone.utc)
        await set_json("regime:current", {
            "regime":       label,
            "confidence":   confidence,
            "btc_vol":      btc_vol,
            "funding_rate": funding_rate,
            "updated_at":   now.isoformat(),
        })
        await set_json("regime:updated_at", {"ts": now.timestamp()})
