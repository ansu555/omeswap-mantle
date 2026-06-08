import asyncio

from ats.agents.sources.binance_ws import binance_ws_worker
from ats.agents.sources.coingecko_poller import coingecko_poller_worker
from ats.agents.sources.news_poller import news_poller_worker
from ats.agents.sources.onchain_watcher import onchain_watcher_worker
from ats.agents.normalizer import normalization_loop


class Agent1DataIngestion:
    """
    Runs all data source workers plus the central normalization loop concurrently.

    Sources:
      - Binance WebSocket  → price ticks (< 100ms latency)
      - CoinGecko poller   → BTC/ETH/WBTC price + vol (60s poll), writes price:{ticker} to Redis
      - NewsAPI poller     → headlines per ticker (60s poll)
      - DeFiLlama watcher  → protocol TVL change events (30s poll)

    The normalization_loop drains raw_queue, scores each packet (CQ = freshness × reliability),
    deduplicates, flags social anomalies, maintains price_buffer:{ticker} lists in Redis,
    and pushes clean DataPacket objects to normalized_queue for Agents 2, 3, and 4.
    """

    async def run(self) -> None:
        await asyncio.gather(
            binance_ws_worker(),
            coingecko_poller_worker(),
            news_poller_worker(),
            onchain_watcher_worker(),
            normalization_loop(),
        )
