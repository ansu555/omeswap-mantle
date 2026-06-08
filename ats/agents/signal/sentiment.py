"""
FinBERT sentiment sub-module.

Model is loaded once at import time (~440 MB on first run, then cached by HuggingFace).
Headlines are buffered per ticker; inference runs in batches of up to MAX_BATCH.

CQ-weighted scoring: each headline's directional score is multiplied by its
data-quality score so high-reliability sources (Bloomberg 0.93, Reuters 0.91)
have more influence than Reddit (0.55).
"""
from __future__ import annotations

from collections import defaultdict

from transformers import pipeline

from ats.models.packets import DataPacket

_finbert = None  # lazy-loaded on first inference call

def _get_finbert():
    global _finbert
    if _finbert is None:
        _finbert = pipeline(
            "text-classification",
            model="ProsusAI/finbert",
            top_k=None,
            device=-1,
        )
    return _finbert

LABEL_SCORE: dict[str, float] = {
    "positive": 1.0,
    "negative": -1.0,
    "neutral":  0.0,
}

MAX_BATCH = 10

# {ticker: [(text, cq_score), ...]}
_headline_buffer: dict[str, list[tuple[str, float]]] = defaultdict(list)


def buffer_headline(packet: DataPacket) -> None:
    """Append a news packet's text to the per-ticker buffer."""
    title = packet.payload.get("title", "")
    desc = packet.payload.get("description", "")
    text = f"{title} {desc}".strip()
    if text:
        _headline_buffer[packet.ticker].append((text, packet.cq_score))


def compute_sentiment(ticker: str) -> float | None:
    """
    Run FinBERT over buffered headlines for `ticker`.

    Returns a CQ-weighted average sentiment in [-1.0, +1.0], or None if the
    buffer is empty (no news available for this ticker right now).
    """
    batch = _headline_buffer.pop(ticker, [])
    if not batch:
        return None

    texts   = [t for t, _ in batch[:MAX_BATCH]]
    weights = [w for _, w in batch[:MAX_BATCH]]

    results = _get_finbert()(texts)   # list[list[{label, score}]]

    weighted_scores: list[float] = []
    for result_list, weight in zip(results, weights):
        top = max(result_list, key=lambda x: x["score"])
        direction = LABEL_SCORE[top["label"]]
        weighted_scores.append(direction * top["score"] * weight)

    total_weight = sum(weights)
    return sum(weighted_scores) / total_weight if total_weight else None


def buffer_size(ticker: str) -> int:
    """Return how many headlines are queued for a ticker (useful for logging/tests)."""
    return len(_headline_buffer.get(ticker, []))
