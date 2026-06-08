"""
Agent 2 — Signal Agent

Drains normalized_queue (written by Agent 1). For each price or on-chain event:
  1. Reads regime:current from Redis (set by Agent 4 every 15 min)
  2. Computes FinBERT sentiment from buffered headlines for that ticker
  3. Computes regime-gated technical indicator signal from the price buffer
  4. Combines both into a SignalVote and writes signal:latest:{TICKER} to Redis

News packets are buffered but not acted on immediately — they feed the next
price-triggered cycle for the same ticker.

Works for any token whose price buffer is populated by Agent 1, not just BTC/ETH.
"""
from __future__ import annotations

import asyncio

from ats.data.queue import normalized_queue
from ats.data.redis_client import get_json, set_json
from ats.models.packets import DataPacket
from ats.agents.signal.sentiment import buffer_headline, compute_sentiment
from ats.agents.signal.technicals import compute_technical_signal
from ats.agents.signal.combiner import combine


class Agent2Signal:
    async def run(self) -> None:
        while True:
            packet: DataPacket = await normalized_queue.get()
            await self._process(packet)

    async def _process(self, packet: DataPacket) -> None:
        # Buffer news for the next price cycle; don't act on it immediately
        if packet.type == "news":
            buffer_headline(packet)
            return

        if packet.type not in ("price", "onchain_event"):
            return

        # Regime is the first read every cycle — controls everything downstream
        regime_data = await get_json("regime:current")
        if not regime_data:
            return

        regime            = regime_data["regime"]
        regime_confidence = regime_data["confidence"]

        sentiment = compute_sentiment(packet.ticker)
        technical = await compute_technical_signal(packet.ticker, regime)
        vote      = combine(packet.ticker, sentiment, technical, regime, regime_confidence)

        await set_json(f"signal:latest:{packet.ticker}", vote.model_dump())
