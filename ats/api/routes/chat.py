from fastapi import APIRouter
from pydantic import BaseModel
import anthropic
from ats.api.conversation.rag import fetch_receipt_context
from ats.config import settings

router = APIRouter(prefix="/api/chat", tags=["chat"])

_client: anthropic.AsyncAnthropic | None = None


def _get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        api_key = settings.anthropic_api_key or settings.agent_api_key
        _client = anthropic.AsyncAnthropic(api_key=api_key)
    return _client


SYSTEM_PROMPT = """You are the ATS (Agentic Trading System) Conversation Layer.
You explain trading decisions made by the system's six AI agents.
Always base your answers on the Decision Receipts provided below.
Do not speculate about trades not in the receipts. Be concise and factual.
If you don't have enough receipt data to answer, say so clearly.

{receipt_context}"""


class ChatRequest(BaseModel):
    message: str
    ticker: str | None = None


@router.post("")
async def chat(body: ChatRequest):
    context = await fetch_receipt_context(ticker=body.ticker, limit=10)
    system = SYSTEM_PROMPT.format(receipt_context=context)

    response = await _get_client().messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=system,
        messages=[{"role": "user", "content": body.message}],
    )
    return {"response": response.content[0].text}
