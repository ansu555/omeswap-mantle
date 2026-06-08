from ats.models.state import AgentState
from ats.data.redis_client import get_json
from ats.agents.agent3_graph import Agent3Graph
from ats.agents.agent5_risk import Agent5Risk

_agent3 = Agent3Graph()
_agent5 = Agent5Risk()


async def regime_node(state: AgentState) -> AgentState:
    """Read current regime from Redis — set up to 15 min ago by Agent4."""
    data = await get_json("regime:current")
    if data:
        state = state.model_copy(update={
            "regime": data["regime"],
            "regime_confidence": data["confidence"],
        })
    else:
        state = state.model_copy(update={
            "regime": "choppy",
            "regime_confidence": 0.50,
        })
    return state


async def signal_and_graph_node(state: AgentState) -> AgentState:
    """Run Agent2 (Signal) and Agent3 (Graph) using the current regime."""
    from ats.models.packets import DataPacket
    from datetime import datetime, timezone
    from ats.agents.signal.sentiment import compute_sentiment
    from ats.agents.signal.technicals import compute_technical_signal
    from ats.agents.signal.combiner import combine

    trigger_packet = DataPacket(
        type="onchain_event",
        ticker=state.trigger_ticker,
        payload=state.trigger_event,
        cq_score=state.trigger_event.get("cq_score", 0.80),
        source=state.trigger_event.get("source", "unknown"),
        received_at=datetime.now(timezone.utc),
    )

    sentiment = compute_sentiment(state.trigger_ticker)
    technical = await compute_technical_signal(state.trigger_ticker, state.regime)
    signal_vote = combine(
        state.trigger_ticker, sentiment, technical,
        state.regime, state.regime_confidence,
    )

    graph_vote = await _agent3.analyze(trigger_packet, sentiment or 0.0)

    return state.model_copy(update={
        "signal_vote": signal_vote,
        "graph_vote": graph_vote,
    })


async def risk_node(state: AgentState) -> AgentState:
    """Agent5 evaluates after both Signal and Graph complete (fan-in)."""
    risk_decision = await _agent5.evaluate(state)
    return state.model_copy(update={"risk_decision": risk_decision})
