from dataclasses import dataclass
from ats.data.redis_client import get_json


@dataclass
class PortfolioState:
    total_value_usd: float
    cash_usd: float
    daily_drawdown_pct: float
    protocol_category_weights: dict[str, float]
    open_positions: list[dict]


async def read_portfolio() -> PortfolioState:
    data = await get_json("portfolio:state")
    if data is None:
        return PortfolioState(
            total_value_usd=10_000.0,
            cash_usd=10_000.0,
            daily_drawdown_pct=0.0,
            protocol_category_weights={},
            open_positions=[],
        )
    return PortfolioState(**data)
