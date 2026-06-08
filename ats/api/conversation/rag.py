from sqlalchemy import select, desc
from ats.models.receipts import DecisionReceipt
from ats.data.postgres_client import get_session


async def fetch_receipt_context(ticker: str | None = None, limit: int = 10) -> str:
    """
    Fetches the most recent Decision Receipts and formats them as plain text
    for injection into Claude's system prompt.
    """
    async with get_session() as session:
        query = (
            select(DecisionReceipt)
            .order_by(desc(DecisionReceipt.created_at))
            .limit(limit)
        )
        if ticker:
            query = query.where(DecisionReceipt.ticker == ticker.upper())
        result = await session.execute(query)
        receipts = result.scalars().all()

    lines = ["=== Recent Decision Receipts ===\n"]
    for r in receipts:
        lines.append(f"Receipt {r.id} | {r.ticker} | {r.created_at.isoformat()}")
        lines.append(f"  Regime: {r.regime} | Consensus: {r.consensus}")
        if r.signal_vote:
            sv = r.signal_vote
            lines.append(
                f"  Signal: {sv.get('direction')} @ confidence {sv.get('confidence')}"
            )
        if r.risk_decision:
            rd = r.risk_decision
            if rd.get("approved"):
                lines.append(
                    f"  Risk: APPROVED — {rd.get('shares')} tokens @ ${rd.get('size_usd')}"
                )
                lines.append(
                    f"  Stop: ${rd.get('stop_loss_price')} | TP: ${rd.get('take_profit_price')}"
                )
            else:
                lines.append(f"  Risk: VETOED — {rd.get('veto_code')}")
        if r.fill_data:
            fd = r.fill_data
            lines.append(
                f"  Fill: {fd.get('avg_price')} | Slippage: {fd.get('slippage', 0):.4f}"
            )
        lines.append("")

    return "\n".join(lines)
