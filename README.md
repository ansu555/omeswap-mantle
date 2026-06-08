# OmeSwap on 0G Chain

A decentralized exchange and agent-driven trading app built for the 0G ecosystem.

![0G](https://img.shields.io/badge/Chain-0G-00bcd4) ![Next.js](https://img.shields.io/badge/Next.js-15-black) ![React](https://img.shields.io/badge/React-19-blue)

## Features

- Uniswap-style swap and liquidity primitives
- 0G-native chain registry and wallet switching
- 0G Mainnet + Galileo Testnet support
- Agent wallet + ATS research/execution flows
- Integration points for 0G Storage, Compute, and DA
- Next.js + wagmi/viem frontend with modern UI

## Quick Start

1. Install dependencies

```bash
npm install
```

2. Create local env file

```bash
cp .env.example .env.local
```

3. Set required values in `.env.local`

```bash
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
```

Optional network overrides (defaults come from chain registry):

```bash
NEXT_PUBLIC_0G_NETWORK=mainnet
NEXT_PUBLIC_0G_RPC=https://evmrpc.0g.ai
NEXT_PUBLIC_0G_WSS=wss://evmws.0g.ai
```

4. Start the app

```bash
npm run dev
```

Open `http://localhost:3000`.

## Prerequisites

- Node.js 18+
- MetaMask or compatible EVM wallet
- 0G token balance for gas on your selected 0G network

## Tech Stack

- Frontend: Next.js 15, React 19, Tailwind, shadcn/ui
- Web3: wagmi v2, viem v2, RainbowKit
- Contracts: Solidity + Hardhat (under `0g-contract/`)
- Agents: ATS orchestration with optional AXL peer transport

## 0G Network Configuration

### 0G Mainnet (default)

- Chain ID: `16661`
- RPC: `https://evmrpc.0g.ai`
- WSS: `wss://evmws.0g.ai`
- Explorer: `https://chainscan.0g.ai`

### 0G Galileo Testnet

- Chain ID: `16602`
- RPC: `https://evmrpc-testnet.0g.ai`
- WSS: `wss://evmws-testnet.0g.ai`
- Explorer: `https://chainscan-galileo.0g.ai`

Switch between them with:

```bash
NEXT_PUBLIC_0G_NETWORK=mainnet  # or testnet
```

## Core Contract Addresses (0G Mainnet)

From `lib/chain-registry/chains/zerog.ts`:

- OmeSwap Pools: `0xbbC3958B39958ca4a60d06cB62EB2DE7CE5380C0`
- OmeSwap Router: `0x42a2F8580211654109Bb6e972898FA41e7511918`
- Wrapped 0G (W0G): `0x1cd0690ff9a693f5ef2dd976660a8dafc81a109c`
- USDC.e: `0x1f3aa82227281ca364bfb3d253b0f1af1da6473e`

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint

npm run hardhat:compile
npm run hardhat:test
npm run hardhat:deploy
npm run hardhat:tokens
npm run hardhat:liquidity
npm run hardhat:ome-liquidity

npm run axl:agent
npm run axl:demo
```

## AXL Peer-to-Peer ATS Swarm

Run ATS agents on separate peers with transport selection (`local` | `axl` | `auto`).

```bash
ATS_AGENT_TRANSPORT=axl bun run axl:demo BTC solo
```

See: `doc/axl.md`

## Documentation

- `doc/README.md`
- `doc/idea.md`
- `doc/recode.md`
- `doc/phases/index.md`

## Project Structure

```text
omeswap-templet/
├── app/
├── components/
├── contracts/
├── 0g-contract/
├── hooks/
├── lib/
├── scripts/
└── doc/
```

## Security Note

This project includes on-chain execution paths. Before production usage, perform:

- Contract and integration audits
- Key management hardening
- Runtime risk limits and monitoring

## Support

- Issues: GitHub Issues
- 0G Explorer: https://chainscan.0g.ai

Built for the 0G ecosystem.
