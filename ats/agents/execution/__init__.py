"""Phase 7 — Execution sub-package.

Modules:
    dex_client       — web3.py wrapper for the 0G DEX router
    order_router     — strategy selector (single swap / TWAP)
    fill_monitor     — polls chain for tx receipt confirmation
    portfolio_updater— writes fill data to Redis + Postgres
    stop_loss_monitor— background loop that exits positions on SL breach
"""
