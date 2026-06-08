from langgraph.graph import StateGraph, END
from ats.orchestrator.nodes import regime_node, signal_and_graph_node, risk_node
from ats.orchestrator.consensus import evaluate_consensus
from ats.orchestrator.receipt_writer import write_receipt
from ats.models.state import AgentState
from ats.data.postgres_client import get_session


async def orchestrator_node(state: AgentState) -> AgentState:
    """Collect votes, apply consensus, write Decision Receipt to Postgres."""
    consensus = evaluate_consensus(state)
    async with get_session() as session:
        receipt_id = await write_receipt(state, consensus, session)
    return state.model_copy(update={
        "consensus": consensus,
        "receipt_id": receipt_id,
    })


_agent6: "Agent6Execution | None" = None


def _get_agent6() -> "Agent6Execution":
    global _agent6
    if _agent6 is None:
        from ats.agents.agent6_execution import Agent6Execution
        _agent6 = Agent6Execution()
    return _agent6


async def execution_node(state: AgentState) -> AgentState:
    """Phase 7 — Agent 6 execution: submit swap, confirm, update portfolio."""
    return await _get_agent6().execute(state)


def build_pipeline() -> StateGraph:
    graph = StateGraph(AgentState)

    graph.add_node("regime", regime_node)
    graph.add_node("signal_and_graph", signal_and_graph_node)
    graph.add_node("risk", risk_node)
    graph.add_node("orchestrator", orchestrator_node)
    graph.add_node("execution", execution_node)

    graph.set_entry_point("regime")
    graph.add_edge("regime", "signal_and_graph")
    graph.add_edge("signal_and_graph", "risk")
    graph.add_edge("risk", "orchestrator")

    graph.add_conditional_edges(
        "orchestrator",
        lambda state: state.consensus,
        {"EXECUTE": "execution", "SKIP": END},
    )
    graph.add_edge("execution", END)

    return graph.compile()
