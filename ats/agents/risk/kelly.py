MAX_POSITION_PCT = 0.08       # hard cap — 8% regardless of Kelly output
KELLY_FRACTION   = 0.25       # quarter-Kelly conservatism
BTC_VOL_THRESHOLD = 0.35      # 35% annualized vol triggers 50% size cut
BTC_VOL_MULTIPLIER = 0.50
MIN_POSITION_USD = 50.0


def kelly_fraction(win_prob: float, reward_risk_ratio: float) -> float:
    """f* = (p*b - q) / b, scaled to quarter-Kelly."""
    p = win_prob
    q = 1 - p
    b = reward_risk_ratio
    f_star = (p * b - q) / b
    return max(0.0, f_star * KELLY_FRACTION)


def apply_multipliers(
    base_fraction: float,
    btc_vol: float,
    regime: str,
) -> float:
    REGIME_MULTIPLIERS = {
        "low_vol_bull":  1.00,
        "high_vol_bull": 0.70,
        "choppy":        0.50,
        "bear":          0.40,
        "high_vol_bear": 0.20,
        "crisis":        0.00,
    }
    fraction = base_fraction
    if btc_vol > BTC_VOL_THRESHOLD:
        fraction *= BTC_VOL_MULTIPLIER
    fraction *= REGIME_MULTIPLIERS.get(regime, 0.50)
    return min(fraction, MAX_POSITION_PCT)


def compute_stop_loss(entry_price: float, direction: str, stop_pct: float = 0.02) -> float:
    if direction == "LONG":
        return round(entry_price * (1 - stop_pct), 6)
    return round(entry_price * (1 + stop_pct), 6)


def compute_take_profit(
    entry_price: float,
    direction: str,
    reward_risk: float = 2.0,
    stop_pct: float = 0.02,
) -> float:
    target_pct = stop_pct * reward_risk
    if direction == "LONG":
        return round(entry_price * (1 + target_pct), 6)
    return round(entry_price * (1 - target_pct), 6)
