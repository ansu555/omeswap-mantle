# 0G Chain & Integration Guideline

This guide explains what to create, edit, or delete when you want to:

1. **Work with the 0G chain config** (add DEXes, update tokens, change RPC)
2. **Integrate 0G Storage** (persistent agent memory — KV state + Log history)
3. **Integrate 0G Compute** (decentralized AI inference — qwen3, GLM-5-FP8)
4. **Integrate 0G DA** (data availability for high-throughput agent output)
5. **Add a new chain** alongside 0G (multi-chain support)
6. **Add or remove a DEX** on 0G

---

## Architecture in One Sentence

Everything chain-specific lives in `lib/chain-registry/`. All 0G SDK wrappers
live in `lib/zerog/`. All other files read from those two directories — you
almost never need to touch app code to change a chain, DEX, or 0G integration.

```
lib/chain-registry/
  types.ts              ← type definitions (rarely touch)
  index.ts              ← registry lookup + DEFAULT_CHAIN_ID (touch to swap default chain)
  chains/
    zerog.ts            ← ALL 0G addresses, RPC, endpoints (touch to edit 0G)
    polygon.ts          ← (create this for Polygon, if needed)

lib/zerog/
  storage.ts            ← 0G Storage SDK wrapper (KV blobs + Log blobs)
  compute.ts            ← 0G Compute inference wrapper (qwen3, GLM-5-FP8)
  da.ts                 ← 0G DA data availability wrapper
  index.ts              ← re-export barrel (import everything from '@/lib/zerog')
```

---

## 0G Protocol — Four Core Components

### 1. 0G Chain (EVM-compatible blockchain)
- **Chain ID**: 16600 (Newton Testnet)
- **RPC**: `https://evmrpc-testnet.0g.ai`
- **Explorer**: `https://chainscan-newton.0g.ai`
- **Native token**: A0GI (18 decimals)
- Config file: `lib/chain-registry/chains/zerog.ts`

### 2. 0G Storage (decentralized persistent memory)
- **Use for**: agent KV state (real-time), conversation/decision history (Log)
- **Indexer**: `https://indexer-storage-testnet-standard.0g.ai`
- **SDK**: `@0glabs/0g-ts-sdk`
- Wrapper: `lib/zerog/storage.ts`

```typescript
import { saveAgentMemory, loadAgentMemory, appendLog } from '@/lib/zerog'

// Save agent state to 0G Storage
const { rootHash } = await saveAgentMemory('agent-001', { position: 'LONG', size: 100 })

// Retrieve later by rootHash
const { state } = await loadAgentMemory<MyState>(rootHash)

// Append to conversation log
await appendLog('agent-001', { role: 'user', content: 'Check BTCUSDT' })
```

### 3. 0G Compute (decentralized AI inference)
- **Use for**: agent reasoning, signal analysis, natural language decisions
- **Endpoint**: `https://compute-api.0g.ai/v1`
- **Models**: `qwen3-8b` (fast), `qwen3.6-plus` (sealed ZK), `GLM-5-FP8` (accurate)
- **Sealed inference**: ZK-verified output — use `sealed: true` for decision-critical calls
- Wrapper: `lib/zerog/compute.ts`

```typescript
import { computeInference, agentReason, streamComputeInference } from '@/lib/zerog'

// Quick single-turn reasoning
const answer = await agentReason('Is BTC in a bull regime?', 'You are a crypto analyst.')

// Full inference with sealed ZK proof
const { content, proofRef } = await computeInference({
  model: 'qwen3.6-plus',
  messages: [{ role: 'user', content: 'Analyze this signal...' }],
  sealed: true,
})

// Streaming inference for the copilot tile
for await (const chunk of streamComputeInference({ model: 'qwen3-8b', messages })) {
  process.stdout.write(chunk.delta)
}
```

### 4. 0G DA (data availability layer)
- **Use for**: large inference results, swarm coordination messages, high-volume attestations
- **RPC**: `https://da-client-testnet.0g.ai`
- Wrapper: `lib/zerog/da.ts`

```typescript
import { postSwarmMessage, postInferenceResult, verifyDAAvailability } from '@/lib/zerog'

// Post swarm coordination message
const { commitment } = await postSwarmMessage({ from: 'planner', to: 'executor', action: 'buy' })

// Store large inference output with availability proof
const { commitment: proof } = await postInferenceResult(largeOutput, {
  agentId: 'signal-agent',
  model: 'GLM-5-FP8',
})

// Verify the data is available on-chain
const isAvailable = await verifyDAAvailability(proof)
```

