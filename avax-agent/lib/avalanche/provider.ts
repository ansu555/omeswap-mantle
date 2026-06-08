/**
 * Re-exports from the shared EVM provider in the main lib.
 * All logic lives in lib/agent-builder/evm-provider.ts — do not duplicate here.
 */
export { getPublicProvider, connectWallet as connectMetaMask } from '../../../lib/agent-builder/evm-provider'
export { AVALANCHE_RPC, AVALANCHE_CHAIN_PARAMS } from '../../../lib/chain-registry/chains/avalanche'

/** @deprecated Use getDefaultChainId() from the chain registry */
export const AVALANCHE_CHAIN_ID = 43114
