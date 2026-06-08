from ats.models.state import AgentState, Consensus

HIGH_CONFIDENCE_THRESHOLD = 0.75
MIN_CONFIDENCE_THRESHOLD  = 0.60


def evaluate_consensus(state: AgentState) -> Consensus:
    risk = state.risk_decision
    signal = state.signal_vote

    # Risk veto is absolute — no override possible
    if not risk or not risk.approved:
        return "SKIP"

    if not signal or signal.direction == "NEUTRAL":
        return "SKIP"

    if signal.confidence >= HIGH_CONFIDENCE_THRESHOLD:
        return "EXECUTE"

    if signal.confidence >= MIN_CONFIDENCE_THRESHOLD:
        # Could escalate to assisted mode — for now SKIP
        return "SKIP"

    return "SKIP"
