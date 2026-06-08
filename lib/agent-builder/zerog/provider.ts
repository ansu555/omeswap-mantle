/**
 * 0G Chain provider — EVM wallet and RPC utilities for the 0G network.
 *
 * This is the authoritative provider for the agent builder.
 * Import from here in all new agent nodes and builder code.
 */
import { ZEROG_CHAIN_ID as ACTIVE_ZEROG_CHAIN_ID } from '@/lib/chain-registry/chains/zerog'

export { getPublicProvider, connectWallet } from '../evm-provider'
export {
  ZEROG_RPC,
  ZEROG_CHAIN_PARAMS,
  ZEROG_CHAIN_ID,
  zeroGChain,
} from '@/lib/chain-registry/chains/zerog'

/** The default 0G Chain ID */
export const ZEROG_DEFAULT_CHAIN_ID = ACTIVE_ZEROG_CHAIN_ID
