"use client";

import type { ClockStats, TimeoutMaterialCounts } from "@/lib/analytics/clock-stats";
import { formatClockMs } from "@/lib/analytics/quick-stats";

const MAT_COLORS = {
  ahead: "#4caf72",
  equal: "#9ca3af",
  behind: "#d45555",
} as const;

const MAT_LABELS = {
  ahead: "Ahead",
  equal: "Equal",
  behind: "Behind",
} as const;

function TimeoutMaterialBar({
  counts,
  label,
}: Readonly<{ counts: TimeoutMaterialCounts; label: string }>) {
  const { total, ahead, equal, behind } = counts;
  if (total === 0) return null;
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
  const segments: { key: keyof typeof MAT_COLORS; count: number }[] = [
    { key: "ahead", count: ahead },
    { key: "equal", count: equal },
    { key: "behind", count: behind },
  ];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between text-sm">
        <span className="opacity-70">{label}</span>
        <span className="font-mono opacity-50">{total} games</span>
      </div>
      <div className="flex h-5 w-full overflow-hidden rounded-full bg-[var(--foreground)]/10">
        {segments.map(
          ({ key, count }) =>
            count > 0 && (
              <div
                key={key}
                style={{ width: `${pct(count)}%`, background: MAT_COLORS[key], opacity: 0.8 }}
                title={`${MAT_LABELS[key]}: ${count} (${Math.round(pct(count))}%)`}
              />
            )
        )}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        {segments.map(
          ({ key, count }) =>
            count > 0 && (
              <span key={key} className="flex items-center gap-1.5 text-xs opacity-70">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm flex-shrink-0"
                  style={{ background: MAT_COLORS[key], opacity: 0.8 }}
                />
                {MAT_LABELS[key]}: {count} ({Math.round(pct(count))}%)
              </span>
            )
        )}
      </div>
    </div>
  );
}

function WinRateBar({ rate, label }: Readonly<{ rate: number; label: string }>) {
  const pct = Math.round(rate * 100);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between text-sm">
        <span className="opacity-70">{label}</span>
        <span className="font-mono font-semibold">{pct}%</span>
      </div>
      <div className="h-4 w-full rounded-full bg-[var(--foreground)]/10 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: pct >= 50 ? "#4caf72" : "#d45555",
            opacity: 0.75,
          }}
        />
      </div>
    </div>
  );
}

export default function ClockStatsSection({
  stats,
}: Readonly<{ stats: ClockStats }>) {
  if (stats.sampleSize === 0) {
    return (
      <p className="text-sm opacity-60">
        No clock data available for this game set. Clock annotations
        (&#37;clk) were not present in the PGN exports.
      </p>
    );
  }

  const coverage = stats.totalLiveGames > 0
    ? Math.round((stats.sampleSize / stats.totalLiveGames) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Coverage note */}
      <p className="text-xs opacity-60">
        Clock data from{" "}
        <strong>{stats.sampleSize.toLocaleString()}</strong> of{" "}
        {stats.totalLiveGames.toLocaleString()} live games ({coverage}%).
        Correspondence games excluded.
      </p>

      {/* Average remaining clock by result */}
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium">Average clock remaining at game end</p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--foreground)]/30">
                {["Result", "Your avg clock", "Opp avg clock", "Games"].map(
                  (h) => (
                    <th
                      key={h}
                      className={`py-2 font-medium text-sm opacity-60 ${
                        h === "Result" ? "text-left pr-4" : "text-right px-3"
                      }`}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {stats.byResult
                .filter((r) => r.count > 0)
                .map((row) => (
                  <tr
                    key={row.result}
                    className="border-b border-[var(--foreground)]/10"
                  >
                    <td className="py-2 pr-4 text-sm capitalize">
                      {row.label}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-sm">
                      {formatClockMs(row.avgUserMs)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-sm">
                      {formatClockMs(row.avgOppMs)}
                    </td>
                    <td className="py-2 pl-3 text-right font-mono tabular-nums text-sm opacity-60">
                      {row.count}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Clock-ahead win rate */}
      {(stats.aheadOnClockWinRate != null ||
        stats.behindOnClockWinRate != null) && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">
            Win rate in decisive games by clock position
          </p>
          <div className="flex max-w-lg flex-col gap-4">
            {stats.aheadOnClockWinRate != null && (
              <WinRateBar
                rate={stats.aheadOnClockWinRate}
                label={`Ahead on clock (${stats.aheadCount} games)`}
              />
            )}
            {stats.behindOnClockWinRate != null && (
              <WinRateBar
                rate={stats.behindOnClockWinRate}
                label={`Behind on clock (${stats.behindCount} games)`}
              />
            )}
          </div>
          <p className="text-[11px] opacity-55">
            Draws excluded. &ldquo;Ahead&rdquo; means you had more clock
            remaining than your opponent at the final move.
          </p>
        </div>
      )}

      {/* Timeout material balance */}
      {stats.timeoutMaterial && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">Material balance in timeout games</p>
          <div className="flex max-w-lg flex-col gap-5">
            <TimeoutMaterialBar
              counts={stats.timeoutMaterial.wins}
              label="Won on time"
            />
            <TimeoutMaterialBar
              counts={stats.timeoutMaterial.losses}
              label="Lost on time"
            />
          </div>
          <p className="text-[11px] opacity-55">
            Material counted from the final position (Q=9 R=5 B=3 N=3 P=1).
            &ldquo;Ahead&rdquo; means you had more material when the clock ran
            out. Draws excluded.
          </p>
        </div>
      )}
    </div>
  );
}
