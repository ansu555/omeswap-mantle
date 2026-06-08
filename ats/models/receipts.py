from sqlalchemy import Column, String, Float, JSON, DateTime
from sqlalchemy.orm import DeclarativeBase
from datetime import datetime, timezone


class Base(DeclarativeBase):
    pass


class DecisionReceipt(Base):
    __tablename__ = "decision_receipts"

    id = Column(String, primary_key=True)
    ticker = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    trigger_event = Column(JSON)
    regime = Column(String)
    signal_vote = Column(JSON)
    graph_vote = Column(JSON)
    risk_decision = Column(JSON)
    consensus = Column(String)
    fill_data = Column(JSON, nullable=True)
    pnl = Column(Float, nullable=True)
    closed_at = Column(DateTime, nullable=True)
