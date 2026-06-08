import asyncio
import json
import websockets
from ats.data.queue import raw_queue
from ats.config import settings

BINANCE_WS = "wss://stream.binance.com:9443/stream"


async def binance_ws_worker() -> None:
    streams = "/".join(f"{t.lower()}@ticker" for t in settings.crypto_tickers)
    url = f"{BINANCE_WS}?streams={streams}"
    while True:
        try:
            async with websockets.connect(url) as ws:
                async for raw in ws:
                    data = json.loads(raw).get("data", {})
                    if not data:
                        continue
                    await raw_queue.put({
                        "source": "binance",
                        "type": "price",
                        "ticker": data["s"].replace("USDT", ""),
                        "payload": {
                            "price": float(data["c"]),
                            "volume_24h": float(data["v"]),
                            "change_pct": float(data["P"]),
                            "bid": float(data["b"]),
                            "ask": float(data["a"]),
                        },
                    })
        except Exception:
            await asyncio.sleep(3)  # backoff on disconnect / error
