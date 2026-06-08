import redis.asyncio as aioredis
import json
from ats.config import settings

_redis: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis


async def set_json(key: str, value: dict) -> None:
    r = await get_redis()
    await r.set(key, json.dumps(value))


async def get_json(key: str) -> dict | None:
    r = await get_redis()
    raw = await r.get(key)
    return json.loads(raw) if raw else None


async def set_float(key: str, value: float) -> None:
    r = await get_redis()
    await r.set(key, str(value))


async def get_float(key: str) -> float | None:
    r = await get_redis()
    raw = await r.get(key)
    return float(raw) if raw else None
