import asyncio
import httpx
from ats.data.queue import raw_queue
from ats.data import redis_client
from ats.config import settings

POLL_INTERVAL = 60  # seconds
COINGECKO_IDS: dict[str, str] = {
    "BTC": "bitcoin",
    "ETH": "ethereum",
    "WBTC": "wrapped-bitcoin",
}


async def coingecko_poller_worker() -> None:
    async with httpx.AsyncClient() as client:
        while True:
            ids = ",".join(COINGECKO_IDS.values())
            try:
                resp = await client.get(
                    "https://api.coingecko.com/api/v3/simple/price",
                    params={
                        "ids": ids,
                        "vs_currencies": "usd",
                        "include_24hr_vol": "true",
                        "include_24hr_change": "true",
                        "x_cg_demo_api_key": settings.coingecko_api_key,
                    },
                    timeout=10,
                )
                data = resp.json()
                for symbol, cg_id in COINGECKO_IDS.items():
                    item = data.get(cg_id, {})
                    price = item.get("usd", 0)
                    # Write latest price to Redis for Agent 5 / Agent 6
                    await redis_client.set_float(f"price:{symbol}", price)
                    await raw_queue.put({
                        "source": "coingecko",
                        "type": "price",
                        "ticker": symbol,
                        "payload": {
                            "price": price,
                            "volume_24h_usd": item.get("usd_24h_vol", 0),
                            "change_24h_pct": item.get("usd_24h_change", 0),
                        },
                    })
            except Exception:
                pass
            await asyncio.sleep(POLL_INTERVAL)