---

## Scenario 1: Edit the 0G Chain Config

Everything 0G-specific is in **one file**: `lib/chain-registry/chains/zerog.ts`.

### Change the RPC URL

```typescript
// lib/chain-registry/chains/zerog.ts
export const ZEROG_RPC = 'https://your-custom-rpc.0g.ai'   // ← change this
```

### Update DEX router addresses

Once the official 0G DEX is deployed, update the `dexRouters` array:

```typescript
dexRouters: [
  {
    id: 'zerog_dex',
    name: '0G DEX',
    type: 'uniswapV2',
    routerAddress: '0xYourLiveRouterAddress...' as Address,
  },
],
```

### Update OmeSwap contract addresses

After deploying OmeSwap contracts to 0G Chain:

```typescript
omeswapPools:  '0xYourDeployedPoolsAddress...' as Address,
omeswapRouter: '0xYourDeployedRouterAddress...' as Address,
```

### Add tokens

```typescript
tokens: {
  // ... existing tokens ...
  MYTOKEN: {
    address: '0xTokenAddress...' as Address,
    name: 'My Token',
    symbol: 'MYTOKEN',
    decimals: 18,
    coingeckoId: 'my-token',   // optional
  },
},
```

### What updates automatically after editing zerog.ts

| What changes automatically | Why |
|---|---|
| Wallet provider supports 0G Chain | `WalletProvider` calls `getSupportedChains()` |
| Swap hooks use 0G DEX routers | `useDexAggregator` calls `getChainConfig(chainId)` |
| Explorer links point to 0G explorer | `getExplorerLink(chainId, 'tx', hash)` reads from config |
| Agent builder nodes show 0G tokens | They call `getChainConfig(getDefaultChainId())` |

---

## Scenario 2: Switch to a Different Chain (Replace 0G)

### Step 1 — Create the chain config file

Create `lib/chain-registry/chains/<your-chain>.ts`. Use `zerog.ts` as your template:

```typescript
import { defineChain } from 'viem'        // or: import { polygon } from 'viem/chains'
import type { Address } from 'viem'
import type { ChainConfig } from '../types'

export const MY_CHAIN_RPC = 'https://my-chain-rpc.example.com'

export const myChain = defineChain({ /* ... */ })

export const myChainConfig: ChainConfig = {
  chain: myChain,
  nativeWrapped: '0x...' as Address,
  hubTokens: ['0x...' as Address],
  explorerUrl: 'https://explorer.my-chain.com',
  explorerTxPath: '/tx/',
  explorerAddressPath: '/address/',
  dexRouters: [{ id: 'my_dex', name: 'My DEX', type: 'uniswapV2', routerAddress: '0x...' as Address }],
  tokens: { /* ... */ },
}
```

### Step 2 — Register the chain and set it as default

Open `lib/chain-registry/index.ts` and make two changes:

```typescript
// 1. Import your new config
import { myChainConfig } from './chains/my-chain'

// 2. Add it to the registry (remove zeroGConfig if replacing entirely)
const REGISTRY: Record<number, ChainConfig> = {
  [myChainConfig.chain.id]: myChainConfig,
}

// 3. Change the default
export const DEFAULT_CHAIN_ID: number = myChainConfig.chain.id
```

---

## Scenario 3: Add a New Chain Alongside 0G (Multi-Chain)

Keep 0G and add another chain. In `lib/chain-registry/index.ts`:

```typescript
import { zeroGConfig }  from './chains/zerog'
import { polygonConfig } from './chains/polygon'   // ← new

const REGISTRY: Record<number, ChainConfig> = {
  [zeroGConfig.chain.id]:  zeroGConfig,
  [polygonConfig.chain.id]: polygonConfig,   // ← add here
}

// Keep 0G as the default
export const DEFAULT_CHAIN_ID: number = zeroGConfig.chain.id
```

---

## Scenario 4: Add a New DEX to 0G Chain

Open `lib/chain-registry/chains/zerog.ts` and add an entry to `dexRouters`:

