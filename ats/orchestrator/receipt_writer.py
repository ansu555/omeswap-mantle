import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from ats.models.receipts import DecisionReceipt
from ats.models.state import AgentState, Consensus


async def write_receipt(
    state: AgentState,
    consensus: Consensus,
    session: AsyncSession,
) -> str:
    receipt_id = str(uuid.uuid4())
    receipt = DecisionReceipt(
        id=receipt_id,
        ticker=state.trigger_ticker,
        created_at=datetime.now(timezone.utc),
        trigger_event=state.trigger_event,
        regime=state.regime,
        signal_vote=state.signal_vote.model_dump() if state.signal_vote else None,
        graph_vote=state.graph_vote.model_dump() if state.graph_vote else None,
        risk_decision=state.risk_decision.model_dump() if state.risk_decision else None,
        consensus=consensus,
        fill_data=None,
        pnl=None,
    )
    session.add(receipt)
    await session.commit()
    return receipt_id
