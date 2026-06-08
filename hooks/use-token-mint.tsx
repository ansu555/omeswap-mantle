"use client";

import { useEffect, useRef } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useChainId,
} from "wagmi";
import { parseEther, formatEther, Address } from "viem";
import { TOKENS } from "@/contracts/config";
import { ERC20ABI } from "@/contracts/abis";
import { getChainConfig, getDefaultChainId } from "@/lib/chain-registry";
import { useTransactionStore } from "@/store/transaction-store";

export function useTokenMint(tokenSymbol: string) {
  const { address } = useAccount();
  const connectedChainId = useChainId();

  const chainConfig = (() => {
    try { return getChainConfig(connectedChainId) }
    catch { return getChainConfig(getDefaultChainId()) }
  })();
  const chainId = chainConfig.chain.id;

  const token = TOKENS[tokenSymbol];

  const {
    writeContractAsync,
    data: hash,
    isPending: isWritePending,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Get token balance
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: token.address as Address,
    abi: ERC20ABI,
    functionName: "balanceOf",
    args: [address as Address],
    chainId,
    query: {
      enabled: !!address,
    },
  });

  // Mint tokens
  const mintAmountRef = useRef("");
  const mint = async (amount: string) => {
    if (!address) return;
    mintAmountRef.current = amount;

    return writeContractAsync({
      address: token.address as Address,
      abi: ERC20ABI,
      functionName: "mint",
      args: [address, parseEther(amount)],
      chainId,
    });
  };

  // Record transaction in store
  const addTransaction = useTransactionStore((s) => s.addTransaction);
  useEffect(() => {
    if (isSuccess && hash && address) {
      addTransaction({
        type: "MINT",
        fromToken: tokenSymbol,
        toToken: tokenSymbol,
        fromAmount: parseFloat(mintAmountRef.current) || 0,
        toAmount: parseFloat(mintAmountRef.current) || 0,
        txHash: hash,
        walletAddress: address,
        timestamp: Date.now(),
        source: "token-mint",
      });
    }
  }, [addTransaction, address, hash, isSuccess, tokenSymbol]);

  return {
    balance: balance ? formatEther(balance as bigint) : "0",
    mint,
    isLoading: isWritePending || isConfirming,
    isSuccess,
    hash,
    refetchBalance,
  };
}

// Hook to mint all tokens at once
export function useBatchMint() {
  const { address } = useAccount();
  const connectedChainId = useChainId();

  const chainConfig = (() => {
    try { return getChainConfig(connectedChainId) }
    catch { return getChainConfig(getDefaultChainId()) }
  })();
  const chainId = chainConfig.chain.id;

  const {
    writeContractAsync,
    data: hash,
    isPending: isWritePending,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const mintAll = async (amount: string = "10000") => {
    if (!address) return;

    for (const token of Object.values(TOKENS)) {
      await writeContractAsync({
        address: token.address as Address,
        abi: ERC20ABI,
        functionName: "mint",
        args: [address, parseEther(amount)],
        chainId,
      });
    }
  };

  return {
    mintAll,
    isLoading: isWritePending || isConfirming,
    isSuccess,
    hash,
  };
}
