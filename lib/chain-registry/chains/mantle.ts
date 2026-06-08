/**
 * Mantle chain configuration — single source of truth for all Mantle-specific
 * addresses, tokens, and DEX routers in the app.
 *
 * Mantle is an EVM-compatible L2 (chainId 5000). Block time is ~1-2s, which is
 * the real-time ceiling for confirmed on-chain data. The realtime-service in
 * `/realtime-service` mirrors the addresses below — keep the two in sync.
 *
 * Select the active network with:
 *   NEXT_PUBLIC_MANTLE_NETWORK=mainnet|testnet
 */

import { defineChain } from "viem";
import type { Address } from "viem";
import type { ChainConfig } from "../types";

type MantleNetwork = "mainnet" | "testnet";

type MantleNetworkConfig = {
  chainId: number;
  chainName: string;
  rpcUrl: string;
  wssUrl: string;
  explorerName: string;
  explorerUrl: string;
  isTestnet: boolean;
};

const MANTLE_NETWORKS: Record<MantleNetwork, MantleNetworkConfig> = {
  mainnet: {
    chainId: 5000,
    chainName: "Mantle",
    rpcUrl: "https://rpc.mantle.xyz",
    wssUrl: "wss://wss.mantle.xyz",
    explorerName: "Mantle Explorer",
    explorerUrl: "https://explorer.mantle.xyz",
    isTestnet: false,
  },
  testnet: {
    chainId: 5003,
    chainName: "Mantle Sepolia Testnet",
    rpcUrl: "https://rpc.sepolia.mantle.xyz",
    wssUrl: "wss://wss.sepolia.mantle.xyz",
    explorerName: "Mantle Sepolia Explorer",
    explorerUrl: "https://explorer.sepolia.mantle.xyz",
    isTestnet: true,
  },
};

function resolveMantleNetwork(raw: string | undefined): MantleNetwork {
  const normalized = raw?.trim().toLowerCase();
  if (!normalized) return "mainnet";
  if (normalized === "mainnet" || normalized === "testnet") return normalized;
  if (normalized === "sepolia") return "testnet";
  throw new Error(
    `Invalid NEXT_PUBLIC_MANTLE_NETWORK="${raw}". Use one of: mainnet, testnet, sepolia.`,
  );
}

export const MANTLE_NETWORK: MantleNetwork = resolveMantleNetwork(
  process.env.NEXT_PUBLIC_MANTLE_NETWORK,
);
const ACTIVE = MANTLE_NETWORKS[MANTLE_NETWORK];

// ── Chain definition ─────────────────────────────────────────────────────────

export const MANTLE_CHAIN_ID = ACTIVE.chainId;
export const MANTLE_RPC =
  process.env.NEXT_PUBLIC_MANTLE_RPC?.trim() || ACTIVE.rpcUrl;
export const MANTLE_WSS =
  process.env.NEXT_PUBLIC_MANTLE_WSS?.trim() || ACTIVE.wssUrl;

export const mantleChain = defineChain({
  id: MANTLE_CHAIN_ID,
  name: ACTIVE.chainName,
  nativeCurrency: {
    name: "Mantle",
    symbol: "MNT",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [MANTLE_RPC],
      webSocket: [MANTLE_WSS],
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
export const MANTLE_CHAIN_PARAMS = {
  chainId: `0x${MANTLE_CHAIN_ID.toString(16)}` as const,
  chainName: ACTIVE.chainName,
  nativeCurrency: { name: "Mantle", symbol: "MNT", decimals: 18 },
  rpcUrls: [MANTLE_RPC],
  blockExplorerUrls: [`${ACTIVE.explorerUrl}/`],
} as const;

// ── Verified Mantle mainnet token addresses ──────────────────────────────────
// Sources: explorer.mantle.xyz token pages.

const WMNT_ADDRESS = "0x78c1b0c915c4faa5fffa6cabf0219da63d7f4cb8" as Address;
const USDC_ADDRESS = "0x09bc4e0d864854c6afb6eb9a9cdf58ac190d0df9" as Address;
const USDT_ADDRESS = "0x201eba5cc46d216ce6dc03f6a759e8e766e956ae" as Address;
const WETH_ADDRESS = "0xdeaddeaddeaddeaddeaddeaddeaddeaddead1111" as Address;

// ── FusionX V3 (Uniswap V3 fork) — verified on Mantle mainnet ─────────────────
// Source: docs.fusionx.finance. Handled by the app's custom adapter / the
// realtime-service router, not the generic UniswapV2 path.
export const FUSIONX_V3_FACTORY =
  "0x530d2766D1988CC1c000C8b7d00334c14B69AD71" as Address;
export const FUSIONX_V3_SWAP_ROUTER =
  "0x5989FB161568b9F133eDf5Cf6787f5597762797F" as Address;
export const FUSIONX_V3_QUOTER_V2 =
  "0x90f72244294E7c5028aFd6a96E18CC2c1E913995" as Address;

// ── Full ChainConfig ─────────────────────────────────────────────────────────

export const mantleConfig: ChainConfig = {
  chain: mantleChain,

  nativeWrapped: WMNT_ADDRESS,

  // Routing hubs: WMNT first (deepest liquidity), then bridged stables.
  hubTokens: [WMNT_ADDRESS, USDC_ADDRESS, USDT_ADDRESS],

  explorerUrl: ACTIVE.explorerUrl,
  explorerTxPath: "/tx/",
  explorerAddressPath: "/address/",

  dexRouters:
    MANTLE_NETWORK === "mainnet"
      ? [
          {
            id: "fusionx_v3",
            name: "FusionX V3",
            type: "custom",
            routerAddress: FUSIONX_V3_SWAP_ROUTER,
            quoterAddress: FUSIONX_V3_QUOTER_V2,
          },
        ]
      : [],

  tokens: {
    WMNT: {
      address: WMNT_ADDRESS,
      name: "Wrapped Mantle",
      symbol: "WMNT",
      decimals: 18,
      coingeckoId: "mantle",
    },
    USDC: {
      address: USDC_ADDRESS,
      name: "USD Coin",
      symbol: "USDC",
      decimals: 6,
      coingeckoId: "usd-coin",
    },
    USDT: {
      address: USDT_ADDRESS,
      name: "Tether USD",
      symbol: "USDT",
      decimals: 6,
      coingeckoId: "tether",
    },
    WETH: {
      address: WETH_ADDRESS,
      name: "Wrapped Ether",
      symbol: "WETH",
      decimals: 18,
      coingeckoId: "ethereum",
    },
  },

  // OmeSwap contracts — pending deployment to Mantle.
  omeswapPools: undefined,
  omeswapRouter: undefined,
};
