"use client";

import { useMemo, useState } from "react";

import { aggregateOpenings } from "@/lib/analytics/openings";
import { extractRatingHistory } from "@/lib/analytics/ratings";
import { clusterSessions } from "@/lib/analytics/sessions";
import type { Session } from "@/lib/analytics/sessions";
import type { UnifiedGame } from "@/lib/types/unified-game";

import RatingChart from "./RatingChart.client";
import SessionEloChart from "./SessionEloChart.client";

interface StatsViewProps {
  games: UnifiedGame[];
  chesscomCount: number;
  lichessCount: number;
  errors: { chesscom?: string; lichess?: string };
}

function fmtMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return "<1m";
}

export default function StatsView({
  games,
  chesscomCount,
  lichessCount,
  errors,
}: StatsViewProps) {
  const [gapMinutes, setGapMinutes] = useState(30);
  const [openingTab, setOpeningTab] = useState<"white" | "black">("white");

  const sessionStats = useMemo(
    () => clusterSessions(games, gapMinutes),
    [games, gapMinutes]
  );
  const openingStats = useMemo(() => aggregateOpenings(games, 3), [games]);
  const ratingHistory = useMemo(() => extractRatingHistory(games), [games]);

  const dateRange = useMemo(() => {
    if (games.length === 0) return null;
    const ts = games.map((g) => new Date(g.endAt).getTime());
    return {
      min: new Date(Math.min(...ts)),
      max: new Date(Math.max(...ts)),
    };
  }, [games]);

  const histogram = useMemo(() => {
    const buckets = [
      { label: "1", count: 0 },
      { label: "2", count: 0 },
      { label: "3–5", count: 0 },
      { label: "6–10", count: 0 },
      { label: "11–20", count: 0 },
      { label: "21+", count: 0 },
    ];
    for (const s of sessionStats.sessions) {
      const n = s.games.length;
      if (n === 1) buckets[0]!.count++;
      else if (n === 2) buckets[1]!.count++;
      else if (n <= 5) buckets[2]!.count++;
      else if (n <= 10) buckets[3]!.count++;
      else if (n <= 20) buckets[4]!.count++;
      else buckets[5]!.count++;
    }
    return buckets.filter((b) => b.count > 0);
  }, [sessionStats]);

  const maxHistCount = Math.max(...histogram.map((b) => b.count), 1);

  const sessionsWithElo = useMemo(
    () =>
      sessionStats.sessions.filter(
        (s): s is Session & { eloGain: number } => s.eloGain !== undefined
      ),
    [sessionStats]
  );
  const top5Best = useMemo(
    () => [...sessionsWithElo].sort((a, b) => b.eloGain - a.eloGain).slice(0, 5),
    [sessionsWithElo]
  );
  const top5Worst = useMemo(
    () => [...sessionsWithElo].sort((a, b) => a.eloGain - b.eloGain).slice(0, 5),
    [sessionsWithElo]
  );

  if (games.length === 0) {
    return <p className="p-8 text-center opacity-70">No games loaded.</p>;
  }

  const openingEntries =
    openingTab === "white" ? openingStats.asWhite : openingStats.asBlack;

  return (
    <div className="flex flex-col gap-12">
      {/* ── Summary ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm opacity-80">
        <span>{games.length} games</span>
        {chesscomCount > 0 && <span>Chess.com: {chesscomCount}</span>}
        {lichessCount > 0 && <span>Lichess: {lichessCount}</span>}
        {dateRange && (
          <span>
            {dateRange.min.toLocaleDateString()} –{" "}
            {dateRange.max.toLocaleDateString()}
          </span>
        )}
        {errors.chesscom && (
          <span className="text-amber-600">
            Chess.com error: {errors.chesscom}
          </span>
        )}
        {errors.lichess && (
          <span className="text-amber-600">
            Lichess error: {errors.lichess}
          </span>
        )}
      </div>

      {/* ── Session Analytics ────────────────────────────────────────── */}
      <section className="flex flex-col gap-6">
        <h2 className="text-lg font-semibold border-b border-[var(--foreground)] pb-2">
          Session Analytics
        </h2>

        <div className="flex flex-col gap-2 max-w-sm">
          <label className="text-sm flex justify-between items-center">
            <span>Session gap threshold</span>
            <span className="font-mono tabular-nums">{gapMinutes} min</span>
          </label>
          <input
            type="range"
            min={10}
            max={120}
            step={5}
            value={gapMinutes}
            onChange={(e) => setGapMinutes(Number(e.target.value))}
            className="w-full accent-[var(--foreground)]"
          />
          <p className="text-xs opacity-60">
            A gap larger than this between consecutive games starts a new
            session.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {(
            [
              ["Sessions", String(sessionStats.sessions.length)],
              [
                "Avg games / session",
                sessionStats.avgGamesPerSession.toFixed(1),
              ],
              ["Avg session length", fmtMs(sessionStats.avgDurationMs)],
              [
                "Longest session",
                sessionStats.longestByCount
                  ? `${sessionStats.longestByCount.games.length} games`
                  : "—",
              ],
            ] as [string, string][]
          ).map(([label, value]) => (
            <div
              key={label}
              className="border border-[var(--foreground)] rounded-lg p-4 flex flex-col gap-1"
            >
              <span className="text-xs opacity-60">{label}</span>
              <span className="text-xl font-mono font-semibold tabular-nums">
                {value}
              </span>
            </div>
          ))}
        </div>

        {sessionStats.longestByDuration && (
          <p className="text-sm opacity-75">
            Longest by time:{" "}
            <strong>{fmtMs(sessionStats.longestByDuration.durationMs)}</strong>{" "}
            on {sessionStats.longestByDuration.startAt.toLocaleDateString()} ·{" "}
            {sessionStats.longestByDuration.games.length} games ·{" "}
            {sessionStats.longestByDuration.wins}W /{" "}
            {sessionStats.longestByDuration.draws}D /{" "}
            {sessionStats.longestByDuration.losses}L
          </p>
        )}

        {histogram.length > 0 && (() => {
          const BW = 560, BH = 200;
          const BP = { top: 16, right: 16, bottom: 44, left: 44 };
          const bPlotW = BW - BP.left - BP.right;
          const bPlotH = BH - BP.top - BP.bottom;
          const barCount = histogram.length;
          const barW = (bPlotW / barCount) * 0.6;
          const barSlot = bPlotW / barCount;
          const yTickCount = 4;
          const yTickStep = Math.ceil(maxHistCount / yTickCount);
          const yAxisMax = yTickStep * yTickCount;
          const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => i * yTickStep);
          const bsy = (v: number) => BP.top + (1 - v / yAxisMax) * bPlotH;
          return (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Session size distribution</p>
              <svg
                viewBox={`0 0 ${BW} ${BH}`}
                className="w-full max-w-lg"
                style={{ maxHeight: BH }}
                aria-label="Session size distribution bar chart"
              >
                {/* Y gridlines + labels */}
                {yTicks.map((v) => (
                  <g key={v}>
                    <line
                      x1={BP.left} y1={bsy(v)}
                      x2={BW - BP.right} y2={bsy(v)}
                      stroke="currentColor"
                      strokeOpacity={v === 0 ? 0.25 : 0.1}
                      strokeWidth={1}
                      strokeDasharray={v === 0 ? undefined : "3 3"}
                    />
                    <text
                      x={BP.left - 6}
                      y={bsy(v) + 4}
                      textAnchor="end"
                      fontSize={10}
                      fill="currentColor"
                      opacity={0.6}
                    >
                      {v}
                    </text>
                  </g>
                ))}

                {/* Axes */}
                <line
                  x1={BP.left} y1={BP.top}
                  x2={BP.left} y2={BH - BP.bottom}
                  stroke="currentColor" strokeOpacity={0.3} strokeWidth={1}
                />
                <line
                  x1={BP.left} y1={BH - BP.bottom}
                  x2={BW - BP.right} y2={BH - BP.bottom}
                  stroke="currentColor" strokeOpacity={0.3} strokeWidth={1}
                />

                {/* Bars + x-labels */}
                {histogram.map((b, i) => {
                  const bx = BP.left + i * barSlot + (barSlot - barW) / 2;
                  const by = bsy(b.count);
                  const bh = BH - BP.bottom - by;
                  const pct = Math.round((b.count / sessionStats.sessions.length) * 100);
                  return (
                    <g key={b.label}>
                      <rect
                        x={bx}
                        y={by}
                        width={barW}
                        height={bh}
                        fill="currentColor"
                        opacity={0.55}
                        rx={3}
                      />
                      {/* count label on top of bar */}
                      <text
                        x={bx + barW / 2}
                        y={by - 4}
                        textAnchor="middle"
                        fontSize={10}
                        fill="currentColor"
                        opacity={0.75}
                      >
                        {b.count}
                      </text>
                      {/* bucket label below axis */}
                      <text
                        x={bx + barW / 2}
                        y={BH - BP.bottom + 14}
                        textAnchor="middle"
                        fontSize={10}
                        fill="currentColor"
                        opacity={0.7}
                      >
                        {b.label}
                      </text>
                      {/* percent */}
                      <text
                        x={bx + barW / 2}
                        y={BH - BP.bottom + 28}
                        textAnchor="middle"
                        fontSize={9}
                        fill="currentColor"
                        opacity={0.45}
                      >
                        {pct}%
                      </text>
                    </g>
                  );
                })}

                {/* X axis label */}
                <text
                  x={BP.left + bPlotW / 2}
                  y={BH - 2}
                  textAnchor="middle"
                  fontSize={10}
                  fill="currentColor"
                  opacity={0.5}
                >
                  Games per session
                </text>
              </svg>
            </div>
          );
        })()}

        {sessionStats.correspondenceFiltered > 0 && (
          <p className="text-xs opacity-55">
            {sessionStats.correspondenceFiltered} correspondence game
            {sessionStats.correspondenceFiltered !== 1 ? "s" : ""} excluded
            from session analytics.
          </p>
        )}

        {sessionsWithElo.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Top 5 best */}
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Best sessions (ELO gain)</p>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[var(--foreground)]/30">
                    <th className="text-left py-1.5 pr-3 font-medium text-xs opacity-60">#</th>
                    <th className="text-left py-1.5 pr-3 font-medium text-xs opacity-60">Date</th>
                    <th className="text-right py-1.5 pr-3 font-medium text-xs opacity-60">Duration</th>
                    <th className="text-right py-1.5 pr-3 font-medium text-xs opacity-60">Games</th>
                    <th className="text-right py-1.5 font-medium text-xs opacity-60">ELO</th>
                  </tr>
                </thead>
                <tbody>
                  {top5Best.map((s, i) => (
                    <tr key={i} className="border-b border-[var(--foreground)]/10">
                      <td className="py-1.5 pr-3 font-mono text-xs opacity-50">{i + 1}</td>
                      <td className="py-1.5 pr-3 text-xs">{s.startAt.toLocaleDateString()}</td>
                      <td className="py-1.5 pr-3 text-right font-mono text-xs tabular-nums">{fmtMs(s.durationMs)}</td>
                      <td className="py-1.5 pr-3 text-right font-mono text-xs tabular-nums">{s.games.length}</td>
                      <td className="py-1.5 text-right font-mono text-xs tabular-nums font-semibold text-[#4caf72]">
                        +{s.eloGain}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Top 5 worst */}
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Worst sessions (ELO loss)</p>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[var(--foreground)]/30">
                    <th className="text-left py-1.5 pr-3 font-medium text-xs opacity-60">#</th>
                    <th className="text-left py-1.5 pr-3 font-medium text-xs opacity-60">Date</th>
                    <th className="text-right py-1.5 pr-3 font-medium text-xs opacity-60">Duration</th>
                    <th className="text-right py-1.5 pr-3 font-medium text-xs opacity-60">Games</th>
                    <th className="text-right py-1.5 font-medium text-xs opacity-60">ELO</th>
                  </tr>
                </thead>
                <tbody>
                  {top5Worst.map((s, i) => (
                    <tr key={i} className="border-b border-[var(--foreground)]/10">
                      <td className="py-1.5 pr-3 font-mono text-xs opacity-50">{i + 1}</td>
                      <td className="py-1.5 pr-3 text-xs">{s.startAt.toLocaleDateString()}</td>
                      <td className="py-1.5 pr-3 text-right font-mono text-xs tabular-nums">{fmtMs(s.durationMs)}</td>
                      <td className="py-1.5 pr-3 text-right font-mono text-xs tabular-nums">{s.games.length}</td>
                      <td className="py-1.5 text-right font-mono text-xs tabular-nums font-semibold text-[#d45555]">
                        {s.eloGain}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <SessionEloChart sessions={sessionStats.sessions} />
        {sessionStats.sessions.some((s) => s.eloGain !== undefined) && (
          <p className="text-xs opacity-55">
            Each dot is one session. Green = ELO gain, red = ELO loss.
          </p>
        )}
      </section>

      {/* ── Opening Stats ─────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold border-b border-[var(--foreground)] pb-2">
          Opening Stats
        </h2>

        <div className="flex gap-2">
          {(["white", "black"] as const).map((side) => (
            <button
              key={side}
              type="button"
              onClick={() => setOpeningTab(side)}
              className={`px-4 py-1.5 rounded text-sm font-mono border border-[var(--foreground)] transition-colors ${
                openingTab === side
                  ? "bg-[var(--foreground)] text-[var(--background)]"
                  : "opacity-70 hover:opacity-100"
              }`}
            >
              As {side.charAt(0).toUpperCase() + side.slice(1)}
            </button>
          ))}
        </div>

        {openingEntries.length === 0 ? (
          <p className="text-sm opacity-60">
            Not enough data — need at least 3 games per opening to appear.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--foreground)]">
                  <th className="text-left py-2 pr-4 font-medium">Opening</th>
                  <th className="text-right py-2 px-2 font-medium">Games</th>
                  <th className="text-right py-2 px-2 font-medium">Win%</th>
                  <th className="text-right py-2 px-2 font-medium">W</th>
                  <th className="text-right py-2 px-2 font-medium">D</th>
                  <th className="text-right py-2 pl-2 font-medium">L</th>
                </tr>
              </thead>
              <tbody>
                {openingEntries.slice(0, 20).map((e) => (
                  <tr
                    key={e.key}
                    className="border-b border-[var(--foreground)]/20 hover:bg-[var(--foreground)]/5"
                  >
                    <td
                      className="py-2 pr-4 max-w-xs truncate"
                      title={e.key}
                    >
                      {e.key}
                    </td>
                    <td className="text-right py-2 px-2 font-mono tabular-nums">
                      {e.games}
                    </td>
                    <td className="text-right py-2 px-2 font-mono tabular-nums">
                      {Math.round(e.winRate * 100)}%
                    </td>
                    <td className="text-right py-2 px-2 font-mono tabular-nums">
                      {e.wins}
                    </td>
                    <td className="text-right py-2 px-2 font-mono tabular-nums">
                      {e.draws}
                    </td>
                    <td className="text-right py-2 pl-2 font-mono tabular-nums">
                      {e.losses}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {openingEntries.length > 20 && (
              <p className="text-xs opacity-55 mt-2">
                Showing top 20 of {openingEntries.length} openings (min 3 games
                each).
              </p>
            )}
          </div>
        )}
      </section>

      {/* ── Rating Trend ──────────────────────────────────────────────── */}
      {ratingHistory.length >= 2 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold border-b border-[var(--foreground)] pb-2">
            Rating Trend
          </h2>
          <p className="text-xs opacity-55">
            All time controls combined — separate lines per platform.
          </p>
          <RatingChart points={ratingHistory} />
        </section>
      )}
    </div>
  );
}
