import { BaseNode } from '../BaseNode'
import type { ConfigField, ExecutionContext, HandleDef } from '@/types/agent-builder-canvas'
import { ethers } from 'ethers'
import { getChainConfig, getDefaultChainId } from '@/lib/chain-registry'
import {
  JAINE_DEX_ID,
  JAINE_DEX_NAME,
  JAINE_MARKET_ID,
  isJaineTokenPair,
} from '@/lib/dex/jaine'
import { getDexMarketConfig } from '@/lib/dex/markets'

const ROUTER_ABI = [
  'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
]

const _config = getChainConfig(getDefaultChainId())
const _v1Routers = _config.dexRouters.filter((r) => r.type === 'uniswapV2')
const _jaineRouter = _config.dexRouters.find((r) => r.id === JAINE_DEX_ID)
const _dexNames = [
  ..._v1Routers.map((r) => r.name),
  ...(_jaineRouter ? [_jaineRouter.name] : []),
]
const _defaultDex = _dexNames[0] ?? JAINE_DEX_NAME
const _tokenSymbols = Object.keys(_config.tokens)

function normalizeTokenKey(value: string) {
  if (_config.tokens[value]) return value
  const upper = value.toUpperCase()
  if (upper === 'USDC.E') return 'USDC'
  if (upper === '0G' || upper === 'OG') return 'W0G'
  return value
}

function isJaineDex(value: string) {
  const normalized = value.toLowerCase()
  return normalized === JAINE_DEX_ID || normalized === JAINE_DEX_NAME.toLowerCase()
}

async function fetchJainePriceUsd() {
  const fallback = getDexMarketConfig(JAINE_MARKET_ID).fallback.priceUsd

  try {
    const response = await fetch(`/api/dex/markets?id=${encodeURIComponent(JAINE_MARKET_ID)}`)
    if (!response.ok) return fallback

    const payload = (await response.json()) as { market?: { priceUsd?: number } }
    const price = payload.market?.priceUsd
    return typeof price === 'number' && Number.isFinite(price) && price > 0 ? price : fallback
  } catch {
    return fallback
  }
}

export class DEXPriceNode extends BaseNode {
  readonly type = 'dex_price'
  readonly label = 'DEX Price'
  readonly description = `Gets swap quote from ${_dexNames.join(' or ') || JAINE_DEX_NAME}`
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
      options: _dexNames.length ? _dexNames : [JAINE_DEX_NAME],
      default: _defaultDex,
    },
    {
      key: 'tokenIn',
      label: 'Token In',
      type: 'select',
      options: _tokenSymbols,
      default: 'W0G',
    },
    {
      key: 'tokenOut',
      label: 'Token Out',
      type: 'select',
      options: _tokenSymbols,
      default: 'USDC',
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
    const dex = (this.config.dex as string) || _defaultDex
    const tokenInKey = normalizeTokenKey((this.config.tokenIn as string) || 'W0G')
    const tokenOutKey = normalizeTokenKey((this.config.tokenOut as string) || 'USDC')
    const amountIn = (this.config.amountIn as number) || 1
    const inToken = _config.tokens[tokenInKey]
    const outToken = _config.tokens[tokenOutKey]

    if (!inToken || !outToken) throw new Error('Unknown token')

    context.addLog(
      `[DEXPrice] Getting ${dex} quote: ${amountIn} ${inToken.symbol} -> ${outToken.symbol}`,
    )

    if (isJaineDex(dex)) {
      if (!isJaineTokenPair(inToken.address, outToken.address)) {
        throw new Error('Jaine currently supports the W0G/USDC.e market in this app.')
      }

      const priceUsd = await fetchJainePriceUsd()
      const price = tokenInKey === 'W0G' ? priceUsd : 1 / priceUsd

      context.addLog(`[DEXPrice] 1 ${inToken.symbol} = ${price} ${outToken.symbol} on ${dex}`)
      return { price }
    }

    const routerEntry = _v1Routers.find((r) => r.name === dex)
    if (!routerEntry) throw new Error(`Unknown DEX: ${dex}`)

    const provider = context.provider as ethers.BrowserProvider
    const router = new ethers.Contract(routerEntry.routerAddress, ROUTER_ABI, provider)
    const amountInWei = ethers.parseUnits(amountIn.toString(), inToken.decimals)
    const amounts = await router.getAmountsOut(amountInWei, [inToken.address, outToken.address])
    const amountOut = parseFloat(ethers.formatUnits(amounts[1], outToken.decimals))
    const price = amountOut / amountIn

    context.addLog(`[DEXPrice] 1 ${inToken.symbol} = ${price} ${outToken.symbol} on ${dex}`)
    return { price }
  }
}
