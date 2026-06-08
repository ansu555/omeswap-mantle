from ats.agents.risk.kelly import (
    kelly_fraction,
    apply_multipliers,
    compute_stop_loss,
    compute_take_profit,
    MIN_POSITION_USD,
)
from ats.agents.risk.portfolio_reader import read_portfolio
from ats.data.redis_client import get_json, get_float
from ats.models.state import AgentState, RiskDecision

# Hard limits — not user-configurable
DAILY_DRAWDOWN_HALT  = 0.05   # 5% daily loss triggers full halt
MIN_CONFIDENCE       = 0.60
MAX_CATEGORY_WEIGHT  = 0.20   # 20% per protocol category
MAX_RISK_PER_TRADE   = 0.02   # 2% of portfolio per trade

PROTOCOL_CATEGORIES: dict[str, str] = {
    "AAVE":  "defi_lending",
    "COMP":  "defi_lending",
    "WBTC":  "wrapped_btc",
    "CRV":   "defi_dex",
    "CVX":   "defi_dex",
    "ETH":   "layer1",
    "BTC":   "layer1",
    "STETH": "liquid_staking",
    "RETH":  "liquid_staking",
    "USDC":  "stablecoin",
}

# Regimes where LONG trades are blocked
BEAR_REGIMES = {"bear", "high_vol_bear", "crisis"}


class Agent5Risk:
    async def evaluate(self, state: AgentState) -> RiskDecision:
        portfolio = await read_portfolio()
        btc_vol   = await get_float("market:btc_vol") or 0.30
        price     = await get_float(f"price:{state.trigger_ticker}") or 0.0
        regime    = state.regime or "choppy"
        signal    = state.signal_vote

        def veto(code: str) -> RiskDecision:
            return RiskDecision(
                approved=False,
                veto_code=code,
                btc_vol_at_decision=btc_vol,
                regime_at_decision=regime,
            )

        # Rule 1 — Crisis mode: hard halt, no exceptions
        if regime == "crisis":
            return veto("crisis_mode_active")

        # Rule 2 — Daily drawdown circuit breaker
        if portfolio.daily_drawdown_pct >= DAILY_DRAWDOWN_HALT:
            return veto("daily_drawdown_limit")

        # Rule 3 — Signal confidence must clear minimum threshold
        if not signal or signal.confidence < MIN_CONFIDENCE:
            return veto("confidence_too_low")

        # Rule 4 — Direction must not conflict with regime
        if signal.direction == "LONG" and regime in BEAR_REGIMES:
            return veto("direction_regime_conflict")

        # Rule 5 — Protocol category concentration check
        category = PROTOCOL_CATEGORIES.get(state.trigger_ticker.upper(), "other")
        current_weight = portfolio.protocol_category_weights.get(category, 0.0)
        if current_weight >= MAX_CATEGORY_WEIGHT:
            return veto("category_limit_reached")

        # Rule 6 — Kelly sizing
        REWARD_RISK = 2.0
        f_star = kelly_fraction(signal.confidence, REWARD_RISK)

        # Rules 7 & 8 — BTC vol and regime multipliers applied inside apply_multipliers
        position_pct = apply_multipliers(f_star, btc_vol, regime)
        position_usd = portfolio.total_value_usd * position_pct

        # Rule 6 continued — minimum position size check
        if position_usd < MIN_POSITION_USD:
            return veto("position_too_small")

        # Rule 9 — Max risk per trade (2% of portfolio)
        # stop is 2% → position can be at most total_value * MAX_RISK / stop_pct
        max_position_usd = portfolio.total_value_usd * MAX_RISK_PER_TRADE / 0.02
        if position_usd > max_position_usd:
            position_usd = max_position_usd
            position_pct = position_usd / portfolio.total_value_usd

        # Rule 10 — Zero shares guard
        if price <= 0:
            return veto("price_unavailable")
        token_amount = position_usd / price
        if token_amount <= 0:
            return veto("zero_shares_after_sizing")

        return RiskDecision(
            approved=True,
            shares=round(token_amount, 6),
            size_usd=round(position_usd, 2),
            position_pct=round(position_pct, 4),
            stop_loss_price=compute_stop_loss(price, signal.direction),
            take_profit_price=compute_take_profit(price, signal.direction, REWARD_RISK),
            btc_vol_at_decision=btc_vol,
            regime_at_decision=regime,
        )
