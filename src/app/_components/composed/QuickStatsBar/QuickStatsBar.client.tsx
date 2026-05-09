import { formatClockMs, type QuickStats } from "@/lib/analytics/quick-stats";

interface QuickStatsBarProps {
  stats: QuickStats;
  /** Total games in the unfiltered set, to show "X of Y" when filters are active. */
  totalCount?: number;
}

function formatWinRate(rate: number | null): string {
  if (rate == null) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

export default function QuickStatsBar({
  stats,
  totalCount,
}: Readonly<QuickStatsBarProps>) {
  const showFiltered = totalCount != null && totalCount !== stats.count;
  const decided = stats.wins + stats.losses + stats.draws;

  return (
    <div className="flex flex-col gap-3 rounded-xl border-2 border-[var(--foreground)] p-4 sm:p-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat
          label="Games"
          value={
            showFiltered
              ? `${stats.count.toLocaleString()} / ${totalCount!.toLocaleString()}`
              : stats.count.toLocaleString()
          }
          hint={
            decided === stats.count
              ? undefined
              : `${decided.toLocaleString()} decided`
          }
        />
        <Stat
          label="Win rate"
          value={formatWinRate(stats.winRate)}
          hint={
            decided === 0
              ? undefined
              : `${stats.wins}W · ${stats.losses}L · ${stats.draws}D`
          }
        />
        <Stat
          label="Avg clock (you)"
          value={formatClockMs(stats.userAvgClockMs)}
          hint="at game end"
        />
        <Stat
          label="Avg clock (opp)"
          value={formatClockMs(stats.opponentAvgClockMs)}
          hint="at game end"
        />
      </div>
      {stats.count > 0 && stats.clockCoverageDenominator === 0 && (
        <p className="text-[11px] opacity-55">
          Average clock uses PGN move-time data for non-correspondence games
          only. Every game in the current set is correspondence, so these
          averages stay empty.
        </p>
      )}
      {stats.clockCoverageDenominator > 0 && (
        <p className="text-[11px] opacity-55">
          Clock data available for{" "}
          {stats.clockCoverageCount.toLocaleString()} of{" "}
          {stats.clockCoverageDenominator.toLocaleString()} non-correspondence
          games.
        </p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: Readonly<{ label: string; value: string; hint?: string }>) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold uppercase opacity-70">
        {label}
      </span>
      <span className="font-mono text-lg">{value}</span>
      {hint && <span className="text-[11px] opacity-55">{hint}</span>}
    </div>
  );
}
