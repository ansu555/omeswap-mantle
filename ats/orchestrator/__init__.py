from ats.orchestrator.graph import build_pipeline
from ats.models.state import AgentState

_pipeline = build_pipeline()


async def run_pipeline(ticker: str, trigger_event: dict) -> AgentState:
    initial_state = AgentState(
        trigger_ticker=ticker,
        trigger_event=trigger_event,
    )
    result = await _pipeline.ainvoke(initial_state)
    # LangGraph 1.x returns a dict from ainvoke; restore the Pydantic model
    return AgentState(**result) if isinstance(result, dict) else result
