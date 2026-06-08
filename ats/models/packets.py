from pydantic import BaseModel, Field
from typing import Literal, Any
from datetime import datetime, timezone
import uuid

PacketType = Literal["price", "news", "onchain_event", "sentiment", "macro"]


class DataPacket(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: PacketType
    ticker: str
    protocol: str | None = None
    payload: dict[str, Any]
    cq_score: float
    received_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    source: str
