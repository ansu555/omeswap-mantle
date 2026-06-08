from fastapi import APIRouter
from pydantic import BaseModel
from ats.orchestrator import run_pipeline
from ats.api.ws_manager import ws_manager

router = APIRouter(prefix="/api/activations", tags=["activations"])


class TriggerRequest(BaseModel):
    ticker: str
    event_type: str = "manual"
    event_payload: dict = {}


@router.post("/{activation_id}/execute")
async def execute_activation(activation_id: str, body: TriggerRequest):
    final_state = await run_pipeline(
        ticker=body.ticker,
        trigger_event={"event_type": body.event_type, **body.event_payload},
    )

    await ws_manager.broadcast({
        "type": "pipeline_complete",
        "activation_id": activation_id,
        "ticker": body.ticker,
        "consensus": final_state.consensus,
        "receipt_id": final_state.receipt_id,
        "signal": final_state.signal_vote.model_dump() if final_state.signal_vote else None,
        "risk": final_state.risk_decision.model_dump() if final_state.risk_decision else None,
    })

    return {
        "receipt_id": final_state.receipt_id,
        "consensus": final_state.consensus,
        "regime": final_state.regime,
    }
