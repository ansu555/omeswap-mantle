# Plan: Real-Time On-Chain Data Service for Mantle

## Context

**Why this change.** Omeswap is porting from 0G to Mantle and needs *truly* real-time market data — price, pool reserves, trades, and swap quotes that update within ~1 second, automatically pushed to the frontend. The current architecture cannot do this and, worse, shows the wrong price:

- **Token USD price** comes from CoinGecko/Kryll/CMC via `/api/crypto` with `revalidate: 300` → **5 minutes stale**.
- **Chart candles** stream from Binance WebSocket — real-time, but a **CEX reference price, not the pool's executable price**.
- **Pool reserves** (`lib/terminal/data/poolReserves.ts` → `pollPoolReserves`) poll every **6s**.
- **Swaps feed** (`watchPoolSwaps` via viem `watchEvent`) is **not a true subscription** — `wallet-provider.tsx` wires wagmi with `http()` only, so it falls back to HTTP polling.
- **Quotes** (`hooks/use-dex-aggregator.tsx`) do **sequential per-path on-chain `getAmountsOut` reads** in the browser per keystroke.

**The hard ceiling (accepted):** on-chain pool data only changes when a swap lands in a block, so "real-time" = "pushed the instant a block arrives" ≈ Mantle block time (~1–2s). That meets the "every second" goal; nothing confirmed can be faster.

**Intended outcome.** A single, always-on Node service that holds **one** WebSocket subscription to Mantle, maintains in-memory pool state + a pool graph, and (a) broadcasts price/reserves/trades to all frontend clients over its own WebSocket and (b) serves multi-hop swap quotes over REST. It becomes the one source of truth for anything "real-time" on the platform, and replaces both the 5-min CoinGecko price and the misleading Binance reference with the pool's actual executable price.

**Decisions locked:** dedicated service; all three surfaces (terminal pool data + executable price + routing) in milestone one; host-agnostic deploy (Node process + Dockerfile, no Vercel serverless).

---

## Part A — The Service (new standalone folder `realtime-service/`)

Separate process, its own `package.json` (like `avax-agent/`), **not bundled into the Next build**. Stack: Node + TypeScript + `viem` (WebSocket transport) + `ws` + a tiny HTTP layer (`hono` or raw `http`).

```
realtime-service/
  src/
    config.ts          # Mantle RPC/WSS, factory addresses, token + hub list (mirrors lib/chain-registry/chains/mantle.ts)
    chain.ts           # viem publicClient with webSocket(MANTLE_WSS) transport + http fallback
    pool-registry.ts   # discover pool addresses for {registry tokens × hub tokens} via factory getPool/getPair
    price-state.ts     # in-memory Map<poolAddr, PoolState{reserves|slot0, token0/1, fee, updatedAt}>
    price-engine.ts    # derive USD price per token by pathing to a stable hub (token→WMNT→USDC)
    subscriber.ts      # eth_subscribe: newHeads + Swap logs filtered to known pools → decode → update state → emit
    router.ts          # in-memory graph; BFS/Dijkstra best amountOut (V2 const-product math; V3 via on-chain quoter fallback)
    ws-server.ts       # own WS server: clients subscribe to symbols/pairs; push {price, reserves, trade} deltas
    rest.ts            # GET /price, GET /pools, GET /route, GET /health
    index.ts           # bootstrap: registry → multicall initial state → subscribe → start ws+rest
  Dockerfile
  package.json
  tsconfig.json
  .env.example         # MANTLE_RPC, MANTLE_WSS, optional ALCHEMY/QUICKNODE key
```

**Bootstrap flow (`index.ts`):**
1. `pool-registry.ts`: for each pair in `{tokens × hubTokens}`, call each DEX factory's `getPool`/`getPair` → collect live pool addresses. Scope to the registry token set (not all Mantle pools) to keep state bounded.
2. Multicall initial reserves/`slot0` → seed `price-state`.
3. `subscriber.ts`: open one WS, `eth_subscribe(newHeads)` + `eth_subscribe(logs, { address: knownPools, topics: [Swap] })`.
4. On Swap log → decode (V2: `amount0In/Out…`; V3: `sqrtPriceX96`) → update `price-state` → `price-engine` recomputes USD → `ws-server` broadcasts delta + `router` graph edge updated.
5. Start `ws-server` and `rest`.

**Resilience:** auto-reconnect with backoff in `subscriber.ts` (mirror the open/close/error pattern in `lib/terminal/data/binanceStream.ts`); on reconnect, re-multicall to resync. Single-point-of-failure mitigated by frontend fallback (Part B keeps the existing pollers as backup).

**Mantle specifics to confirm at build time:** chainId 5000 (mainnet) / 5003 (Sepolia); WSS endpoint (`wss://wss.mantle.xyz` or Alchemy/QuickNode); DEXes — Agni (UniV3 fork), FusionX (V2+V3), Merchant Moe (LB). MVP routing supports V2 const-product math natively + falls back to an on-chain V3 quoter read for V3 pools (do **not** promise full V3 tick math in MVP).

