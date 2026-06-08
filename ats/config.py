from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Binance (Agent 1 + Agent 6)
    binance_api_key: str = ""
    binance_secret: str = ""

    # Data sources
    news_api_key: str = ""
    coingecko_api_key: str = ""
    the_graph_api_key: str = ""
    defillama_base_url: str = "https://api.llama.fi"

    # Agent model — any litellm-supported model string + its key
    # e.g. "claude-sonnet-4-6", "gpt-4o", "gemini/gemini-pro"
    # For 0G Compute sealed inference use: "zerog/qwen3.6-plus" or "zerog/GLM-5-FP8"
    agent_model: str = "claude-sonnet-4-6"
    agent_api_key: str = ""

    # Anthropic API key for the Conversation Layer (Phase 8 chat endpoint).
    # Falls back to agent_api_key when unset.
    anthropic_api_key: str = ""

    # Supabase (DB + service-role key reused from Next.js app)
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    database_url: str = ""          # postgresql+asyncpg://... from Supabase dashboard
    database_ssl: bool = True       # Supabase always requires SSL

    # Agent smart account — dedicated on-chain execution wallet
    # Private key of the wallet agents use to sign 0G Chain transactions
    # Set this from the portfolio page; never hardcode or log
    agent_wallet_private_key: str = ""

    # 0G Chain — Newton Testnet (chainId 16600)
    rpc_url: str = "https://evmrpc-testnet.0g.ai"

    # DEX routers — 0G native DEX (replace with live addresses once deployed)
    dex_router_address: str = "0x0000000000000000000000000000000000000010"
    dex_router_v1_address: str = "0x0000000000000000000000000000000000000011"

    # Slippage tolerance in basis points (50 = 0.5%)
    dex_slippage_bps: int = 50

    # Redis (local — only infra we self-host)
    redis_url: str = "redis://localhost:6379"

    # ── 0G Storage (persistent agent memory) ─────────────────────────────────
    # Storage Indexer: content-addressed blob upload/download
    zerog_storage_rpc: str = "https://indexer-storage-testnet-standard.0g.ai"
    # Private key of the 0G wallet used to pay for storage submissions
    zerog_storage_private_key: str = ""

    # ── 0G Compute (decentralized AI inference) ───────────────────────────────
    # Models: qwen3-8b (fast), qwen3.6-plus (sealed), GLM-5-FP8 (accurate)
    zerog_compute_endpoint: str = "https://compute-api.0g.ai/v1"
    zerog_compute_api_key: str = ""
    # Default inference model; override per-agent as needed
    zerog_compute_model: str = "qwen3-8b"
    # Use sealed (ZK-verified) inference for decision-critical agent calls
    zerog_compute_sealed: bool = False

    # ── 0G DA (data availability for high-volume outputs) ─────────────────────
    zerog_da_rpc: str = "https://da-client-testnet.0g.ai"

    # Trading universe
    crypto_tickers: list[str] = ["BTCUSDT", "ETHUSDT", "WBTCUSDT"]
    defi_protocols: list[str] = ["aave", "compound", "curve", "badger"]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
