/**
 * POST /api/agent-builder/swap
 *
 * Executes a token swap using the caller's server-managed agent wallet.
 * The agent wallet private key is decrypted on the server and never sent
 * to the client.
 *
 * Body: { dex, tokenIn, tokenOut, amountIn, slippage? }
 * Auth: x-wallet-address header (user's connected wallet, identifies agent wallet)
 */

import { type NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

import { requireWallet } from "@/lib/marketplace/wallet-header";
import { getOrCreateAgentWallet } from "@/lib/agent-wallet/manager";
import { getChainConfig } from "@/lib/chain-registry";
import { getDexMarketConfig } from "@/lib/dex/markets";
import {
  JAINE_CHAIN_ID,
  JAINE_DEX_ID,
  JAINE_DEX_NAME,
  JAINE_MARKET_ID,
  JAINE_POOL_FEE,
  JAINE_V3_ROUTER_ADDRESS,
  JAINE_W0G_ADDRESS,
  isJaineTokenPair,
} from "@/lib/dex/jaine";

// ── ABIs ─────────────────────────────────────────────────────────────────────

const ROUTER_ABI = [
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
  "function swapExactAVAXForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
  "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)",
];

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
];

const JAINE_ROUTER_ABI = [
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) external payable returns (uint256 amountOut)",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function isJaineDex(value: string) {
  const n = value.toLowerCase();
  return n === JAINE_DEX_ID || n === JAINE_DEX_NAME.toLowerCase();
}

function decimalString(value: number, decimals: number) {
  if (!Number.isFinite(value) || value <= 0) return "0";
  return value.toFixed(Math.min(decimals, 18));
}

function formatTokenAmount(value: bigint, decimals: number) {
  const [whole, fraction = ""] = ethers.formatUnits(value, decimals).split(".");
  const trimmed = fraction.replace(/0+$/, "").slice(0, 6);
  return trimmed ? `${whole}.${trimmed}` : whole;
}

