/**
 * ATS Execution Agent — chain-aware on-chain swap builder.
 *
 * Handles the final execution step after consensus + risk approval:
 *   - Resolves the correct token addresses from the chain registry
 *   - Chooses V2 (UniswapV2-compatible) or V3 (Uniswap V3) execution path
 *     based on the chain's DEX router type
 *   - Approves ERC-20 tokens if needed (ERC20 `approve`)
 *   - Signs and submits the swap using the agent burner wallet (viem)
 *
 * Router dispatch:
 *   chainId == 16600 (0G) + real router address → UniswapV2 `swapExactTokensForTokens`
 *   chainId == 16600 (0G) + placeholder address → returns pending_deployment status
 *   chainId == 1 (Ethereum) → Uniswap V3 `exactInputSingle` via SwapRouter02
 *
 * Emits:
 *   agent.thinking      — start
 *   execution.pending   — about to sign
 *   execution.done      — tx submitted (or pending/error)
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  type Address,
} from 'viem'
import type { RunEvent, RiskSizing } from '@/lib/ats/types'
import { getOrCreateAgentWallet } from '@/lib/agent-wallet/manager'
import { getChainConfig } from '@/lib/chain-registry'
import { SWAP_ROUTER_ABI, ERC20_ABI } from '@/lib/uniswap/constants'
import { getDexMarket } from '@/lib/dex/geckoterminal'
import {
  executeJaineAgentSwap,
  isJaineTicker,
  JAINE_CHAIN_ID,
  JAINE_MARKET_ID,
} from '@/lib/dex/jaine'

// ── Result type ───────────────────────────────────────────────────────────────

export interface ExecutionAgentResult {
  tx_hash: string | null
  status: 'submitted' | 'pending_deployment' | 'failed' | 'skipped'
  amount_in_usd: number
  token_in: string
  token_out: string
  chain_id: number
  error?: string
}

// ── UniswapV2 ABI (0G DEX compatible) ────────────────────────────────────────

const UNISWAPV2_ROUTER_ABI = [
  {
    name: 'swapExactTokensForTokens',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
  {
    name: 'swapExactETHForTokens',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
  {
    name: 'swapExactTokensForETH',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
] as const

// ── Slippage ──────────────────────────────────────────────────────────────────

const SLIPPAGE_BPS = 200n  // 2% slippage tolerance

function withSlippage(amount: bigint): bigint {
  return (amount * (10000n - SLIPPAGE_BPS)) / 10000n
}

// ── Placeholder detection ─────────────────────────────────────────────────────

function isPlaceholderAddress(addr: string): boolean {
  const lower = addr.toLowerCase()
  return (
    lower === '0x0000000000000000000000000000000000000000' ||
    lower.startsWith('0x000000000000000000000000000000000000000')
  )
}

// ── Token resolution ──────────────────────────────────────────────────────────

const TICKER_ALIAS: Record<string, string> = {
  BTC: 'WBTC',
  ETH: 'WETH',
  ETHER: 'WETH',
  BITCOIN: 'WBTC',
  '0G': 'W0G',
  OG: 'W0G',
  ZEROG: 'W0G',
}

function resolveTokenSymbol(ticker: string): string {
  const upper = ticker.toUpperCase()
  return TICKER_ALIAS[upper] ?? upper
}

// ── V3 execution path (Ethereum mainnet) ─────────────────────────────────────

async function executeV3Swap(
  decision: 'BUY' | 'SELL',
  ticker: string,
  sizing: RiskSizing,
  agentWallet: { address: string; account: import('viem/accounts').PrivateKeyAccount },
  chainConfig: ReturnType<typeof getChainConfig>,
): Promise<ExecutionAgentResult> {
  const router = chainConfig.dexRouters.find((r) => r.type === 'custom' || r.type === 'uniswapV2')
  if (!router) {
    return { tx_hash: null, status: 'failed', amount_in_usd: 0, token_in: 'unknown', token_out: 'unknown', chain_id: chainConfig.chain.id, error: 'No suitable DEX router found.' }
  }

  const tokenSymbol = resolveTokenSymbol(ticker)
  const stableSymbol = 'USDC'

  const tokenInfo = chainConfig.tokens[tokenSymbol]
  const stableInfo = chainConfig.tokens[stableSymbol]

  if (!tokenInfo) {
    return {
      tx_hash: null, status: 'failed',
      amount_in_usd: 0, token_in: 'unknown', token_out: 'unknown',
      chain_id: chainConfig.chain.id,
      error: `Token ${tokenSymbol} not found in chain registry for chain ${chainConfig.chain.id}.`,
    }
  }

  if (!stableInfo) {
    return {
      tx_hash: null, status: 'failed',
      amount_in_usd: 0, token_in: 'unknown', token_out: 'unknown',
      chain_id: chainConfig.chain.id,
      error: 'USDC not configured in chain registry.',
    }
  }

  const [tokenIn, tokenOut] = decision === 'BUY'
    ? [stableInfo, tokenInfo]
    : [tokenInfo, stableInfo]

  const rpcUrl = chainConfig.chain.rpcUrls.default.http[0]
  const publicClient = createPublicClient({ chain: chainConfig.chain, transport: http(rpcUrl) })
  const walletClient = createWalletClient({ account: agentWallet.account, chain: chainConfig.chain, transport: http(rpcUrl) })

  // Check tokenIn balance
  const balanceRaw = await publicClient.readContract({
    address: tokenIn.address as Address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [agentWallet.account.address],
  }) as bigint

  const balance = parseFloat(formatUnits(balanceRaw, tokenIn.decimals))
  const amountInUsd = Math.min(sizing.size_usd, balance > 0 ? balance : sizing.size_usd)

  if (balance < 1) {
    return {
      tx_hash: null, status: 'failed',
      amount_in_usd: amountInUsd, token_in: tokenIn.symbol, token_out: tokenOut.symbol,
      chain_id: chainConfig.chain.id,
      error: `Insufficient ${tokenIn.symbol} balance (${balance.toFixed(4)}). Fund the agent wallet first.`,
    }
  }

  const amountIn = parseUnits(Math.min(amountInUsd, balance).toFixed(tokenIn.decimals), tokenIn.decimals)

  // Approve if needed (V3)
  const routerAddress = router.routerAddress as Address
  const allowance = await publicClient.readContract({
    address: tokenIn.address as Address,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [agentWallet.account.address, routerAddress],
  }) as bigint

  if (allowance < amountIn) {
    const approveTx = await walletClient.writeContract({
      address: tokenIn.address as Address,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [routerAddress, amountIn * 10n],
    })
    await publicClient.waitForTransactionReceipt({ hash: approveTx })
  }

  // SwapRouter02 exactInputSingle — deadline removed in V3 SwapRouter02
  const txHash = await walletClient.writeContract({
    address: routerAddress,
    abi: SWAP_ROUTER_ABI,
    functionName: 'exactInputSingle',
    args: [{
      tokenIn: tokenIn.address as Address,
      tokenOut: tokenOut.address as Address,
      fee: 3000,
      recipient: agentWallet.account.address,
      amountIn,
      amountOutMinimum: withSlippage(amountIn),
      sqrtPriceLimitX96: 0n,
    }],
  })

  return {
    tx_hash: txHash,
    status: 'submitted',
    amount_in_usd: amountInUsd,
    token_in: tokenIn.symbol,
    token_out: tokenOut.symbol,
    chain_id: chainConfig.chain.id,
  }
}

// ── V2 execution path (0G DEX) ────────────────────────────────────────────────

async function executeV2Swap(
  decision: 'BUY' | 'SELL',
  ticker: string,
  sizing: RiskSizing,
  agentWallet: { address: string; account: import('viem/accounts').PrivateKeyAccount },
  chainConfig: ReturnType<typeof getChainConfig>,
): Promise<ExecutionAgentResult> {
  const router = chainConfig.dexRouters.find((r) => r.type === 'uniswapV2')
  if (!router || isPlaceholderAddress(router.routerAddress)) {
    return {
      tx_hash: null,
      status: 'pending_deployment',
      amount_in_usd: sizing.size_usd,
      token_in: decision === 'BUY' ? 'USDC' : resolveTokenSymbol(ticker),
      token_out: decision === 'BUY' ? resolveTokenSymbol(ticker) : 'USDC',
      chain_id: chainConfig.chain.id,
      error: `0G DEX router not yet deployed. Trade queued — update lib/chain-registry/chains/zerog.ts with live router address to enable execution.`,
    }
  }

  const tokenSymbol = resolveTokenSymbol(ticker)
  const stableSymbol = 'USDC'

  const tokenInfo = chainConfig.tokens[tokenSymbol]
  const stableInfo = chainConfig.tokens[stableSymbol]

  if (!tokenInfo || isPlaceholderAddress(tokenInfo.address)) {
    return {
      tx_hash: null, status: 'pending_deployment',
      amount_in_usd: sizing.size_usd,
      token_in: decision === 'BUY' ? stableSymbol : tokenSymbol,
      token_out: decision === 'BUY' ? tokenSymbol : stableSymbol,
      chain_id: chainConfig.chain.id,
      error: `Token ${tokenSymbol} address not yet deployed on chain ${chainConfig.chain.id}.`,
    }
  }

  const [tokenIn, tokenOut] = decision === 'BUY'
    ? [stableInfo ?? tokenInfo, tokenInfo]
    : [tokenInfo, stableInfo ?? tokenInfo]

  const rpcUrl = chainConfig.chain.rpcUrls.default.http[0]
  const publicClient = createPublicClient({ chain: chainConfig.chain, transport: http(rpcUrl) })
  const walletClient = createWalletClient({ account: agentWallet.account, chain: chainConfig.chain, transport: http(rpcUrl) })

  const balanceRaw = await publicClient.readContract({
    address: tokenIn.address as Address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [agentWallet.account.address],
  }) as bigint

  const balance = parseFloat(formatUnits(balanceRaw, tokenIn.decimals))
  const amountInUsd = Math.min(sizing.size_usd, balance)

  if (balance < 1) {
    return {
      tx_hash: null, status: 'failed',
      amount_in_usd: amountInUsd, token_in: tokenIn.symbol, token_out: tokenOut.symbol,
      chain_id: chainConfig.chain.id,
      error: `Insufficient ${tokenIn.symbol} balance on 0G chain.`,
    }
  }

  const amountIn = parseUnits(Math.min(amountInUsd, balance).toFixed(tokenIn.decimals), tokenIn.decimals)
  const routerAddress = router.routerAddress as Address
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800)

  // Approve
  const allowance = await publicClient.readContract({
    address: tokenIn.address as Address,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [agentWallet.account.address, routerAddress],
  }) as bigint

  if (allowance < amountIn) {
    const approveTx = await walletClient.writeContract({
      address: tokenIn.address as Address,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [routerAddress, amountIn * 10n],
    })
    await publicClient.waitForTransactionReceipt({ hash: approveTx })
  }

  const txHash = await walletClient.writeContract({
    address: routerAddress,
    abi: UNISWAPV2_ROUTER_ABI,
    functionName: 'swapExactTokensForTokens',
    args: [amountIn, withSlippage(amountIn), [tokenIn.address as Address, tokenOut.address as Address], agentWallet.account.address, deadline],
  })

  return {
    tx_hash: txHash,
    status: 'submitted',
    amount_in_usd: amountInUsd,
    token_in: tokenIn.symbol,
    token_out: tokenOut.symbol,
    chain_id: chainConfig.chain.id,
  }
}

// ── Jaine V3 execution path (0G W0G/USDC.e) ───────────────────────────────────

async function executeJaineSwap(
  decision: 'BUY' | 'SELL',
  ticker: string,
  sizing: RiskSizing,
  agentWallet: { address: string; account: import('viem/accounts').PrivateKeyAccount },
  chainConfig: ReturnType<typeof getChainConfig>,
): Promise<ExecutionAgentResult> {
  if (!isJaineTicker(ticker)) {
    const tokenSymbol = resolveTokenSymbol(ticker)
    return {
      tx_hash: null,
      status: 'skipped',
      amount_in_usd: sizing.size_usd,
      token_in: decision === 'BUY' ? 'USDC.e' : tokenSymbol,
      token_out: decision === 'BUY' ? tokenSymbol : 'USDC.e',
      chain_id: chainConfig.chain.id,
      error: 'Jaine agent execution currently supports the W0G/USDC.e market only.',
    }
  }

  const market = await getDexMarket(JAINE_MARKET_ID)
  const rpcUrl = chainConfig.chain.rpcUrls.default.http[0]
  const result = await executeJaineAgentSwap({
    account: agentWallet.account,
    chain: chainConfig.chain,
    rpcUrl,
    decision,
    sizeUsd: sizing.size_usd,
    priceUsd: market.priceUsd,
  })

  return {
    tx_hash: result.txHash,
    status: 'submitted',
    amount_in_usd: result.amountInUsd,
    token_in: result.tokenIn,
    token_out: result.tokenOut,
    chain_id: chainConfig.chain.id,
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Builds and submits an on-chain swap for the given decision and sizing.
 *
 * @param ticker     Target asset ticker (e.g. "BTC", "ETH")
 * @param decision   "BUY" or "SELL"
 * @param sizing     RiskSizing output from the Risk Agent
 * @param userWallet Authenticated user's wallet address
 * @param chainId    Target chain (default: 0G = 16600)
 */
