import { DEXSCREENER_API_URL } from "./constants";

export type DexScreenerPair = {
  priceUsd: string | null;
  priceChange: { h24: number } | null;
  liquidity: { usd: number } | null;
  fdv: number | null;
  volume: { h24: number } | null;
};

export type DexScreenerResponse = {
  pair: DexScreenerPair | null;
};

export type LiveStats = {
  priceUsd: number | null;
  priceChangeH24: number | null;
  liquidityUsd: number | null;
  fdv: number | null;
  volumeH24: number | null;
};

export async function fetchLiveStats(): Promise<LiveStats> {
  const empty: LiveStats = {
    priceUsd: null,
    priceChangeH24: null,
    liquidityUsd: null,
    fdv: null,
    volumeH24: null,
  };

  try {
    const res = await fetch(DEXSCREENER_API_URL, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return empty;

    const data = (await res.json()) as DexScreenerResponse;
    const pair = data.pair;
    if (!pair) return empty;

    const price = pair.priceUsd != null ? Number(pair.priceUsd) : null;

    return {
      priceUsd: price != null && Number.isFinite(price) ? price : null,
      priceChangeH24: pair.priceChange?.h24 ?? null,
      liquidityUsd: pair.liquidity?.usd ?? null,
      fdv: pair.fdv ?? null,
      volumeH24: pair.volume?.h24 ?? null,
    };
  } catch {
    return empty;
  }
}
