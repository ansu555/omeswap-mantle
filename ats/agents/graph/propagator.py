from datetime import datetime, timezone

from ats.agents.graph.protocol_graph import get_tier1, get_tier2
from ats.data.queue import normalized_queue
from ats.models.packets import DataPacket
from ats.models.state import Direction, GraphVote

IMPACT_THRESHOLD = 0.20
TIER2_DISCOUNT   = 0.50


def compute_impact_scores(
    trigger_ticker: str,
    sentiment_score: float,
) -> dict[str, float]:
    scores: dict[str, float] = {}

    for token, weight in get_tier1(trigger_ticker).items():
        impact = sentiment_score * weight
        if abs(impact) >= IMPACT_THRESHOLD:
            scores[token] = round(impact, 4)

    for token, weight in get_tier2(trigger_ticker).items():
        impact = sentiment_score * weight * TIER2_DISCOUNT
        if abs(impact) >= IMPACT_THRESHOLD and token not in scores:
            scores[token] = round(impact, 4)

    return scores


def build_graph_vote(
    trigger_ticker: str,
    sentiment_score: float,
    impact_scores: dict[str, float],
) -> GraphVote:
    direction: Direction = (
        "SHORT" if sentiment_score < -0.25
        else "LONG" if sentiment_score > 0.25
        else "NEUTRAL"
    )
    return GraphVote(
        direction=direction,
        impact_scores=impact_scores,
        propagation_count=len(impact_scores),
    )


async def queue_secondary_tokens(
    impact_scores: dict[str, float],
    source_event: DataPacket,
) -> None:
    for token, impact in impact_scores.items():
        synthetic = DataPacket(
            type="onchain_event",
            ticker=token,
            protocol=source_event.protocol,
            payload={
                "event_type": "graph_propagation",
                "trigger": source_event.ticker,
                "impact_score": impact,
                "source_event": source_event.payload.get("event_type", "unknown"),
            },
            cq_score=source_event.cq_score * 0.85,
            source="graph_agent",
            received_at=datetime.now(timezone.utc),
        )
        await normalized_queue.put(synthetic)
