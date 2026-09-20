import { CRO_TRADE_URL, OBSIDIAN_URL, WOLFSWAP_URL } from "../lib/constants";

const VENUES = [
  { name: "Obsidian", href: OBSIDIAN_URL },
  { name: "WolfSwap", href: WOLFSWAP_URL },
  { name: "cro.trade", href: CRO_TRADE_URL },
] as const;

/**
 * Three venues, equal weight. Obsidian and WolfSwap stay side by side at every
 * width; below 34rem the third takes its own full-width row, because three Syne
 * ExtraBold names cannot share a 320px row without truncating.
 */
export function BuyButtons() {
  return (
    <div className="buy-venues">
      {VENUES.map((venue) => (
        <a
          key={venue.name}
          className="btn btn-primary buy-btn"
          href={venue.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Buy ULTCAT on ${venue.name}`}
        >
          <span className="buy-btn-lead">Buy on</span>
          <span className="buy-btn-name">{venue.name}</span>
        </a>
      ))}
    </div>
  );
}
