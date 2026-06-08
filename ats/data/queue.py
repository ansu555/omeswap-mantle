import asyncio
from ats.models.packets import DataPacket

raw_queue: asyncio.Queue[dict] = asyncio.Queue(maxsize=10_000)
normalized_queue: asyncio.Queue[DataPacket] = asyncio.Queue(maxsize=10_000)
