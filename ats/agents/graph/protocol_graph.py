# Base propagation weights. Negative = connected token moves down when trigger is hit negatively.
# Weight magnitude = how strongly the event propagates.

TIER1_GRAPH: dict[str, dict[str, float]] = {
    "WBTC": {
        "AAVE":   -0.90,
        "COMP":   -0.70,
        "CRV":    -0.65,
        "BADGER": -0.80,
        "REN":    -0.60,
    },
    "USDC": {
        "AAVE":   -1.10,
        "COMP":   -1.00,
        "CRV":    -0.95,
        "FRAX":   -0.85,
        "CRVUSD": -0.90,
    },
    "ETH": {
        "STETH":  -0.90,
        "RETH":   -0.85,
        "WSTETH": -0.90,
        "AAVE":   -0.70,
        "COMP":   -0.65,
    },
    "AAVE": {
        "WBTC":  -0.55,
        "USDC":  -0.50,
        "ETH":   -0.45,
        "STETH": -0.50,
    },
    "CRV": {
        "CVX":    -0.85,
        "CRVUSD": -0.75,
        "FRAX":   -0.60,
    },
}

TIER2_GRAPH: dict[str, dict[str, float]] = {
    "AAVE": {
        "UNI":  -0.30,
        "LINK": -0.35,
    },
    "CRV": {
        "AAVE": -0.40,
        "MKR":  -0.30,
    },
}


def get_tier1(trigger: str) -> dict[str, float]:
    return TIER1_GRAPH.get(trigger.upper(), {})


def get_tier2(trigger: str) -> dict[str, float]:
    return TIER2_GRAPH.get(trigger.upper(), {})
