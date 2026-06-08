from ats.agents.graph.propagator import (
    build_graph_vote,
    compute_impact_scores,
    queue_secondary_tokens,
)
from ats.data.redis_client import set_json
from ats.models.packets import DataPacket
from ats.models.state import GraphVote


class Agent3Graph:
    async def analyze(self, packet: DataPacket, sentiment_score: float) -> GraphVote:
        impact_scores = compute_impact_scores(packet.ticker, sentiment_score)
        vote = build_graph_vote(packet.ticker, sentiment_score, impact_scores)

        if impact_scores:
            await queue_secondary_tokens(impact_scores, packet)

        await set_json(f"graph:latest:{packet.ticker}", {
            "direction": vote.direction,
            "impact_scores": vote.impact_scores,
            "propagation_count": vote.propagation_count,
        })

        return vote
