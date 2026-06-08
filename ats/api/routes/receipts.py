from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from ats.models.receipts import DecisionReceipt
from ats.data.postgres_client import get_session

router = APIRouter(prefix="/api/receipts", tags=["receipts"])


@router.get("/{receipt_id}")
async def get_receipt(receipt_id: str):
    async with get_session() as session:
        result = await session.execute(
            select(DecisionReceipt).where(DecisionReceipt.id == receipt_id)
        )
        receipt = result.scalar_one_or_none()
        if receipt is None:
            raise HTTPException(status_code=404, detail="Receipt not found")
        return {
            "id": receipt.id,
            "ticker": receipt.ticker,
            "created_at": receipt.created_at.isoformat(),
            "regime": receipt.regime,
            "consensus": receipt.consensus,
            "signal_vote": receipt.signal_vote,
            "graph_vote": receipt.graph_vote,
            "risk_decision": receipt.risk_decision,
            "fill_data": receipt.fill_data,
            "pnl": receipt.pnl,
        }
