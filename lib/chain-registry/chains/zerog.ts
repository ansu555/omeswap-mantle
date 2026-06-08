/**
 * 0G Chain configuration — single source of truth for all 0G-specific
 * addresses, tokens, and DEX routers in the app.
 *
 * Supports both current 0G networks:
 * - Mainnet  (chainId 16661)
 * - Testnet  (Galileo, chainId 16602)
 *
 * Select the active network with:
 * NEXT_PUBLIC_0G_NETWORK=mainnet|testnet
 */

import { defineChain } from "viem";
import type { Address } from "viem";
import type { ChainConfig } from "../types";
import {
  JAINE_DEX_ID,
  JAINE_DEX_NAME,
  JAINE_V3_ROUTER_ADDRESS,
} from "../../dex/jaine";

type ZeroGNetwork = "mainnet" | "testnet";

type ZeroGNetworkConfig = {
  chainId: number;
  chainName: string;
  rpcUrl: string;
  wssUrl: string;
  explorerName: string;
  explorerUrl: string;
  storageIndexerUrl: string;
  daRpcUrl: string;
  isTestnet: boolean;
};

const ZERO_G_NETWORKS: Record<ZeroGNetwork, ZeroGNetworkConfig> = {
  mainnet: {
    chainId: 16661,
    chainName: "0G Mainnet",
    rpcUrl: "https://evmrpc.0g.ai",
    wssUrl: "wss://evmws.0g.ai",
    explorerName: "0G Chain Scan",
    explorerUrl: "https://chainscan.0g.ai",
    storageIndexerUrl: "https://indexer-storage-turbo.0g.ai",
    daRpcUrl: "https://da-client.0g.ai",
    isTestnet: false,
  },
  testnet: {
    chainId: 16602,
    chainName: "0G Galileo Testnet",
    rpcUrl: "https://evmrpc-testnet.0g.ai",
    wssUrl: "wss://evmws-testnet.0g.ai",
    explorerName: "0G Galileo Chain Scan",
    explorerUrl: "https://chainscan-galileo.0g.ai",
    storageIndexerUrl: "https://indexer-storage-turbo-testnet.0g.ai",
    daRpcUrl: "https://da-client-testnet.0g.ai",
    isTestnet: true,
  },
};

const NETWORK_ALIASES: Record<string, ZeroGNetwork> = {
  mainnet: "mainnet",
  testnet: "testnet",
  galileo: "testnet",
  newton: "testnet",
};

function resolveZeroGNetwork(raw: string | undefined): ZeroGNetwork {
  const normalized = raw?.trim().toLowerCase();
  if (!normalized) return "mainnet";

  const resolved = NETWORK_ALIASES[normalized];
  if (resolved) return resolved;

  throw new Error(
    `Invalid NEXT_PUBLIC_0G_NETWORK="${raw}". Use one of: mainnet, testnet, galileo, newton.`,
  );
}

function getOfficialTransportNetwork(url: string): ZeroGNetwork | null {
  const normalized = url.trim().toLowerCase();
  if (!normalized) return null;

  if (
    normalized.includes("evmrpc-testnet.0g.ai") ||
    normalized.includes("evmws-testnet.0g.ai")
  ) {
    return "testnet";
  }

  if (
    normalized.includes("evmrpc.0g.ai") ||
    normalized.includes("evmws.0g.ai")
  ) {
    return "mainnet";
  }

  return null;
}

function resolveTransportEndpoint(
  envName: string,
  rawValue: string | undefined,
  expectedNetwork: ZeroGNetwork,
  fallback: string,
): string {
  const candidate = rawValue?.trim();
  if (!candidate) return fallback;

  const detectedNetwork = getOfficialTransportNetwork(candidate);
  if (detectedNetwork && detectedNetwork !== expectedNetwork) {
    console.warn(
      `[0G] Ignoring ${envName}=${candidate} because it targets ${detectedNetwork} while NEXT_PUBLIC_0G_NETWORK=${expectedNetwork}. Falling back to ${fallback}.`,
    );
    return fallback;
  }

  return candidate;
}

export const ZEROG_NETWORK: ZeroGNetwork = resolveZeroGNetwork(
  process.env.NEXT_PUBLIC_0G_NETWORK,
);
const ACTIVE = ZERO_G_NETWORKS[ZEROG_NETWORK];

// ── Chain definition ─────────────────────────────────────────────────────────

export const ZEROG_CHAIN_ID = ACTIVE.chainId;
export const ZEROG_RPC = resolveTransportEndpoint(
  "NEXT_PUBLIC_0G_RPC",
  process.env.NEXT_PUBLIC_0G_RPC,
  ZEROG_NETWORK,
  ACTIVE.rpcUrl,
);
export const ZEROG_WSS = resolveTransportEndpoint(
  "NEXT_PUBLIC_0G_WSS",
  process.env.NEXT_PUBLIC_0G_WSS,
  ZEROG_NETWORK,
  ACTIVE.wssUrl,
);

