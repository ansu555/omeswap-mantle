import { BaseNode } from '../BaseNode'
import type { HandleDef, ConfigField, ExecutionContext } from '@/types'
import { ethers } from 'ethers'
import { getChainConfig, getDefaultChainId } from '../../../../lib/chain-registry'

const ROUTER_ABI = [
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapExactAVAXForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
  'function swapExactTokensForAVAX(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
]

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
]

// Resolved once at module load from the chain registry
const _config = getChainConfig(getDefaultChainId())
const _nativeSymbol = _config.chain.nativeCurrency.symbol
const _v1Routers = _config.dexRouters.filter((r) => r.type === 'uniswapV2')
const _dexNames = _v1Routers.map((r) => r.name)
const _tokenSymbols = Object.keys(_config.tokens)

export class SwapNode extends BaseNode {
  readonly type = 'swap'
  readonly label = 'Swap'
  readonly description = `Executes a token swap on ${_dexNames.join(' or ')}`
  readonly icon = 'Repeat2'
  readonly category = 'action' as const
  readonly color = 'border-green-500'
  readonly bgColor = 'bg-green-950'

  readonly handles: HandleDef[] = [
    { id: 'signal', label: 'Execute', position: 'left', type: 'target', dataType: 'signal' },
    { id: 'txHash', label: 'Tx Hash', position: 'right', type: 'source', dataType: 'string' },
  ]

  readonly configSchema: ConfigField[] = [
    {
      key: 'dex',
      label: 'DEX',
      type: 'select',
      options: _dexNames,
      default: _dexNames[0],
    },
    {
      key: 'tokenIn',
      label: 'Token In',
      type: 'select',
      // native coin uses swapExactAVAXForTokens, no approval needed
      options: [_nativeSymbol, ..._tokenSymbols],
      default: _nativeSymbol,
    },
    {
      key: 'tokenOut',
      label: 'Token Out',
      type: 'select',
      options: _tokenSymbols,
      default: 'USDC.e',
    },
    {
      key: 'amountIn',
      label: 'Amount In',
      type: 'number',
      default: 0.1,
    },
    {
      key: 'slippage',
      label: 'Slippage %',
      type: 'number',
      default: 0.5,
    },
  ]

  async execute(
    inputs: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<Record<string, unknown>> {
    if (!inputs.signal) {
      context.addLog('[Swap] Skipped: no execution signal received', 'warn')
      return { txHash: null }
    }
    if (!context.signer || !context.walletAddress) throw new Error('Wallet not connected')

    const dex = (this.config.dex as string) || _dexNames[0]
    const tokenIn = (this.config.tokenIn as string) || _nativeSymbol
    const tokenOut = (this.config.tokenOut as string) || 'USDC.e'
    const configuredAmount = this.config.amountIn ?? this.config.amount ?? 0.1
    const amountIn = Number(configuredAmount)
    const slippage = (this.config.slippage as number) || 0.5

    if (!Number.isFinite(amountIn) || amountIn <= 0) {
      throw new Error('Swap amount must be greater than 0')
    }

    const routerEntry = _v1Routers.find((r) => r.name === dex)
    if (!routerEntry) throw new Error(`Unknown DEX: ${dex}`)
    const routerAddress = routerEntry.routerAddress

    const outToken = _config.tokens[tokenOut]
    if (!outToken) throw new Error(`Unknown token out: ${tokenOut}`)

    const signer = context.signer as ethers.Signer
    const router = new ethers.Contract(routerAddress, ROUTER_ABI, signer)
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20
    const slippageBps = BigInt(Math.floor((1 - slippage / 100) * 10000))

    context.addLog(`[Swap] ${amountIn} ${tokenIn} → ${tokenOut} on ${dex} (slippage: ${slippage}%)`)

    let tx

    // ── Path A: native coin → ERC-20 (swapExactAVAXForTokens) ──────────────
    if (tokenIn === _nativeSymbol) {
      const amountInWei = ethers.parseEther(amountIn.toString())
      const path = [_config.nativeWrapped, outToken.address]
      const amounts = await router.getAmountsOut(amountInWei, path)
      const amountOutMin = (amounts[1] * slippageBps) / BigInt(10000)

      tx = await router.swapExactAVAXForTokens(
        amountOutMin,
        path,
        context.walletAddress,
        deadline,
        { value: amountInWei }
      )

    // ── Path B: ERC-20 → ERC-20 (swapExactTokensForTokens) ─────────────────
    } else {
      const inToken = _config.tokens[tokenIn]
      if (!inToken) throw new Error(`Unknown token in: ${tokenIn}`)

      const amountInWei = ethers.parseUnits(amountIn.toString(), inToken.decimals)
      const path = [inToken.address, outToken.address]
      const amounts = await router.getAmountsOut(amountInWei, path)
      const amountOutMin = (amounts[1] * slippageBps) / BigInt(10000)

      // Approve if allowance is insufficient
      const tokenContract = new ethers.Contract(inToken.address, ERC20_ABI, signer)
      const allowance = await tokenContract.allowance(context.walletAddress, routerAddress)
      if (allowance < amountInWei) {
        context.addLog(`[Swap] Approving ${tokenIn}...`)
        const approveTx = await tokenContract.approve(routerAddress, ethers.MaxUint256)
        await approveTx.wait()
        context.addLog(`[Swap] Approved`)
      }

      tx = await router.swapExactTokensForTokens(
        amountInWei,
        amountOutMin,
        path,
        context.walletAddress,
        deadline
      )
    }

    context.addLog(`[Swap] Tx submitted: ${tx.hash}`)
    await tx.wait()
    context.addLog(`[Swap] Confirmed!`)

    return { txHash: tx.hash }
  }
}
