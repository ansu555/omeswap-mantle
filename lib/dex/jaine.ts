import {
  createPublicClient,
  createWalletClient,
  formatUnits,
  http,
  parseUnits,
  type Address,
  type Chain,
} from 'viem'
import type { PrivateKeyAccount } from 'viem/accounts'

export const JAINE_CHAIN_ID = 16661
export const JAINE_DEX_ID = 'jaine'
export const JAINE_DEX_NAME = 'Jaine'
export const JAINE_SWAP_URL = 'https://jaine.app/swap'
export const JAINE_W0G_ADDRESS = '0x1cd0690ff9a693f5ef2dd976660a8dafc81a109c' as const
export const JAINE_USDCE_ADDRESS = '0x1f3aa82227281ca364bfb3d253b0f1af1da6473e' as const
export const JAINE_V3_ROUTER_ADDRESS = '0x8b598a7c136215a95ba0282b4d832b9f9801f2e2' as const
export const JAINE_POOL_FEE = 10_000
export const JAINE_MARKET_ID = '0g-w0g-usdce'
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const

export const JAINE_ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

export const JAINE_V3_ROUTER_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'recipient', type: 'address' },
          { name: 'deadline', type: 'uint256' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'exactInputSingle',
    outputs: [{ name: 'amountOut', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
] as const

type JaineToken = {
  address: Address
  symbol: 'W0G' | 'USDC.e'
  decimals: 18 | 6
}

export type JaineTradePlan = {
  tokenIn: JaineToken
  tokenOut: JaineToken
  amountIn: bigint
  amountOutMinimum: bigint
  amountInUsd: number
}

const W0G: JaineToken = {
  address: JAINE_W0G_ADDRESS,
  symbol: 'W0G',
  decimals: 18,
}

const USDCE: JaineToken = {
  address: JAINE_USDCE_ADDRESS,
  symbol: 'USDC.e',
  decimals: 6,
}

export function isJaineTicker(ticker: string): boolean {
  return ['W0G', '0G', 'OG', 'ZEROG'].includes(ticker.toUpperCase())
}

export function isJaineTokenPair(tokenIn: string, tokenOut: string): boolean {
  const input = tokenIn.toLowerCase()
  const output = tokenOut.toLowerCase()
  const w0g = JAINE_W0G_ADDRESS.toLowerCase()
  const usdce = JAINE_USDCE_ADDRESS.toLowerCase()

  return (
    (input === w0g && output === usdce) ||
    (input === usdce && output === w0g)
  )
}

export function getJaineTradeTokens(decision: 'BUY' | 'SELL') {
  return decision === 'BUY'
    ? { tokenIn: USDCE, tokenOut: W0G }
    : { tokenIn: W0G, tokenOut: USDCE }
}

export function buildJaineTradePlan({
  decision,
  sizeUsd,
  tokenInBalance,
  priceUsd,
  slippageBps,
}: {
  decision: 'BUY' | 'SELL'
  sizeUsd: number
  tokenInBalance: bigint
  priceUsd: number
  slippageBps: number
}): JaineTradePlan {
  const { tokenIn, tokenOut } = getJaineTradeTokens(decision)
  const balance = parseFloat(formatUnits(tokenInBalance, tokenIn.decimals))
  const slippageMultiplier = Math.max(0, 10_000 - slippageBps) / 10_000

  if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
    throw new Error('W0G market price is unavailable.')
  }

  if (decision === 'BUY') {
    const amountInUsd = Math.min(sizeUsd, balance)
    if (amountInUsd <= 0) throw new Error(`Insufficient ${tokenIn.symbol} balance.`)

    const expectedW0g = amountInUsd / priceUsd
    return {
      tokenIn,
      tokenOut,
      amountIn: parseUnits(amountInUsd.toFixed(tokenIn.decimals), tokenIn.decimals),
      amountOutMinimum: parseUnits((expectedW0g * slippageMultiplier).toFixed(tokenOut.decimals), tokenOut.decimals),
      amountInUsd,
    }
  }

  const amountInW0g = Math.min(sizeUsd / priceUsd, balance)
  if (amountInW0g <= 0) throw new Error(`Insufficient ${tokenIn.symbol} balance.`)

  const amountInUsd = amountInW0g * priceUsd
  return {
    tokenIn,
    tokenOut,
    amountIn: parseUnits(amountInW0g.toFixed(tokenIn.decimals), tokenIn.decimals),
    amountOutMinimum: parseUnits((amountInUsd * slippageMultiplier).toFixed(tokenOut.decimals), tokenOut.decimals),
    amountInUsd,
  }
}

export async function executeJaineAgentSwap({
  account,
  chain,
  rpcUrl,
  decision,
  sizeUsd,
  priceUsd,
  slippageBps = 200,
}: {
  account: PrivateKeyAccount
  chain: Chain
  rpcUrl: string
  decision: 'BUY' | 'SELL'
  sizeUsd: number
  priceUsd: number
  slippageBps?: number
}) {
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) })
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) })
  const { tokenIn } = getJaineTradeTokens(decision)

  const tokenInBalance = await publicClient.readContract({
    address: tokenIn.address,
    abi: JAINE_ERC20_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  }) as bigint

  const plan = buildJaineTradePlan({
    decision,
    sizeUsd,
    tokenInBalance,
    priceUsd,
    slippageBps,
  })

  const allowance = await publicClient.readContract({
    address: plan.tokenIn.address,
    abi: JAINE_ERC20_ABI,
    functionName: 'allowance',
    args: [account.address, JAINE_V3_ROUTER_ADDRESS],
  }) as bigint

  if (allowance < plan.amountIn) {
    const approveTx = await walletClient.writeContract({
      address: plan.tokenIn.address,
      abi: JAINE_ERC20_ABI,
      functionName: 'approve',
      args: [JAINE_V3_ROUTER_ADDRESS, plan.amountIn * 10n],
    })
    await publicClient.waitForTransactionReceipt({ hash: approveTx })
  }

  const txHash = await walletClient.writeContract({
    address: JAINE_V3_ROUTER_ADDRESS,
    abi: JAINE_V3_ROUTER_ABI,
    functionName: 'exactInputSingle',
    args: [
      {
        tokenIn: plan.tokenIn.address,
        tokenOut: plan.tokenOut.address,
        fee: JAINE_POOL_FEE,
        recipient: account.address,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 20 * 60),
        amountIn: plan.amountIn,
        amountOutMinimum: plan.amountOutMinimum,
        sqrtPriceLimitX96: 0n,
      },
    ],
  })

  return {
    txHash,
    amountInUsd: plan.amountInUsd,
    tokenIn: plan.tokenIn.symbol,
    tokenOut: plan.tokenOut.symbol,
  }
}
