# Omeswap Realtime Service

Standalone Node service that gives Omeswap **true real-time** market data on
Mantle. It holds one WebSocket subscription to the chain, keeps in-memory pool
state, and (once fully built) broadcasts price/reserves/trades to the frontend
and serves swap-route quotes.

> Why this exists: CoinGecko/Kryll are ~5 min stale and DEX scanners are
> 20-30s. On-chain data only changes when a swap lands in a block, so the real
> ceiling is Mantle block time (~1-2s). This service hits that ceiling by
> subscribing (`eth_subscribe`) instead of polling.

## Run

```bash
cd realtime-service
cp .env.example .env       # adjust RPC/WSS if using Alchemy/QuickNode
npm install
npm run dev                # tsx watch — Milestone 1: logs live prices
```

You should see discovered FusionX V3 pools and a `[swap] …` line each time a
trade lands on a tracked pool (within ~1-2s of the block).

## Layout

| File | Role |
|------|------|
| `src/config.ts` | Mantle RPC/WSS, tokens, FusionX V3 factory/quoter. Mirrors `lib/chain-registry/chains/mantle.ts` — keep in sync. |
| `src/chain.ts` | viem clients: pure WS (subscriptions) + HTTP (multicall reads). |
| `src/abis.ts` | Minimal V3 factory/pool/quoter + ERC-20 ABIs. |
| `src/pool-registry.ts` | Discover pools for `{tokens × tokens}` across fee tiers; seed state. |
| `src/price-math.ts` | `sqrtPriceX96` → human price. |
| `src/price-state.ts` | In-memory `Map<pool, PoolState>` — source of truth. |
| `src/subscriber.ts` | One `eth_subscribe(logs)` for Swap; decode → update → emit. |
| `src/index.ts` | Bootstrap. |

## Roadmap

- **M1 (done)** — discover + subscribe + log prices (validate pipeline).
- **M2** — USD price engine, own WS broadcast server; frontend `lib/realtime/client.ts`.
- **M3** — REST `/price`, `/pools`, `/route`; wire `use-dex-aggregator` + price UI (with fallback).
- **M4** — reconnect/resync, Dockerfile, health checks, deploy.

## Deploy

Host-agnostic: any always-on Node host (Railway / Fly.io / Render / VPS). **Not**
Vercel serverless — it needs a persistent process for the WS subscription.
