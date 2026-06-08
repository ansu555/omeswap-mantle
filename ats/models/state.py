from pydantic import BaseModel
from typing import Literal, Any

Direction = Literal["LONG", "SHORT", "NEUTRAL"]
Regime = Literal["low_vol_bull", "high_vol_bull", "choppy", "bear", "high_vol_bear", "crisis"]
Consensus = Literal["EXECUTE", "SKIP"]


class SignalVote(BaseModel):
    direction: Direction
    confidence: float
    sentiment_score: float
    technical_signal: Direction
    regime_used: Regime


class GraphVote(BaseModel):
    direction: Direction
    impact_scores: dict[str, float]
    propagation_count: int


class RiskDecision(BaseModel):
    approved: bool
    veto_code: str | None = None
    shares: float | None = None
    size_usd: float | None = None
    position_pct: float | None = None
    stop_loss_price: float | None = None
    take_profit_price: float | None = None
    btc_vol_at_decision: float | None = None
    regime_at_decision: Regime | None = None


class AgentState(BaseModel):
    trigger_ticker: str
    trigger_event: dict[str, Any]
    regime: Regime | None = None
    regime_confidence: float | None = None
    signal_vote: SignalVote | None = None
    graph_vote: GraphVote | None = None
    risk_decision: RiskDecision | None = None
    consensus: Consensus | None = None
    receipt_id: str | None = None