export async function runExecutionAgent(
  ticker: string,
  decision: 'BUY' | 'SELL',
  sizing: RiskSizing,
  userWallet: string,
  chainId: number,
  emit: (event: RunEvent) => void,
  run_id: string,
): Promise<ExecutionAgentResult> {
  emit({
    type: 'agent.thinking',
    run_id,
    ts: new Date().toISOString(),
    agent: 'execution',
    message: `Preparing ${decision} swap for ${ticker.toUpperCase()} ($${sizing.size_usd})…`,
  })

  emit({
    type: 'execution.pending',
    run_id,
    ts: new Date().toISOString(),
    agent: 'execution',
    message: `Signing swap transaction on chain ${chainId}…`,
    payload: { decision, ticker, size_usd: sizing.size_usd, chain_id: chainId },
  })

  let result: ExecutionAgentResult

  try {
    const agentWallet = await getOrCreateAgentWallet(userWallet, chainId)
    const chainConfig = getChainConfig(chainId)

    if (chainConfig.chain.id === JAINE_CHAIN_ID) {
      result = await executeJaineSwap(decision, ticker, sizing, agentWallet, chainConfig)
    } else {
      // Dispatch to V2 or V3 based on the chain's primary router type
      const primaryRouter = chainConfig.dexRouters[0]
      if (primaryRouter?.type === 'uniswapV2') {
        result = await executeV2Swap(decision, ticker, sizing, agentWallet, chainConfig)
      } else {
        result = await executeV3Swap(decision, ticker, sizing, agentWallet, chainConfig)
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    result = {
      tx_hash: null,
      status: 'failed',
      amount_in_usd: sizing.size_usd,
      token_in: decision === 'BUY' ? 'USDC' : resolveTokenSymbol(ticker),
      token_out: decision === 'BUY' ? resolveTokenSymbol(ticker) : 'USDC',
      chain_id: chainId,
      error: errMsg,
    }
  }

  const messageMap: Record<ExecutionAgentResult['status'], string> = {
    submitted: `Swap submitted — tx ${result.tx_hash?.slice(0, 10)}… · ${result.token_in} → ${result.token_out} ($${result.amount_in_usd})`,
    pending_deployment: `DEX not yet deployed on chain ${chainId}. ${result.error}`,
    failed: `Execution failed: ${result.error}`,
    skipped: `Execution skipped.`,
  }

  emit({
    type: 'execution.done',
    run_id,
    ts: new Date().toISOString(),
    agent: 'execution',
    message: messageMap[result.status],
    payload: { ...result },
  })

  return result
}
