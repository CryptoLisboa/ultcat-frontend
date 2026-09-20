import type { Address } from "viem";

export const ULTCAT_ADDRESS =
  "0xBF19931EBF1bc9fb85820aa8f6Ba29030A9b9A27" as Address;

export const WCRO_ADDRESS =
  "0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23" as Address;

export const VVS_ROUTER_ADDRESS =
  "0x145863Eb42Cf62847A6Ca784e6416C1682b1b2Ae" as Address;

export const PAIR_ADDRESS =
  "0xE7AbE288bCA3Ee2322f82Ac52a2Fc44a222CdBfA" as Address;

export const CRONOS_CHAIN_ID = 25 as const;

export const CRONOS_RPC_URL = "https://evm.cronos.org" as const;

export const EXPLORER_TX_BASE = "https://explorer.cronos.org/tx" as const;

export function explorerTxUrl(hash: string): string {
  return `${EXPLORER_TX_BASE}/${hash}`;
}

export const OBSIDIAN_URL =
  `https://obsidian.finance/?outputChain=${CRONOS_CHAIN_ID}&outputCurrency=${ULTCAT_ADDRESS.toLowerCase()}` as const;

/** WolfSwap takes the native coin as the all-Es sentinel address. */
export const WOLFSWAP_URL =
  `https://wolfswap.gg/swap?chainId=${CRONOS_CHAIN_ID}&sellToken=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&buyToken=${ULTCAT_ADDRESS.toLowerCase()}` as const;

/** cro.trade routes by token address in the path — no chain or pair query needed. */
export const CRO_TRADE_URL =
  `https://cro.trade/${ULTCAT_ADDRESS.toLowerCase()}` as const;

export const DEXSCREENER_URL =
  `https://dexscreener.com/cronos/${PAIR_ADDRESS}` as const;

// GeckoTerminal embed: DexScreener's embed stalled on "Loading pair..." in testing (2026-09-19).
export const CHART_EMBED_URL =
  `https://www.geckoterminal.com/cro/pools/${PAIR_ADDRESS}?embed=1&info=0&swaps=0&light_chart=0` as const;

export const DEXSCREENER_API_URL =
  `https://api.dexscreener.com/latest/dex/pairs/cronos/${PAIR_ADDRESS}` as const;

export const EXPLORER_URL =
  `https://explorer.cronos.org/address/${ULTCAT_ADDRESS}` as const;

export const X_URL = "https://x.com/UltraCatOnCro" as const;

/** DRod founded ULTCAT and created the cat artwork. Credited on the page and in the metadata. */
export const ARTIST_NAME = "DRod" as const;
export const ARTIST_HANDLE = "@DeeRod" as const;
export const ARTIST_URL = "https://x.com/DeeRod" as const;

/** X search, newest first — how traders actually check the chatter on a ticker or a contract. */
export const X_SEARCH_TICKER_URL =
  `https://x.com/search?q=${encodeURIComponent("$ULTCAT")}&f=live` as const;

export const X_SEARCH_CA_URL =
  `https://x.com/search?q=${ULTCAT_ADDRESS}&f=live` as const;

export const SITE_URL = "https://ultcat.com" as const;

/**
 * Brand art is served from our own origin (see scripts/build-assets.mjs). It used
 * to be hotlinked from cdn.dexscreener.com, which meant the page's own identity
 * depended on a third party's URLs staying put.
 */
export const TOKEN_LOGO_URL = "/brand/logo.webp" as const;
export const HEADER_BANNER_URL = "/brand/banner.webp" as const;

/** Reown renders the wallet-modal icon from a remote context, so it needs an absolute URL. */
export const TOKEN_LOGO_ABSOLUTE_URL = `${SITE_URL}${TOKEN_LOGO_URL}` as const;
