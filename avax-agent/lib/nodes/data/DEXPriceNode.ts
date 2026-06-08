import { BaseNode } from '../BaseNode'
import type { HandleDef, ConfigField, ExecutionContext } from '@/types'
import { ethers } from 'ethers'
import { getChainConfig, getDefaultChainId } from '../../../../lib/chain-registry'

const ROUTER_ABI = [
  'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
]

// Resolved once at module load from the chain registry
const _config = getChainConfig(getDefaultChainId())
const _v1Routers = _config.dexRouters.filter((r) => r.type === 'uniswapV2')
const _dexNames = _v1Routers.map((r) => r.name)
const _tokenSymbols = Object.keys(_config.tokens)

export class DEXPriceNode extends BaseNode {
  readonly type = 'dex_price'
  readonly label = 'DEX Price'
  readonly description = `Gets swap quote from ${_dexNames.join(' or ')}`
  readonly icon = 'ArrowLeftRight'
  readonly category = 'data' as const
  readonly color = 'border-blue-500'
  readonly bgColor = 'bg-blue-950'

  readonly handles: HandleDef[] = [
    { id: 'price', label: 'Price', position: 'right', type: 'source', dataType: 'number' },
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
      options: _tokenSymbols,
      default: 'WAVAX',
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
      default: 1,
    },
  ]

  async execute(
    _inputs: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<Record<string, unknown>> {
    const dex = (this.config.dex as string) || _dexNames[0]
    const tokenIn = (this.config.tokenIn as string) || 'WAVAX'
    const tokenOut = (this.config.tokenOut as string) || 'USDC.e'
    const amountIn = (this.config.amountIn as number) || 1

    const routerEntry = _v1Routers.find((r) => r.name === dex)
    if (!routerEntry) throw new Error(`Unknown DEX: ${dex}`)
    const routerAddress = routerEntry.routerAddress

    const inToken = _config.tokens[tokenIn]
    const outToken = _config.tokens[tokenOut]

    if (!inToken || !outToken) throw new Error('Unknown token')

    context.addLog(`[DEXPrice] Getting ${dex} quote: ${amountIn} ${tokenIn} → ${tokenOut}`)

    const provider = context.provider as ethers.BrowserProvider
    const router = new ethers.Contract(routerAddress, ROUTER_ABI, provider)

    const amountInWei = ethers.parseUnits(amountIn.toString(), inToken.decimals)
    const amounts = await router.getAmountsOut(amountInWei, [inToken.address, outToken.address])
    const amountOut = parseFloat(ethers.formatUnits(amounts[1], outToken.decimals))
    const price = amountOut / amountIn

    context.addLog(`[DEXPrice] 1 ${tokenIn} = ${price} ${tokenOut} on ${dex}`)
    return { price }
  }
}
