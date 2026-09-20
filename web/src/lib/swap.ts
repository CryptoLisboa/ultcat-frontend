import type { Address } from "viem";
import { routerAbi, erc20Abi } from "./abis";
import {
  ULTCAT_ADDRESS,
  VVS_ROUTER_ADDRESS,
  WCRO_ADDRESS,
} from "./constants";

const BPS_DENOM = 10_000n;
const FEE_NUM = 997n;
const FEE_DENOM = 1000n;

export function applySlippage(amountOut: bigint, slippageBps: number): bigint {
  if (slippageBps < 0) throw new Error("slippageBps must be >= 0");
  return (amountOut * (BPS_DENOM - BigInt(slippageBps))) / BPS_DENOM;
}

/** UniV2 0.3% fee: execution price vs mid price, in basis points. */
export function priceImpactBps(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
): number {
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) return 0;

  const amountInWithFee = amountIn * FEE_NUM;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * FEE_DENOM + amountInWithFee;
  const amountOut = numerator / denominator;

  // impact = 1 - (amountOut/amountIn) / (reserveOut/reserveIn)
  //        = (amountIn * reserveOut - amountOut * reserveIn) / (amountIn * reserveOut)
  const midNumerator = amountIn * reserveOut;
  const execNumerator = amountOut * reserveIn;
  if (midNumerator <= execNumerator) return 0;

  return Number(((midNumerator - execNumerator) * BPS_DENOM) / midNumerator);
}

export function deadlineFromNow(nowSec: number, minutes = 20): bigint {
  return BigInt(nowSec + minutes * 60);
}

export type BuildBuyParams = {
  amountIn: bigint;
  minOut: bigint;
  to: Address;
  deadline: bigint;
};

export function buildBuy({ amountIn, minOut, to, deadline }: BuildBuyParams) {
  return {
    address: VVS_ROUTER_ADDRESS,
    abi: routerAbi,
    functionName: "swapExactETHForTokens" as const,
    args: [minOut, [WCRO_ADDRESS, ULTCAT_ADDRESS] as const, to, deadline] as const,
    value: amountIn,
  };
}

export type BuildSellParams = {
  amountIn: bigint;
  minOut: bigint;
  to: Address;
  deadline: bigint;
};

export function buildSell({ amountIn, minOut, to, deadline }: BuildSellParams) {
  return {
    address: VVS_ROUTER_ADDRESS,
    abi: routerAbi,
    functionName: "swapExactTokensForETH" as const,
    args: [
      amountIn,
      minOut,
      [ULTCAT_ADDRESS, WCRO_ADDRESS] as const,
      to,
      deadline,
    ] as const,
  };
}

export function buildApprove(amount: bigint) {
  return {
    address: ULTCAT_ADDRESS,
    abi: erc20Abi,
    functionName: "approve" as const,
    args: [VVS_ROUTER_ADDRESS, amount] as const,
  };
}
