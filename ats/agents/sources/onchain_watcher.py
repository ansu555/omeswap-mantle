import asyncio
import httpx
from ats.data.queue import raw_queue
from ats.config import settings

POLL_INTERVAL = 30  # seconds
TVL_CHANGE_THRESHOLD = 0.03  # flag if TVL changes > 3% in one poll cycle

_last_tvl: dict[str, float] = {}


async def onchain_watcher_worker() -> None:
    async with httpx.AsyncClient() as client:
        while True:
            for protocol in settings.defi_protocols:
                try:
                    resp = await client.get(
                        f"{settings.defillama_base_url}/protocol/{protocol}",
                        timeout=10,
                    )
                    data = resp.json()
                    tvl_series = data.get("tvl", [{}])
                    current_tvl = tvl_series[-1].get("totalLiquidityUSD", 0) if tvl_series else 0
                    prev_tvl = _last_tvl.get(protocol, current_tvl)
                    change_pct = (current_tvl - prev_tvl) / prev_tvl if prev_tvl else 0
                    _last_tvl[protocol] = current_tvl

                    if abs(change_pct) >= TVL_CHANGE_THRESHOLD:
                        await raw_queue.put({
                            "source": "defillama",
                            "type": "onchain_event",
                            "ticker": protocol.upper(),
                            "protocol": protocol,
                            "payload": {
                                "event_type": "tvl_change",
                                "change_pct": round(change_pct * 100, 2),
                                "current_tvl": current_tvl,
                                "prev_tvl": prev_tvl,
                            },
                        })
                except Exception:
                    pass
            await asyncio.sleep(POLL_INTERVAL)
