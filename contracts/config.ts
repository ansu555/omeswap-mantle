/**
 * contracts/config.ts — thin re-export shim.
 *
 * All values are now sourced from the chain registry so that this file stays
 * as the single backward-compatible import point for the rest of the codebase.
 * To change addresses, update lib/chain-registry/chains/zerog.ts.
 *
 * Default chain: selected 0G network from the chain registry.
 */

import { getChainConfig, getDefaultChainId } from '@/lib/chain-registry'
import type { Address } from 'viem'

const _cfg = getChainConfig(getDefaultChainId())
const _rt = _cfg.tokens

// ── OmeSwap contracts ─────────────────────────────────────────────────────────

export const CONTRACT_ADDRESSES = {
  POOLS: (_cfg.omeswapPools ?? '0x0000000000000000000000000000000000000000') as Address,
  ROUTER: (_cfg.omeswapRouter ?? '0x0000000000000000000000000000000000000000') as Address,
}

// ── DEX routers ───────────────────────────────────────────────────────────────

const _dexV1 = _cfg.dexRouters.find(r => r.id === 'zerog_dex')
const _dexV2 = _cfg.dexRouters.find(r => r.id === 'zerog_dex_v2')

export const DEX_ROUTERS = {
  ZEROG_DEX:    (_dexV1?.routerAddress ?? '0x0000000000000000000000000000000000000010') as Address,
  ZEROG_DEX_V2: (_dexV2?.routerAddress ?? '0x0000000000000000000000000000000000000011') as Address,
} as const

/** Wrapped native 0G token address */
export const W0G_ADDRESS = _cfg.nativeWrapped

/** @deprecated Use W0G_ADDRESS. Kept for hook backward-compatibility. */
export const WAVAX_ADDRESS = _cfg.nativeWrapped

// ── Token addresses ───────────────────────────────────────────────────────────

export const TOKEN_ADDRESSES: { [key: string]: { address: Address; name: string; symbol: string; decimals: number } } = {
  W0G:  _rt.W0G  ?? { address: '0x0000000000000000000000000000000000000001' as Address, name: 'Wrapped 0G', symbol: 'W0G', decimals: 18 },
  USDC: _rt.USDC ?? { address: '0x0000000000000000000000000000000000000002' as Address, name: 'USD Coin', symbol: 'USDC', decimals: 6 },
  USDT: _rt.USDT ?? { address: '0x0000000000000000000000000000000000000003' as Address, name: 'Tether USD', symbol: 'USDT', decimals: 6 },
  WETH: _rt.WETH ?? { address: '0x0000000000000000000000000000000000000004' as Address, name: 'Wrapped Ether', symbol: 'WETH', decimals: 18 },
  WBTC: _rt.WBTC ?? { address: '0x0000000000000000000000000000000000000005' as Address, name: 'Wrapped Bitcoin', symbol: 'WBTC', decimals: 8 },
  OmE:  _rt.OmE  ?? { address: '0x87E3FC6944FAe11FEfd71d61003f42C6d1b445BF' as Address, name: 'OmE Token', symbol: 'OmE', decimals: 18 },
  USDO: _rt.USDO ?? { address: '0x4c95c850D6C89775791B801fDc7ED739702a8811' as Address, name: 'OmeSwap USD', symbol: 'USDO', decimals: 6 },
  // Legacy aliases for hooks/components that use old Avalanche key names
  WAVAX:    _rt.W0G  ?? { address: '0x0000000000000000000000000000000000000001' as Address, name: 'Wrapped 0G', symbol: 'W0G', decimals: 18 },
  WETHe:    _rt.WETH ?? { address: '0x0000000000000000000000000000000000000004' as Address, name: 'Wrapped Ether', symbol: 'WETH', decimals: 18 },
  WBTCe:    _rt.WBTC ?? { address: '0x0000000000000000000000000000000000000005' as Address, name: 'Wrapped Bitcoin', symbol: 'WBTC', decimals: 8 },
  USDTe:    _rt.USDT ?? { address: '0x0000000000000000000000000000000000000003' as Address, name: 'Tether USD', symbol: 'USDT', decimals: 6 },
  tUSDC:    _rt.USDC ?? { address: '0x0000000000000000000000000000000000000002' as Address, name: 'USD Coin', symbol: 'USDC', decimals: 6 },
  tUSDT:    _rt.USDT ?? { address: '0x0000000000000000000000000000000000000003' as Address, name: 'Tether USD', symbol: 'USDT', decimals: 6 },
}

export const TOKENS = TOKEN_ADDRESSES
export const MAINNET_TOKENS = TOKEN_ADDRESSES

export const TOKEN_LIST = Object.values(TOKEN_ADDRESSES)