---

## Part B — Frontend Integration (existing app)

**1. Chain registry — add Mantle.** New `lib/chain-registry/chains/mantle.ts` exporting a `ChainConfig` (copy the `zerog.ts` shape: viem `defineChain` with `http` **and** `webSocket` in `rpcUrls`, `hubTokens`, `tokens`, `dexRouters`). Register it in `lib/chain-registry/index.ts` `REGISTRY`. This is also the single source the service's `config.ts` mirrors — keep them in sync.

**2. Real-time client.** New `lib/realtime/client.ts` — a singleton that connects to the service WS, auto-reconnects, and exposes `subscribe(symbol|pair, handler)`. Pattern after `lib/terminal/data/binanceStream.ts`.

**3. Wire into the terminal store.** The client dispatches into the existing `store/chart.ts`:
   - Swap delta → `pushTrade()` (TradesTile, already consumes this).
   - Reserves delta → `setReserves()` (DepthTile, already consumes this).
   - In `components/terminal/hooks/useChartData.ts` / `lib/terminal/data/poolReserves.ts`: prefer the realtime feed; **keep `pollPoolReserves` as a fallback** if the WS drops.

**4. Executable price platform-wide.** Replace the 5-min source: have the realtime client push live price into the price consumers, and add a thin `/api/realtime/price` Next route that proxies the service for SSR/first-paint. Trade UI, watchlist (`store/terminal.ts`), and InfoTile read this instead of `/api/crypto` for live ticks (`/api/crypto` stays for the broad market list).

**5. Routing via the service.** In `hooks/use-dex-aggregator.tsx`, add a path that fetches `GET /route?tokenIn&tokenOut&amountIn` from the service (instant, from the in-memory graph) instead of sequential per-path on-chain `getAmountsOut`. **Keep the current on-chain read as fallback** when the service is unreachable.

**6. (Optional, cheap latency win) WS transport.** In `components/providers/wallet-provider.tsx`, the wagmi transport is `http()` only while the registry already defines a WSS URL. Not required once the service exists, but flipping to `webSocket()` (with http fallback) makes any remaining client-side `watchEvent` calls true subscriptions.

---

## Milestones

1. **Service skeleton + one pool live.** `realtime-service/` boots, subscribes to Mantle WSS, decodes Swap events for **one** pool, logs price to console. Validates the pipeline against Mantle mainnet.
2. **Full state + own WS broadcast.** Pool registry discovery, in-memory state for all registry pairs, executable USD price engine, WS server pushing deltas. Frontend `lib/realtime/client.ts` feeds `store/chart.ts` → DepthTile + TradesTile go real-time.
3. **Price platform-wide + REST routing.** `/route` and `/price` endpoints; `use-dex-aggregator.tsx` and trade/watchlist UI consume the service; pollers demoted to fallback.
4. **Harden + deploy.** Reconnect/resync, Dockerfile, `.env.example`, health checks; deploy to the chosen host.

---

## Critical Files

**New:** `realtime-service/**` (whole folder), `lib/chain-registry/chains/mantle.ts`, `lib/realtime/client.ts`, `app/api/realtime/price/route.ts`.

**Modified:** `lib/chain-registry/index.ts` (register Mantle), `store/chart.ts` consumers via `components/terminal/hooks/useChartData.ts` + `lib/terminal/data/poolReserves.ts` (realtime-first, poll fallback), `hooks/use-dex-aggregator.tsx` (REST routing path + fallback), optionally `components/providers/wallet-provider.tsx` (WS transport).

**Reused patterns:** `lib/terminal/data/binanceStream.ts` (WS open/snapshot/update/status/reconnect), `store/chart.ts` (`setReserves`/`pushTrade`/`upsertCandle` already drive the tiles), `lib/chain-registry/chains/zerog.ts` (ChainConfig shape incl. existing `webSocket` rpcUrl field).

---

## Verification

- **Service in isolation:** run `realtime-service` against Mantle mainnet; trigger a real swap on a tracked pool and confirm a console/WS delta arrives within ~1–2s (block time). `curl /health`, `/price?symbol=…`, `/route?tokenIn=…&tokenOut=…&amountIn=…`.
- **Latency check:** compare timestamp of an on-chain Swap (explorer) vs when the frontend tile updates — target ≤ ~2s.
- **Frontend e2e:** `bun run build` (repo has no tests — build + visual is the gate per CLAUDE.md). On `/terminal`, watch DepthTile reserves and TradesTile update live on real swaps; confirm trade-panel quote matches `/route` output.
- **Fallback:** kill the service; confirm the terminal degrades to the 6s poller and on-chain aggregator without crashing.
- **Correctness:** the trade-UI price now reflects the pool's executable price (decoded from Swap events), not the Binance reference — verify against a manual `getAmountOut`.
