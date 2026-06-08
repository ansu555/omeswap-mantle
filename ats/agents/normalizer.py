import asyncio
import json
import uuid
from datetime import datetime, timezone

from ats.data.queue import raw_queue, normalized_queue
from ats.data import redis_client
from ats.models.packets import DataPacket

# ── Source reliability weights ────────────────────────────────────────────────
SOURCE_RELIABILITY: dict[str, float] = {
    "binance":       0.95,
    "coingecko":     0.90,
    "reuters":       0.91,
    "bloomberg":     0.93,
    "coindesk":      0.82,
    "cointelegraph": 0.75,
    "defillama":     0.88,
    "the_graph":     0.90,
    "reddit":        0.55,
    "unknown":       0.50,
}

FRESHNESS_DECAY_HOURS = 1.0  # linear decay to 0.0 over this window
CQ_DROP_THRESHOLD = 0.20
MAX_DEDUP_SIZE = 50_000
PRICE_BUFFER_BARS = 60       # keep last 60 bars per ticker

# Coordinated social attack: 20+ posts from social sources in 60 seconds
ANOMALY_SOCIAL_SOURCES = {"reddit"}
ANOMALY_POST_THRESHOLD = 20

_dedup: set[str] = set()


def freshness_score(received_at: datetime) -> float:
    age_hours = (datetime.now(timezone.utc) - received_at).total_seconds() / 3600
    return max(0.0, 1.0 - age_hours / FRESHNESS_DECAY_HOURS)


def cq_score(source: str, received_at: datetime) -> float:
    reliability = SOURCE_RELIABILITY.get(source, SOURCE_RELIABILITY["unknown"])
    return round(reliability * freshness_score(received_at), 4)


def _anomaly_check(packets_last_60s: list[dict]) -> bool:
    """Return True if 20+ social posts arrived in the last 60s — coordinated attack signal."""
    social_count = sum(1 for p in packets_last_60s if p.get("source") in ANOMALY_SOCIAL_SOURCES)
    return social_count >= ANOMALY_POST_THRESHOLD


async def _update_price_buffer(ticker: str, payload: dict) -> None:
    """Push payload onto the Redis price buffer list; keep at most PRICE_BUFFER_BARS entries."""
    key = f"price_buffer:{ticker}"
    r = await redis_client.get_redis()
    await r.lpush(key, json.dumps(payload))
    await r.ltrim(key, 0, PRICE_BUFFER_BARS - 1)


async def normalization_loop() -> None:
    recent: list[tuple[float, dict]] = []  # (unix_ts, raw_packet)

    while True:
        raw = await raw_queue.get()
        now = datetime.now(timezone.utc)

        # Dedup: news keyed by URL, everything else by type+ticker
        payload = raw.get("payload", {})
        dedup_key: str = payload.get("url") or f"{raw['type']}:{raw['ticker']}"
        if dedup_key in _dedup:
            continue
        _dedup.add(dedup_key)
        if len(_dedup) > MAX_DEDUP_SIZE:
            _dedup.clear()

        score = cq_score(raw["source"], now)
        if score < CQ_DROP_THRESHOLD:
            continue

        # Slide the 60-second window and check for coordinated social spike
        cutoff = now.timestamp() - 60
        recent = [(ts, p) for ts, p in recent if ts >= cutoff]
        recent.append((now.timestamp(), raw))
        if _anomaly_check([p for _, p in recent]):
            payload["anomaly_flagged"] = True

        packet = DataPacket(
            id=str(uuid.uuid4()),
            type=raw["type"],
            ticker=raw["ticker"],
            protocol=raw.get("protocol"),
            payload=payload,
            cq_score=score,
            source=raw["source"],
            received_at=now,
        )

        # Maintain rolling price buffer in Redis for Agent 2 / Agent 4
        if packet.type == "price":
            await _update_price_buffer(packet.ticker, packet.payload)

        await normalized_queue.put(packet)