async function fetchJainePriceUsd(): Promise<number> {
  const fallback = getDexMarketConfig(JAINE_MARKET_ID).fallback.priceUsd;
  try {
    const res = await fetch(
      `https://api.geckoterminal.com/api/v2/networks/0g/pools/${JAINE_MARKET_ID}`,
      { next: { revalidate: 30 } },
    );
    if (!res.ok) return fallback;
    const json = (await res.json()) as { data?: { attributes?: { base_token_price_usd?: string } } };
    const price = parseFloat(json.data?.attributes?.base_token_price_usd ?? "");
    return Number.isFinite(price) && price > 0 ? price : fallback;
  } catch {
    return fallback;
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const userWallet = requireWallet(req);
  if (userWallet instanceof Response) return userWallet;

  let body: { dex?: string; tokenIn?: string; tokenOut?: string; amountIn?: number; slippage?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { dex = JAINE_DEX_NAME, tokenIn = "USDC", tokenOut = "W0G" } = body;
  const amountIn = Number(body.amountIn ?? 0);
  const slippage = Number(body.slippage ?? 0.5);

  if (!Number.isFinite(amountIn) || amountIn <= 0) {
    return NextResponse.json({ error: "amountIn must be > 0" }, { status: 400 });
  }

  try {
    const chainId = isJaineDex(dex) ? JAINE_CHAIN_ID : JAINE_CHAIN_ID;
    const { privateKey, address: agentAddress } = await getOrCreateAgentWallet(userWallet, chainId);

    const chainConfig = getChainConfig(chainId);
    const rpcUrl = chainConfig.chain.rpcUrls.default.http[0];
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const signer = new ethers.Wallet(privateKey, provider);

    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
    const slippageBps = BigInt(Math.floor((1 - slippage / 100) * 10000));
    const nativeSymbol = chainConfig.chain.nativeCurrency.symbol;

    const outToken = chainConfig.tokens[tokenOut];
    if (!outToken) {
      return NextResponse.json({ error: `Unknown tokenOut: ${tokenOut}` }, { status: 400 });
    }

    let txHash: string;

    if (isJaineDex(dex)) {
      const router = new ethers.Contract(JAINE_V3_ROUTER_ADDRESS, JAINE_ROUTER_ABI, signer);
      const priceUsd = await fetchJainePriceUsd();

      if (tokenIn === nativeSymbol || tokenIn === "0G") {
        // Native 0G → W0G: simple WETH9-style wrap via deposit()
        if (tokenOut === "W0G") {
          const amountInWei = ethers.parseEther(amountIn.toString());
          const nativeBalance = await provider.getBalance(agentAddress);
          if (nativeBalance < amountInWei) {
            return NextResponse.json(
              { error: `Agent wallet has insufficient 0G: need ${amountIn}, have ${formatTokenAmount(nativeBalance, 18)}` },
              { status: 400 },
            );
          }
          const w0g = new ethers.Contract(
            JAINE_W0G_ADDRESS,
            ["function deposit() external payable"],
            signer,
          );
          const tx = await w0g.deposit({ value: amountInWei });
          await tx.wait();
          txHash = tx.hash;
          return NextResponse.json({ txHash, agentAddress });
        }

        // Native 0G → USDC.e via Jaine (only valid non-wrap target)
        if (tokenOut !== "USDC") {
          return NextResponse.json(
            { error: "Native 0G on Jaine supports W0G (wrap) or USDC.e only" },
            { status: 400 },
          );
        }
        const amountInWei = ethers.parseEther(amountIn.toString());
        const nativeBalance = await provider.getBalance(agentAddress);
        if (nativeBalance < amountInWei) {
          return NextResponse.json(
            {
              error: `Agent wallet has insufficient 0G: need ${amountIn}, have ${formatTokenAmount(nativeBalance, 18)}`,
            },
            { status: 400 },
          );
        }
        const estimatedOut = amountIn * priceUsd;
        const amountOutMin = ethers.parseUnits(
          decimalString(estimatedOut * (1 - slippage / 100), outToken.decimals),
          outToken.decimals,
        );
        const tx = await router.exactInputSingle(
          {
            tokenIn: JAINE_W0G_ADDRESS,
            tokenOut: outToken.address,
            fee: JAINE_POOL_FEE,
            recipient: agentAddress,
            deadline,
            amountIn: amountInWei,
            amountOutMinimum: amountOutMin,
            sqrtPriceLimitX96: 0n,
          },
          { value: amountInWei },
        );
        await tx.wait();
        txHash = tx.hash;
      } else {
        // ERC-20 path: W0G ↔ USDC.e
        const inToken = chainConfig.tokens[tokenIn];
        if (!inToken) {
          return NextResponse.json({ error: `Unknown tokenIn: ${tokenIn}` }, { status: 400 });
        }
        if (!isJaineTokenPair(inToken.address, outToken.address)) {
          return NextResponse.json(
            { error: "Jaine supports W0G/USDC.e swaps only" },
            { status: 400 },
          );
        }
        const amountInWei = ethers.parseUnits(amountIn.toString(), inToken.decimals);
        const estimatedOut = tokenIn === "W0G" ? amountIn * priceUsd : amountIn / priceUsd;
        const amountOutMin = ethers.parseUnits(
          decimalString(estimatedOut * (1 - slippage / 100), outToken.decimals),
          outToken.decimals,
        );

        const tokenContract = new ethers.Contract(inToken.address, ERC20_ABI, signer);
        const [balance, allowance] = await Promise.all([
          tokenContract.balanceOf(agentAddress) as Promise<bigint>,
          tokenContract.allowance(agentAddress, JAINE_V3_ROUTER_ADDRESS) as Promise<bigint>,
        ]);
        if (balance < amountInWei) {
          return NextResponse.json(
            {
              error: `Agent wallet has insufficient ${inToken.symbol}: need ${amountIn}, have ${formatTokenAmount(balance, inToken.decimals)}`,
            },
            { status: 400 },
          );
        }
        if (allowance < amountInWei) {
          const approveTx = await tokenContract.approve(JAINE_V3_ROUTER_ADDRESS, ethers.MaxUint256);
          await approveTx.wait();
        }

        const tx = await router.exactInputSingle({
          tokenIn: inToken.address,
          tokenOut: outToken.address,
          fee: JAINE_POOL_FEE,
          recipient: agentAddress,
          deadline,
          amountIn: amountInWei,
          amountOutMinimum: amountOutMin,
          sqrtPriceLimitX96: 0n,
        });
        await tx.wait();
        txHash = tx.hash;
      }
    } else {
      // Generic V2 router path
      const v1Routers = chainConfig.dexRouters.filter((r) => r.type === "uniswapV2");
      const routerEntry = v1Routers.find((r) => r.name === dex);
      if (!routerEntry) {
        return NextResponse.json({ error: `Unknown DEX: ${dex}` }, { status: 400 });
      }
      const router = new ethers.Contract(routerEntry.routerAddress, ROUTER_ABI, signer);

      if (tokenIn === nativeSymbol || tokenIn === "0G") {
        const amountInWei = ethers.parseEther(amountIn.toString());
        const path = [chainConfig.nativeWrapped, outToken.address];
        const amounts = await router.getAmountsOut(amountInWei, path);
        const amountOutMin = (amounts[1] * slippageBps) / BigInt(10000);
        const tx = await router.swapExactAVAXForTokens(
          amountOutMin,
          path,
          agentAddress,
          deadline,
          { value: amountInWei },
        );
        await tx.wait();
        txHash = tx.hash;
      } else {
        const inToken = chainConfig.tokens[tokenIn];
        if (!inToken) {
          return NextResponse.json({ error: `Unknown tokenIn: ${tokenIn}` }, { status: 400 });
        }
        const amountInWei = ethers.parseUnits(amountIn.toString(), inToken.decimals);
        const path = [inToken.address, outToken.address];
        const amounts = await router.getAmountsOut(amountInWei, path);
        const amountOutMin = (amounts[1] * slippageBps) / BigInt(10000);

        const tokenContract = new ethers.Contract(inToken.address, ERC20_ABI, signer);
        const [balance, allowance] = await Promise.all([
          tokenContract.balanceOf(agentAddress) as Promise<bigint>,
          tokenContract.allowance(agentAddress, routerEntry.routerAddress) as Promise<bigint>,
        ]);
        if (balance < amountInWei) {
          return NextResponse.json(
            {
              error: `Agent wallet has insufficient ${inToken.symbol}: need ${amountIn}, have ${formatTokenAmount(balance, inToken.decimals)}`,
            },
            { status: 400 },
          );
        }
        if (allowance < amountInWei) {
          const approveTx = await tokenContract.approve(routerEntry.routerAddress, ethers.MaxUint256);
          await approveTx.wait();
        }
        const tx = await router.swapExactTokensForTokens(
          amountInWei,
          amountOutMin,
          path,
          agentAddress,
          deadline,
        );
        await tx.wait();
        txHash = tx.hash;
      }
    }

    return NextResponse.json({ txHash, agentAddress });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
