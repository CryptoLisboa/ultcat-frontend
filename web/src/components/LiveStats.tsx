import type { LiveStats as LiveStatsData } from "../lib/dexscreener";
import { formatPercent, formatUsd } from "../lib/format";

type Props = {
  stats: LiveStatsData;
};

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

  const items = [
    { label: "Price", value: formatUsd(stats.priceUsd) },
    {
      label: "24h",
      value: formatPercent(stats.priceChangeH24),
      className: changeTone,
    },
    { label: "Liquidity", value: formatUsd(stats.liquidityUsd) },
    { label: "FDV", value: formatUsd(stats.fdv) },
    { label: "24h Vol", value: formatUsd(stats.volumeH24) },
  ];

  return (
    <dl className="stats-grid">
      {items.map((item) => (
        <div key={item.label} className="stat">
          <dt>{item.label}</dt>
          <dd className={item.className}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
