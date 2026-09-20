import { describe, expect, it } from "vitest";
import {
  ULTCAT_ADDRESS,
  VVS_ROUTER_ADDRESS,
  WCRO_ADDRESS,
} from "./constants";
import {
  applySlippage,
  buildApprove,
  buildBuy,
  buildSell,
  deadlineFromNow,
  priceImpactBps,
} from "./swap";

describe("applySlippage", () => {
  it("applies bps with integer flooring", () => {
    expect(applySlippage(1_000_000n, 300)).toBe(970_000n);
    expect(applySlippage(100n, 1)).toBe(99n);
    // 99 * 9999 / 10000 = 98 (floors)
    expect(applySlippage(99n, 1)).toBe(98n);
  });

  it("zero slippage returns amount unchanged", () => {
    expect(applySlippage(12345n, 0)).toBe(12345n);
  });
});

describe("priceImpactBps", () => {
  it("computes impact on known UniV2 reserves", () => {
    // Mid: 1e18 in -> 2e18 out spot. Small trade has small impact + 0.3% fee.
    const reserveIn = 1_000_000n * 10n ** 18n;
    const reserveOut = 2_000_000n * 10n ** 18n;
    const amountIn = 1_000n * 10n ** 18n; // 0.1% of pool

    const impact = priceImpactBps(amountIn, reserveIn, reserveOut);
    // Fee alone ≈ 30 bps; tiny size adds ~1 bps → roughly 30–35 bps
    expect(impact).toBeGreaterThanOrEqual(30);
    expect(impact).toBeLessThan(40);
  });

  it("larger trades have higher impact", () => {
    const reserveIn = 100_000n * 10n ** 18n;
    const reserveOut = 100_000n * 10n ** 18n;
    const small = priceImpactBps(100n * 10n ** 18n, reserveIn, reserveOut);
    const large = priceImpactBps(10_000n * 10n ** 18n, reserveIn, reserveOut);
    expect(large).toBeGreaterThan(small);
  });

  it("returns 0 for empty inputs", () => {
    expect(priceImpactBps(0n, 1n, 1n)).toBe(0);
    expect(priceImpactBps(1n, 0n, 1n)).toBe(0);
  });
});

describe("deadlineFromNow", () => {
  it("adds default 20 minutes", () => {
    expect(deadlineFromNow(1_000_000)).toBe(1_000_000n + 1200n);
  });

  it("accepts custom minutes", () => {
    expect(deadlineFromNow(100, 5)).toBe(400n);
  });
});

describe("builders", () => {
  const to = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const;
  const deadline = 1_700_000_000n;

  it("buildBuy uses swapExactETHForTokens with WCRO→ULTCAT path", () => {
    const tx = buildBuy({
      amountIn: 100n * 10n ** 18n,
      minOut: 50n,
      to,
      deadline,
    });
    expect(tx.address).toBe(VVS_ROUTER_ADDRESS);
    expect(tx.functionName).toBe("swapExactETHForTokens");
    expect(tx.value).toBe(100n * 10n ** 18n);
    expect(tx.args[0]).toBe(50n);
    expect(tx.args[1]).toEqual([WCRO_ADDRESS, ULTCAT_ADDRESS]);
    expect(tx.args[2]).toBe(to);
    expect(tx.args[3]).toBe(deadline);
  });

  it("buildSell uses swapExactTokensForETH with ULTCAT→WCRO path", () => {
    const tx = buildSell({
      amountIn: 10n * 10n ** 18n,
      minOut: 1n,
      to,
      deadline,
    });
    expect(tx.address).toBe(VVS_ROUTER_ADDRESS);
    expect(tx.functionName).toBe("swapExactTokensForETH");
    expect(tx.args[0]).toBe(10n * 10n ** 18n);
    expect(tx.args[1]).toBe(1n);
    expect(tx.args[2]).toEqual([ULTCAT_ADDRESS, WCRO_ADDRESS]);
    expect(tx.args[3]).toBe(to);
    expect(tx.args[4]).toBe(deadline);
  });

  it("buildApprove targets ULTCAT approve(ROUTER, amount)", () => {
    const tx = buildApprove(42n);
    expect(tx.address).toBe(ULTCAT_ADDRESS);
    expect(tx.functionName).toBe("approve");
    expect(tx.args[0]).toBe(VVS_ROUTER_ADDRESS);
    expect(tx.args[1]).toBe(42n);
  });
});
