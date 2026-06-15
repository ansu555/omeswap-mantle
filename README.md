# OmeSwap on Mantle

A decentralized exchange and agent-driven trading app built for the Mantle network.

![Mantle](https://img.shields.io/badge/Chain-Mantle-00bcd4) ![Next.js](https://img.shields.io/badge/Next.js-15-black) ![React](https://img.shields.io/badge/React-19-blue)

## Features

- Multi-DEX swap aggregation (FusionX V3, Agni Finance, Merchant Moe) + liquidity primitives
- Mantle-native chain registry and wallet switching
- Mantle Mainnet + Sepolia Testnet support
- Agent wallet + ATS research/execution flows
- Integration points for 0G Storage, Compute, and DA (external AI/data infra)
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
NEXT_PUBLIC_MANTLE_NETWORK=mainnet            # or testnet
NEXT_PUBLIC_MANTLE_RPC=https://rpc.mantle.xyz
NEXT_PUBLIC_MANTLE_WSS=wss://wss.mantle.xyz
```

4. Start the app

```bash
npm run dev
```

Open `http://localhost:3000`.

## Prerequisites

- Node.js 18+
- MetaMask or compatible EVM wallet
- MNT balance for gas on your selected Mantle network

## Tech Stack

- Frontend: Next.js 15, React 19, Tailwind, shadcn/ui
- Web3: wagmi v2, viem v2, RainbowKit
- Contracts: Solidity + Hardhat (under `0g-contract/`)
- Agents: ATS orchestration with optional AXL peer transport

## Mantle Network Configuration

### Mantle Mainnet (default)

- Chain ID: `5000`
- RPC: `https://rpc.mantle.xyz`
- WSS: `wss://wss.mantle.xyz`
- Explorer: `https://explorer.mantle.xyz`

### Mantle Sepolia Testnet

- Chain ID: `5003`
- RPC: `https://rpc.sepolia.mantle.xyz`
- WSS: `wss://wss.sepolia.mantle.xyz`
- Explorer: `https://explorer.sepolia.mantle.xyz`

Switch between them with:

```bash
NEXT_PUBLIC_MANTLE_NETWORK=mainnet  # or testnet
```

## Core Addresses (Mantle Mainnet)

From `lib/chain-registry/chains/mantle.ts`:

- WMNT (Wrapped Mantle): `0x78c1b0c915c4faa5fffa6cabf0219da63d7f4cb8`
- USDC: `0x09bc4e0d864854c6afb6eb9a9cdf58ac190d0df9`
- USDT: `0x201eba5cc46d216ce6dc03f6a759e8e766e956ae`
- FusionX V3 Router: `0x5989FB161568b9F133eDf5Cf6787f5597762797F`
- Agni Finance Router: `0x319B69888b0d11cEC22caA5034e25FfFBDc88421`
- Merchant Moe LB Router: `0x013e138EF6008ae5FDFDE29700e3f2Bc61d21E3a`

> OmeSwap's own AMM (`omeswapPools` / `omeswapRouter`) is deployed to Mantle Sepolia from `0g-contract/`; mainnet AMM addresses are TBD. See `lib/chain-registry/chains/mantle.ts`.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint

# Smart contracts (self-contained hardhat project — run inside 0g-contract/)
cd 0g-contract && npm install
npx hardhat compile
npx hardhat test
npx hardhat run scripts/deployTokens.js --network mantleSepolia
npx hardhat run scripts/deploy.js       --network mantleSepolia
npx hardhat run scripts/addLiquidity.js --network mantleSepolia

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
- Mantle Explorer: https://explorer.mantle.xyz

Built for the Mantle ecosystem.