```typescript
dexRouters: [
  { id: 'zerog_dex',    name: '0G DEX',    type: 'uniswapV2', routerAddress: '0x...' as Address },
  { id: 'zerog_dex_v2', name: '0G DEX V2', type: 'uniswapV2', routerAddress: '0x...' as Address },
  // ↓ NEW DEX
  {
    id: 'new_dex',
    name: 'New DEX',
    type: 'uniswapV2',
    routerAddress: '0xNewRouterAddress...' as Address,
  },
],
```

`useDexAggregator` picks it up automatically — no hook changes needed.

---

## Scenario 5: Remove a DEX

Delete the entry from `dexRouters` in `lib/chain-registry/chains/zerog.ts`. It
immediately disappears from all swap UIs, agent nodes, and quote logic.

Also remove the fallback in `contracts/config.ts` if you want to keep it clean.

---

## Scenario 6: Add a 0G Storage Node to the Agent Builder

Create a new node class that uses the `lib/zerog/storage.ts` helpers:

```typescript
// lib/agent-builder/nodes/action/ZeroGStorageNode.ts
import { BaseNode } from '../../nodes/BaseNode'
import { saveAgentMemory, loadAgentMemory } from '@/lib/zerog'

export class ZeroGStorageNode extends BaseNode {
  async execute(inputs: Record<string, unknown>) {
    const { action, agentId, data, rootHash } = inputs

    if (action === 'save') {
      const result = await saveAgentMemory(agentId as string, data)
      return { rootHash: result.rootHash }
    }

    if (action === 'load') {
      const result = await loadAgentMemory(rootHash as string)
      return { state: result.state }
    }

    throw new Error(`Unknown action: ${action}`)
  }
}
```

---

## Scenario 7: Add a 0G Compute Node to the Agent Builder

```typescript
// lib/agent-builder/nodes/action/ZeroGComputeNode.ts
import { BaseNode } from '../../nodes/BaseNode'
import { computeInference } from '@/lib/zerog'

export class ZeroGComputeNode extends BaseNode {
  async execute(inputs: Record<string, unknown>) {
    const { prompt, model = 'qwen3-8b', sealed = false } = inputs

    const response = await computeInference({
      model: model as string,
      messages: [{ role: 'user', content: prompt as string }],
      sealed: sealed as boolean,
    })

    return {
      output: response.content,
      proofRef: response.proofRef,
      model: response.model,
    }
  }
}
```

---

## Quick Reference Table

| What you want to do | File(s) to edit |
|---|---|
| Change 0G RPC URL | `lib/chain-registry/chains/zerog.ts` — edit `ZEROG_RPC` |
| Update 0G Storage endpoint | `lib/chain-registry/chains/zerog.ts` — edit `ZEROG_STORAGE_RPC` |
| Update 0G Compute endpoint | `lib/chain-registry/chains/zerog.ts` — edit `ZEROG_COMPUTE_ENDPOINT` |
| Update 0G DA endpoint | `lib/chain-registry/chains/zerog.ts` — edit `ZEROG_DA_RPC` |
| Add a DEX (UniswapV2-compatible) | `lib/chain-registry/chains/zerog.ts` — add entry to `dexRouters` |
| Add a DEX (custom interface) | `lib/chain-registry/chains/zerog.ts` + add quote logic in `hooks/use-dex-aggregator.tsx` |
| Remove a DEX | `lib/chain-registry/chains/zerog.ts` — remove entry from `dexRouters` |
| Add/edit a token | `lib/chain-registry/chains/zerog.ts` — add/edit entry in `tokens` |
| Update OmeSwap contract address | `lib/chain-registry/chains/zerog.ts` — edit `omeswapPools` / `omeswapRouter` |
| Switch to a different chain entirely | Create `lib/chain-registry/chains/<chain>.ts`, update `lib/chain-registry/index.ts` |
| Add a second chain | Create `lib/chain-registry/chains/<chain>.ts`, add to registry in `lib/chain-registry/index.ts` |
| Use 0G Storage in a component/hook | `import { saveAgentMemory, loadAgentMemory } from '@/lib/zerog'` |
| Use 0G Compute in a component/hook | `import { computeInference, agentReason } from '@/lib/zerog'` |
| Use 0G DA in a component/hook | `import { submitToDA, postSwarmMessage } from '@/lib/zerog'` |
| Add 0G env vars | `.env` — see `.env.example` for all 0G keys |

---

