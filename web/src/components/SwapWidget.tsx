"use client";

import { AppKitButton, useAppKit } from "@reown/appkit/react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  useBalance,
  useConfig,
  useConnection,
  useReadContract,
  useSimulateContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { simulateContract } from "wagmi/actions";
import { formatUnits, isAddressEqual, parseUnits, type Address } from "viem";
import { erc20Abi, pairAbi, routerAbi } from "../lib/abis";
import {
  CRONOS_CHAIN_ID,
  PAIR_ADDRESS,
  ULTCAT_ADDRESS,
  VVS_ROUTER_ADDRESS,
  WCRO_ADDRESS,
  explorerTxUrl,
} from "../lib/constants";
import {
  applySlippage,
  buildApprove,
  buildBuy,
  buildSell,
  deadlineFromNow,
  priceImpactBps,
} from "../lib/swap";

type Direction = "buy" | "sell";

const GAS_RESERVE = 10n ** 18n; // 1 CRO
const QUOTE_MAX_AGE_MS = 30_000;
const DEBOUNCE_MS = 400;
const DEFAULT_SLIPPAGE_BPS = 300;

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

function subscribeNow(onStoreChange: () => void) {
  const id = setInterval(onStoreChange, 1_000);
  return () => clearInterval(id);
}

function getNow() {
  // Must be stable between calls within a tick; whole seconds is enough for the 30 s freshness check.
  return Math.floor(Date.now() / 1000) * 1000;
}

function getServerNow() {
  return 0;
}

function formatTxError(err: unknown): string {
  const msg =
    err && typeof err === "object" && "shortMessage" in err
      ? String((err as { shortMessage: string }).shortMessage)
      : err instanceof Error
        ? err.message
        : String(err);

  if (/user rejected|user denied|rejected the request/i.test(msg)) {
    return "Transaction rejected.";
  }
  if (/insufficient funds|insufficient balance/i.test(msg)) {
    return "Insufficient funds.";
  }
  if (/INSUFFICIENT_OUTPUT_AMOUNT|slippage/i.test(msg)) {
    return "Price moved past your slippage. Try again or increase slippage.";
  }
  return msg.length > 180 ? `${msg.slice(0, 180)}…` : msg;
}

function clampSlippageBps(bps: number): number {
  return Math.min(4900, Math.max(10, Math.round(bps)));
}

