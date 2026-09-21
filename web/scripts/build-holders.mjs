/**
 * Computes the ULTCAT holder count from chain and writes src/lib/holders.ts.
 *
 * Why this exists rather than an API call: nothing free exposes a holder count
 * for Cronos. DexScreener and GeckoTerminal have no such field, the Cronos
 * Explorer API has no holders endpoint (and its documented `log` module is not
 * implemented), and Moralis wants $149/month. So we derive it: replay every
 * Transfer since deploy into a balance map and count the addresses left holding
 * something.
 *
 * Why offline rather than in the page: the scan is ~412 requests and ~100
 * seconds, which is past Vercel's function timeout and would be 8 MB of logs if
 * pushed to the browser. The output is a committed snapshot; the page just
 * reads a number.
 *
 * Endpoint choice is load-bearing. `cronos-evm-rpc.publicnode.com` allows
 * 10k-block windows (5x wider, so 5x fewer calls) but is load-balanced across
 * nodes with differing state: two identical runs returned 13,198 and 13,402
 * transfers, and 310 vs 321 holders. `evm.cronos.org` caps windows at 2000 but
 * is complete and reproducible — two runs agreed exactly, with zero negative
 * balances. Correctness wins; use the official endpoint.
 *
 * Usage: node scripts/build-holders.mjs
 */
import { readFile, writeFile } from "node:fs/promises";

const CONTRACT = "0xBF19931EBF1bc9fb85820aa8f6Ba29030A9b9A27";
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
/** Contract creation; there are no Transfer logs before it. */
const DEPLOY_BLOCK = 94_299_951;
/** evm.cronos.org rejects anything wider with "maximum [from, to] blocks distance: 2000". */
const WINDOW = 2000;
/** Sequential with this gap survives the full scan; going faster earns HTTP 429. */
const PACE_MS = 130;
const RPC = process.env.CRONOS_RPC_URL ?? "https://evm.cronos.org";

const ZERO = `0x${"0".repeat(40)}`;
const BURN = "0x000000000000000000000000000000000000dead";
const OUTPUT = new URL("../src/lib/holders.ts", import.meta.url);
const HISTORY = new URL("../src/lib/holders-history.json", import.meta.url);

async function rpc(method, params) {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const response = await fetch(RPC, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(45_000),
      });
      const text = await response.text();
      // Under rate limiting this endpoint serves an HTML error page rather than
      // a JSON-RPC error, so parsing blind throws a confusing SyntaxError.
      if (!response.ok || !text.trimStart().startsWith("{")) {
        throw new Error(`HTTP ${response.status}`);
      }
      const body = JSON.parse(text);
      if (body.error) throw new Error(body.error.message);
      return body.result;
    } catch (error) {
      if (attempt === 9) throw error;
      await new Promise((r) => setTimeout(r, 400 * 2 ** Math.min(attempt, 5)));
    }
  }
}

const addressFrom = (topic) => `0x${topic.slice(26).toLowerCase()}`;

const head = Number.parseInt(await rpc("eth_blockNumber", []), 16);
const windows = Math.ceil((head - DEPLOY_BLOCK + 1) / WINDOW);
process.stderr.write(`scanning ${windows} windows up to block ${head}\n`);

const balances = new Map();
let transfers = 0;
let done = 0;

for (let from = DEPLOY_BLOCK; from <= head; from += WINDOW) {
  const logs = await rpc("eth_getLogs", [
    {
      address: CONTRACT,
      topics: [TRANSFER_TOPIC],
      fromBlock: `0x${from.toString(16)}`,
      toBlock: `0x${Math.min(from + WINDOW - 1, head).toString(16)}`,
    },
  ]);
  for (const log of logs) {
    transfers += 1;
    const value = BigInt(log.data);
    const sender = addressFrom(log.topics[1]);
    const recipient = addressFrom(log.topics[2]);
    balances.set(sender, (balances.get(sender) ?? 0n) - value);
    balances.set(recipient, (balances.get(recipient) ?? 0n) + value);
  }
  done += 1;
  if (done % 50 === 0) process.stderr.write(`  ${done}/${windows}\n`);
  await new Promise((r) => setTimeout(r, PACE_MS));
}

// A real address can never hold a negative balance, so any negative means we
// missed one of its incoming transfers and the count cannot be trusted.
// (Do NOT use sum-of-balances as the check: every transfer contributes +v and
// -v, so the sum stays balanced even when whole logs are missing.)
const negatives = [...balances.entries()].filter(
  ([address, value]) => value < 0n && address !== ZERO,
);
if (negatives.length > 0) {
  throw new Error(
    `Scan incomplete: ${negatives.length} addresses hold a negative balance. ` +
      `Re-run; if it persists the RPC is serving partial logs.`,
  );
}

const supply = BigInt(await rpc("eth_call", [{ to: CONTRACT, data: "0x18160ddd" }, "latest"]));
const circulating = [...balances.entries()]
  .filter(([address]) => address !== ZERO)
  .reduce((total, [, value]) => total + value, 0n);
if (circulating !== supply) {
  throw new Error(`Balances sum to ${circulating}, but totalSupply() is ${supply}.`);
}

const holders = [...balances.entries()].filter(
  ([address, value]) => value > 0n && address !== ZERO && address !== BURN,
).length;

const file = `// GENERATED by scripts/build-holders.mjs — do not edit by hand.
//
// Derived by replaying every Transfer since deploy: no free API exposes a
// holder count for Cronos. Re-run the script to refresh it.

export type HolderSnapshot = {
  /** Addresses holding a non-zero balance, excluding the zero and burn addresses. */
  readonly count: number;
  /** Chain height the scan reached. */
  readonly block: number;
  /** When the scan ran, ISO 8601. */
  readonly takenAt: string;
  /** Transfer events replayed to produce it. */
  readonly transfers: number;
};

export const HOLDERS: HolderSnapshot = {
  count: ${holders},
  block: ${head},
  takenAt: "${new Date().toISOString()}",
  transfers: ${transfers},
};
`;

await writeFile(OUTPUT, file);

// The snapshot above overwrites itself on every run, so the growth curve would
// be lost unless each run also leaves a permanent mark. One row per day, keyed
// by date so a same-day re-run corrects rather than duplicates.
const today = new Date().toISOString().slice(0, 10);
let history = [];
try {
  history = JSON.parse(await readFile(HISTORY, "utf8"));
} catch {
  // First run: no history file yet.
}
history = history.filter((row) => row.date !== today);
history.push({ date: today, count: holders, block: head });
history.sort((a, b) => a.date.localeCompare(b.date));
await writeFile(HISTORY, `${JSON.stringify(history, null, 2)}\n`);

process.stderr.write(
  `\ntransfers : ${transfers.toLocaleString()}\n` +
    `holders   : ${holders.toLocaleString()}\n` +
    `block     : ${head.toLocaleString()}\n` +
    `written   : src/lib/holders.ts\n` +
    `history   : ${history.length} day(s) in src/lib/holders-history.json\n`,
);