## Environment Variables for 0G

| Variable | Description |
|---|---|
| `ZEROG_STORAGE_RPC` | 0G Storage indexer URL |
| `ZEROG_STORAGE_PRIVATE_KEY` | Wallet key for paying storage fees |
| `ZEROG_COMPUTE_ENDPOINT` | 0G Compute API base URL |
| `ZEROG_COMPUTE_API_KEY` | 0G Compute API key |
| `ZEROG_COMPUTE_MODEL` | Default model (`qwen3-8b`, `qwen3.6-plus`, `GLM-5-FP8`) |
| `ZEROG_COMPUTE_SEALED` | `true` to use ZK-verified inference for critical decisions |
| `ZEROG_DA_RPC` | 0G DA client URL |
| `RPC_URL` | 0G Chain EVM RPC (default: Newton Testnet) |

All 0G env vars have safe defaults pointing to Newton Testnet — the app works
out of the box without configuring them for development.

---

## Files You Should NEVER Need to Edit for Chain/DEX Changes

These files read from the registry and should not need changes:

- `hooks/use-dex-aggregator.tsx`
- `hooks/use-dex-swap.tsx`
- `hooks/use-liquidity.tsx`
- `hooks/use-dex-pools.tsx`
- `hooks/use-pool-details.tsx`
- `hooks/use-token-balances.tsx`
- `components/trade/SwapCardDex.tsx`
- `components/trade/AddLiquidityCard.tsx`
- `components/providers/wallet-provider.tsx`
- `store/transaction-store.ts`
- `contracts/config.ts`
- Any agent builder node file

If you find yourself editing those files just to change a chain or DEX,
something is wrong — the data should come from the registry instead.

---

## Checklist for Switching Chains

- [ ] Create `lib/chain-registry/chains/<chain>.ts` with a full `ChainConfig` export
- [ ] Import it in `lib/chain-registry/index.ts` and add it to `REGISTRY`
- [ ] Update `DEFAULT_CHAIN_ID` in `lib/chain-registry/index.ts`
- [ ] Update `contracts/config.ts` DEX IDs if they differ from the old chain's
- [ ] Add/update 0G-specific env vars in `.env` (see `.env.example`)
- [ ] Verify the app runs: `bun run dev`
- [ ] Connect wallet — the new chain should appear in the RainbowKit chain selector
- [ ] Test a swap — quotes should come from the DEXes you configured
- [ ] Test explorer links — "View on Explorer" should go to the correct block explorer

---

## 0G Hackathon Track — Integration Checklist

For the **Best Agent Frameworks** and **Best Autonomous Agents** tracks:

- [ ] At least one agent uses `saveAgentMemory` / `loadAgentMemory` (0G Storage KV)
- [ ] Conversation history appended via `appendLog` (0G Storage Log)
- [ ] AI inference calls routed through `computeInference` (0G Compute)
- [ ] Critical decisions use `sealed: true` for ZK-verified inference
- [ ] High-volume outputs posted via `postInferenceResult` (0G DA)
- [ ] Swarm coordination messages sent via `postSwarmMessage` (0G DA)
- [ ] Contract deployment addresses committed in `lib/chain-registry/chains/zerog.ts`
- [ ] Working example agent in the README with inline code or link

---

## Gensyn AXL Hackathon Track — Integration Checklist

For the **Best Application of Agent eXchange Layer (AXL)** track:

- [ ] At least two AXL nodes are running and exchange messages over the mesh
      (verify with `curl http://127.0.0.1:9002/topology` and `curl http://127.0.0.1:9012/topology`)
- [ ] The peer-side MCP router exposes the OmeSwap agent service
      (verify with `curl http://127.0.0.1:9013/services` — should list `ats-agents`)
- [ ] At least one ATS run executes with `transport: 'axl'` and the SSE stream
      contains `payload.axl = { peer_id, role }` annotations on agent events
- [ ] `bun run axl:demo` completes and prints both Node A and Node B public keys
- [ ] Per-role peer mapping is documented in `.env.example` (`AXL_PEER_*`)
- [ ] Setup, env vars, and demo command are documented in `doc/axl.md`
      and linked from the root `README.md`
- [ ] No central message broker replaces what AXL provides — only the local
      Next API (SSE) and persistence layer remain in-process
- [ ] AXL private keys (`*.pem`) are kept out of git
