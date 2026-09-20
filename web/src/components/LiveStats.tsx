import type { LiveStats as LiveStatsData } from "../lib/dexscreener";
import { formatPercent, formatUsd } from "../lib/format";
import { HOLDERS } from "../lib/holders";
import { EXPLORER_TOKEN_URL } from "../lib/constants";

type Props = {
  stats: LiveStatsData;
};

type Item = {
  label: string;
  value: string;
  className?: string;
  /** Renders the value as a link out to where the number can be verified. */
  href?: string;
  note?: string;
};

const snapshotDate = new Date(HOLDERS.takenAt).toLocaleDateString("en-GB", {
  day: "numeric",
  month: "short",
});

export function LiveStats({ stats }: Props) {
  const change = stats.priceChangeH24;
  const changeTone =
    change == null
      ? ""
      : change > 0
        ? "stat-up"
        : change < 0
          ? "stat-down"
          : "";

  const items: Item[] = [
    { label: "Price", value: formatUsd(stats.priceUsd) },
    {
      label: "24h",
      value: formatPercent(stats.priceChangeH24),
      className: changeTone,
    },
    { label: "Liquidity", value: formatUsd(stats.liquidityUsd) },
    { label: "FDV", value: formatUsd(stats.fdv) },
    { label: "24h Vol", value: formatUsd(stats.volumeH24) },
    {
      label: "Holders",
      value: HOLDERS.count.toLocaleString("en-GB"),
      // Everything else here is live from DexScreener; this one is a snapshot,
      // so it says when it was taken and links to where anyone can check it.
      href: EXPLORER_TOKEN_URL,
      note: `as of ${snapshotDate}`,
    },
  ];

  return (
    <dl className="stats-grid">
      {items.map((item) => (
        <div key={item.label} className="stat">
          <dt>
            {item.label}
            {item.note !== undefined ? (
              <span className="stat-note"> · {item.note}</span>
            ) : null}
          </dt>
          <dd className={item.className}>
            {item.href !== undefined ? (
              <a
                className="stat-link"
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {item.value}
              </a>
            ) : (
              item.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
