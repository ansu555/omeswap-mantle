"""
Signal combiner — merges sentiment + technicals into a final directional vote.

Both sub-modules must independently agree on direction for a non-NEUTRAL signal.
Any disagreement → NEUTRAL. This prevents false signals from a single noisy source.

Confidence formula when both agree:
    (normalized_sentiment_strength + regime_confidence) / 2

When only technicals are available (no news):
    reduced confidence cap of 0.55
"""
from __future__ import annotations

from ats.models.state import Direction, Regime, SignalVote

SENTIMENT_LONG_THRESHOLD  =  0.25
SENTIMENT_SHORT_THRESHOLD = -0.25


def combine(
    ticker: str,
    sentiment_score: float | None,
    technical_signal: Direction,
    regime: Regime,
    regime_confidence: float,
) -> SignalVote:
    """
    Produce a SignalVote from the two sub-module outputs.

    Args:
        ticker:            the asset being analysed (informational, not used in logic)
        sentiment_score:   CQ-weighted FinBERT score in [-1, 1], or None if no news
        technical_signal:  LONG / SHORT / NEUTRAL from technicals module
        regime:            current HMM regime label
        regime_confidence: confidence value from regime:current [0, 1]

    Returns:
        SignalVote with direction, confidence, and raw sub-module outputs attached.
    """
    if sentiment_score is None:
        # Technical-only path — lower confidence cap
        direction: Direction = technical_signal
        confidence = 0.55 if technical_signal != "NEUTRAL" else 0.0
    else:
        sentiment_direction: Direction = (
            "LONG"  if sentiment_score >= SENTIMENT_LONG_THRESHOLD
            else "SHORT" if sentiment_score <= SENTIMENT_SHORT_THRESHOLD
            else "NEUTRAL"
        )

        if sentiment_direction == technical_signal and sentiment_direction != "NEUTRAL":
            direction = sentiment_direction
            sentiment_strength = min(abs(sentiment_score), 1.0)
            confidence = round((sentiment_strength + regime_confidence) / 2, 3)
        else:
            direction  = "NEUTRAL"
            confidence = 0.0

    return SignalVote(
        direction=direction,
        confidence=confidence,
        sentiment_score=sentiment_score if sentiment_score is not None else 0.0,
        technical_signal=technical_signal,
        regime_used=regime,
    )