export const zeroGChain = defineChain({
  id: ZEROG_CHAIN_ID,
  name: ACTIVE.chainName,
  nativeCurrency: {
    name: "0G",
    symbol: "0G",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [ZEROG_RPC],
      webSocket: [ZEROG_WSS],
    },
  },
  blockExplorers: {
    default: {
      name: ACTIVE.explorerName,
      url: ACTIVE.explorerUrl,
    },
  },
  testnet: ACTIVE.isTestnet,
});

/** EIP-3085 `wallet_addEthereumChain` params for MetaMask */
export const ZEROG_CHAIN_PARAMS = {
  chainId: `0x${ZEROG_CHAIN_ID.toString(16)}` as const,
  chainName: ACTIVE.chainName,
  nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  rpcUrls: [ZEROG_RPC],
  blockExplorerUrls: [`${ACTIVE.explorerUrl}/`],
} as const;

// ── 0G Protocol endpoints ────────────────────────────────────────────────────

/** 0G Storage indexer — KV store for real-time agent state */
export const ZEROG_STORAGE_RPC =
  process.env.NEXT_PUBLIC_0G_STORAGE_RPC ?? ACTIVE.storageIndexerUrl;

/** 0G DA RPC — data availability layer for high-throughput blobs */
export const ZEROG_DA_RPC = process.env.NEXT_PUBLIC_0G_DA_RPC ?? ACTIVE.daRpcUrl;

/** 0G Compute gateway — AI inference via qwen3-8b, GLM-5-FP8, etc. */
export const ZEROG_COMPUTE_ENDPOINT =
  process.env.NEXT_PUBLIC_0G_COMPUTE_ENDPOINT ?? "https://compute-api.0g.ai/v1";

// ── Full ChainConfig ─────────────────────────────────────────────────────────

export const zeroGConfig: ChainConfig = {
  chain: zeroGChain,

  // Verified on-chain: W0G on 0G mainnet (from pool 0x961da9b2fd03e04b088a90843a93e66f13112d0a)
  nativeWrapped: "0x1cd0690ff9a693f5ef2dd976660a8dafc81a109c" as Address,

  // Routing hubs: W0G first (deepest liquidity), USDC.e second (bridged stablecoin).
  hubTokens: [
    "0x1cd0690ff9a693f5ef2dd976660a8dafc81a109c" as Address, // W0G
    "0x1f3aa82227281ca364bfb3d253b0f1af1da6473e" as Address, // USDC.e (Bridged USDC)
  ],

  explorerUrl: ACTIVE.explorerUrl,
  explorerTxPath: "/tx/",
  explorerAddressPath: "/address/",

  // Jaine's current public 0G market surface supports W0G/USDC.e swaps.
  // It is handled by the app's custom Jaine adapter rather than the generic V2 router path.
  dexRouters: ZEROG_NETWORK === "mainnet"
    ? [
        {
          id: JAINE_DEX_ID,
          name: JAINE_DEX_NAME,
          type: "custom",
          routerAddress: JAINE_V3_ROUTER_ADDRESS as Address,
        },
      ]
    : [],

  // Verified token addresses on 0G mainnet (chain ID 16661).
  tokens: {
    W0G: {
      address: "0x1cd0690ff9a693f5ef2dd976660a8dafc81a109c" as Address,
      name: "Wrapped 0G",
      symbol: "W0G",
      decimals: 18,
    },
    USDC: {
      address: "0x1f3aa82227281ca364bfb3d253b0f1af1da6473e" as Address,
      name: "Bridged USDC",
      symbol: "USDC.e",
      decimals: 6,
      coingeckoId: "usd-coin",
    },
    USDT: {
      address: "0x0000000000000000000000000000000000000003" as Address,
      name: "Tether USD",
      symbol: "USDT",
      decimals: 6,
      coingeckoId: "tether",
    },
    WETH: {
      address: "0x0000000000000000000000000000000000000004" as Address,
      name: "Wrapped Ether",
      symbol: "WETH",
      decimals: 18,
      coingeckoId: "ethereum",
    },
    WBTC: {
      address: "0x0000000000000000000000000000000000000005" as Address,
      name: "Wrapped Bitcoin",
      symbol: "WBTC",
      decimals: 8,
      coingeckoId: "bitcoin",
    },
    // OmeSwap native tokens — addresses updated after deployTokens.js
    OmE: {
      address: "0x87E3FC6944FAe11FEfd71d61003f42C6d1b445BF" as Address,
      name: "OmE Token",
      symbol: "OmE",
      decimals: 18,
    },
    USDO: {
      address: "0x4c95c850D6C89775791B801fDc7ED739702a8811" as Address,
      name: "OmeSwap USD",
      symbol: "USDO",
      decimals: 6,
    },
  },

  omeswapPools: "0xbbC3958B39958ca4a60d06cB62EB2DE7CE5380C0" as Address,
  omeswapRouter: "0x42a2F8580211654109Bb6e972898FA41e7511918" as Address,
};