export function SwapWidget() {
  const { open } = useAppKit();
  const config = useConfig();
  // useConnection().chainId is the WALLET's chain. useChainId() returns the config chain and stays 25 when
  // the wallet sits on another network, which would let a swap be signed on the wrong chain.
  const { address, isConnected, chainId } = useConnection();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const now = useSyncExternalStore(subscribeNow, getNow, getServerNow);

  const [direction, setDirection] = useState<Direction>("buy");
  const [amountStr, setAmountStr] = useState("");
  const [debouncedStr, setDebouncedStr] = useState("");
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS);
  const [customSlippage, setCustomSlippage] = useState("");
  const [impactArmed, setImpactArmed] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);
  const [pendingKind, setPendingKind] = useState<"approve" | "swap" | null>(
    null,
  );

  useEffect(() => {
    const t = setTimeout(() => setDebouncedStr(amountStr), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [amountStr]);

  const amountIn = useMemo(() => {
    if (!debouncedStr || !/^\d*\.?\d+$/.test(debouncedStr)) return null;
    try {
      const v = parseUnits(debouncedStr, 18);
      return v > 0n ? v : null;
    } catch {
      return null;
    }
  }, [debouncedStr]);

  const { data: croBalance, refetch: refetchCro } = useBalance({
    address,
    query: { enabled: Boolean(address) },
  });

  const { data: ultcatBalance, refetch: refetchUltcat } = useReadContract({
    address: ULTCAT_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: ULTCAT_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, VVS_ROUTER_ADDRESS] : undefined,
    query: { enabled: Boolean(address) && direction === "sell" },
  });

  const path = useMemo(
    () =>
      direction === "buy"
        ? ([WCRO_ADDRESS, ULTCAT_ADDRESS] as const)
        : ([ULTCAT_ADDRESS, WCRO_ADDRESS] as const),
    [direction],
  );

  const {
    data: amountsOut,
    dataUpdatedAt: quoteUpdatedAt,
    isFetching: quoteFetching,
    error: quoteError,
    refetch: refetchQuote,
  } = useReadContract({
    address: VVS_ROUTER_ADDRESS,
    abi: routerAbi,
    functionName: "getAmountsOut",
    args: amountIn ? [amountIn, [...path]] : undefined,
    query: {
      enabled: Boolean(amountIn),
      refetchInterval: 15_000,
    },
  });

  const { data: reserves } = useReadContract({
    address: PAIR_ADDRESS,
    abi: pairAbi,
    functionName: "getReserves",
    query: { refetchInterval: 15_000 },
  });

  const { data: token0 } = useReadContract({
    address: PAIR_ADDRESS,
    abi: pairAbi,
    functionName: "token0",
  });

  const amountOut =
    amountsOut && amountsOut.length >= 2
      ? amountsOut[amountsOut.length - 1]
      : null;

  const minOut =
    amountOut != null ? applySlippage(amountOut, slippageBps) : null;

  const impact = useMemo(() => {
    if (!amountIn || !reserves || !token0) return null;
    const [r0, r1] = reserves;
    const wcroIs0 = isAddressEqual(token0, WCRO_ADDRESS);
    const reserveIn =
      direction === "buy" ? (wcroIs0 ? r0 : r1) : wcroIs0 ? r1 : r0;
    const reserveOut =
      direction === "buy" ? (wcroIs0 ? r1 : r0) : wcroIs0 ? r0 : r1;
    return priceImpactBps(amountIn, reserveIn, reserveOut);
  }, [amountIn, reserves, token0, direction]);

  const balance =
    direction === "buy" ? (croBalance?.value ?? 0n) : (ultcatBalance ?? 0n);

  const inputSettled = amountStr === debouncedStr;
  const amountValid =
    inputSettled && amountIn != null && amountIn > 0n && amountIn <= balance;

  const quoteFresh =
    amountOut != null &&
    quoteUpdatedAt > 0 &&
    (now === 0 || now - quoteUpdatedAt < QUOTE_MAX_AGE_MS);

  const onCronos = chainId === CRONOS_CHAIN_ID;
  const needsApprove =
    direction === "sell" &&
    amountIn != null &&
    (allowance == null || allowance < amountIn);

  const impactHigh = impact != null && impact > 1500;
  const impactWarn = impact != null && impact > 500;
  const slippageWarn = slippageBps > 500;

  const canSwap =
    isConnected &&
    onCronos &&
    amountValid &&
    quoteFresh &&
    minOut != null &&
    minOut > 0n &&
    !needsApprove &&
    (!impactHigh || impactArmed);

  // Preview simulation (deadline anchored to quote time — pure w.r.t. render).
  const previewDeadline =
    quoteUpdatedAt > 0
      ? BigInt(Math.floor(quoteUpdatedAt / 1000) + 20 * 60)
      : undefined;

  const previewTx = useMemo(() => {
    if (!address || !amountIn || minOut == null || !previewDeadline || !onCronos) {
      return null;
    }
    if (needsApprove) {
      return buildApprove(amountIn);
    }
    if (direction === "buy") {
      return buildBuy({
        amountIn,
        minOut,
        to: address as Address,
        deadline: previewDeadline,
      });
    }
    return buildSell({
      amountIn,
      minOut,
      to: address as Address,
      deadline: previewDeadline,
    });
  }, [
    address,
    amountIn,
    minOut,
    previewDeadline,
    onCronos,
    needsApprove,
    direction,
  ]);

  const { error: simPreviewError } = useSimulateContract(
    (previewTx
      ? {
          address: previewTx.address,
          abi: previewTx.abi,
          functionName: previewTx.functionName,
          args: previewTx.args,
          ...("value" in previewTx ? { value: previewTx.value } : {}),
          chainId: CRONOS_CHAIN_ID,
          query: { enabled: amountValid && quoteFresh },
        }
      : { query: { enabled: false as const } }) as Parameters<
      typeof useSimulateContract
    >[0],
  );

  const {
    writeContract,
    data: txHash,
    error: writeError,
    isPending: isWriting,
    reset: resetWrite,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: txSuccess,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash: txHash,
    query: {
      enabled: Boolean(txHash),
    },
  });

  const displayError =
    uiError ??
    (writeError ? formatTxError(writeError) : null) ??
    (receiptError ? formatTxError(receiptError) : null) ??
    (simPreviewError && amountValid ? formatTxError(simPreviewError) : null);

  useEffect(() => {
    if (!txSuccess) return;
    void refetchCro();
    void refetchUltcat();
    void refetchAllowance();
    void refetchQuote();
  }, [txSuccess, refetchCro, refetchUltcat, refetchAllowance, refetchQuote]);

  async function runWrite(
    kind: "approve" | "swap",
    built: ReturnType<typeof buildApprove> | ReturnType<typeof buildBuy> | ReturnType<typeof buildSell>,
  ) {
    setUiError(null);
    resetWrite();
    setPendingKind(kind);
    setImpactArmed(false);
    try {
      const simulation = await simulateContract(config, {
        ...built,
        chainId: CRONOS_CHAIN_ID,
      } as Parameters<typeof simulateContract>[1]);
      writeContract(simulation.request);
    } catch (err) {
      setUiError(formatTxError(err));
    } finally {
      setPendingKind(null);
    }
  }

  function onMax() {
    setUiError(null);
    setImpactArmed(false);
    if (direction === "buy") {
      const raw = croBalance?.value ?? 0n;
      const max = raw > GAS_RESERVE ? raw - GAS_RESERVE : 0n;
      setAmountStr(max > 0n ? formatUnits(max, 18) : "");
    } else {
      setAmountStr(
        ultcatBalance != null && ultcatBalance > 0n
          ? formatUnits(ultcatBalance, 18)
          : "",
      );
    }
  }

  function onApprove() {
    if (!address || !amountIn || !onCronos) return;
    void runWrite("approve", buildApprove(amountIn));
  }

  function onSwap() {
    if (!address || !amountIn || minOut == null || !onCronos) return;
    if (impactHigh && !impactArmed) {
      setImpactArmed(true);
      return;
    }
    const deadline = deadlineFromNow(nowSec());
    if (direction === "buy") {
      void runWrite(
        "swap",
        buildBuy({ amountIn, minOut, to: address as Address, deadline }),
      );
    } else {
      void runWrite(
        "swap",
        buildSell({ amountIn, minOut, to: address as Address, deadline }),
      );
    }
  }

  function applyPreset(bps: number) {
    setCustomSlippage("");
    setSlippageBps(bps);
    setImpactArmed(false);
    setUiError(null);
  }

  function onCustomSlippage(value: string) {
    setCustomSlippage(value);
    setImpactArmed(false);
    setUiError(null);
    if (value.trim() === "") {
      setSlippageBps(DEFAULT_SLIPPAGE_BPS);
      return;
    }
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    setSlippageBps(clampSlippageBps(n * 100));
  }

  function setDirectionReset(next: Direction) {
    setDirection(next);
    setAmountStr("");
    setDebouncedStr("");
    setImpactArmed(false);
    setUiError(null);
  }

  const busy = isWriting || isConfirming || pendingKind != null;
  const inToken = direction === "buy" ? "CRO" : "ULTCAT";
  const outToken = direction === "buy" ? "ULTCAT" : "CRO";

  return (
    <div className="swap-widget">
      <div className="swap-widget-top">
        {!isConnected ? (
          <button type="button" className="btn btn-primary" onClick={() => open()}>
            Connect wallet
          </button>
        ) : !onCronos ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={isSwitching}
            onClick={() => switchChain({ chainId: CRONOS_CHAIN_ID })}
          >
            {isSwitching ? "Switching…" : "Switch to Cronos"}
          </button>
        ) : (
          <AppKitButton />
        )}
      </div>

      <div className="swap-dir" role="group" aria-label="Swap direction">
        <button
          type="button"
          className={direction === "buy" ? "swap-dir-btn active" : "swap-dir-btn"}
          onClick={() => setDirectionReset("buy")}
        >
          Buy
        </button>
        <button
          type="button"
          className={direction === "sell" ? "swap-dir-btn active" : "swap-dir-btn"}
          onClick={() => setDirectionReset("sell")}
        >
          Sell
        </button>
      </div>

      <label className="swap-field">
        <div className="swap-field-meta">
          <span>You pay ({inToken})</span>
          <span className="swap-balance">
            Bal:{" "}
            {direction === "buy"
              ? croBalance
                ? Number(formatUnits(croBalance.value, 18)).toLocaleString(
                    undefined,
                    { maximumFractionDigits: 4 },
                  )
                : "—"
              : ultcatBalance != null
                ? Number(formatUnits(ultcatBalance, 18)).toLocaleString(
                    undefined,
                    { maximumFractionDigits: 2 },
                  )
                : "—"}
            <button type="button" className="swap-max" onClick={onMax}>
              Max
            </button>
          </span>
        </div>
        <input
          className="swap-input"
          inputMode="decimal"
          placeholder="0.0"
          value={amountStr}
          onChange={(e) => {
            setAmountStr(e.target.value.replace(/[^0-9.]/g, ""));
            setImpactArmed(false);
            setUiError(null);
          }}
          autoComplete="off"
        />
      </label>

      <div className="swap-quote">
        <div className="swap-quote-row">
          <span>Expected out</span>
          <span>
            {amountOut != null
              ? `${Number(formatUnits(amountOut, 18)).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${outToken}`
              : quoteFetching
                ? "…"
                : "—"}
          </span>
        </div>
        <div className="swap-quote-row">
          <span>Min received</span>
          <span>
            {minOut != null
              ? `${Number(formatUnits(minOut, 18)).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${outToken}`
              : "—"}
          </span>
        </div>
        <div className="swap-quote-row">
          <span>Price impact</span>
          <span
            className={
              impactHigh
                ? "swap-warn-red"
                : impactWarn
                  ? "swap-warn-amber"
                  : undefined
            }
          >
            {impact != null ? `${(impact / 100).toFixed(2)}%` : "—"}
          </span>
        </div>
        <div className="swap-quote-row">
          <span>Route</span>
          <span>ULTCAT/WCRO pool</span>
        </div>
      </div>

      <div className="swap-slippage">
        <span className="swap-slippage-label">Slippage</span>
        <div className="swap-slippage-presets">
          {[100, 300, 500].map((bps) => (
            <button
              key={bps}
              type="button"
              className={
                slippageBps === bps && !customSlippage
                  ? "swap-chip active"
                  : "swap-chip"
              }
              onClick={() => applyPreset(bps)}
            >
              {bps / 100}%
            </button>
          ))}
          <input
            className="swap-chip-input"
            inputMode="decimal"
            placeholder="Custom %"
            value={customSlippage}
            onChange={(e) =>
              onCustomSlippage(e.target.value.replace(/[^0-9.]/g, ""))
            }
            aria-label="Custom slippage percent"
          />
        </div>
        {slippageWarn ? (
          <p className="swap-warn-amber swap-hint">
            High slippage ({(slippageBps / 100).toFixed(1)}%)
          </p>
        ) : null}
      </div>

      {isConnected && inputSettled && amountIn != null && !amountValid ? (
        <p className="swap-hint swap-warn-red">
          Amount must be &gt; 0 and ≤ balance.
        </p>
      ) : null}
      {quoteError ? (
        <p className="swap-hint swap-warn-red">{formatTxError(quoteError)}</p>
      ) : null}
      {displayError ? (
        <p className="swap-hint swap-warn-red">{displayError}</p>
      ) : null}

      {busy ? (
        <p className="swap-status">
          {isConfirming
            ? "Confirming…"
            : isWriting
              ? "Pending…"
              : "Simulating…"}
        </p>
      ) : null}
      {txSuccess && txHash ? (
        <p className="swap-status swap-success">
          Success —{" "}
          <a
            href={explorerTxUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
          >
            view tx
          </a>
        </p>
      ) : null}

      {isConnected && onCronos ? (
        needsApprove ? (
          <button
            type="button"
            className="btn btn-primary swap-action"
            disabled={!amountValid || busy}
            onClick={onApprove}
          >
            Approve ULTCAT
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary swap-action"
            disabled={!canSwap || busy}
            onClick={onSwap}
          >
            {impactHigh && !impactArmed
              ? "Confirm high price impact"
              : direction === "buy"
                ? "Swap CRO → ULTCAT"
                : "Swap ULTCAT → CRO"}
          </button>
        )
      ) : null}
    </div>
  );
}
