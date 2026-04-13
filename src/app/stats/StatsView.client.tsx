"use client";

import { useEffect, useMemo, useState } from "react";

import ChessBoard from "@/app/_components/composed/ChessBoard/ChessBoard.client";
import CollapsibleSection from "@/app/_components/composed/CollapsibleSection/CollapsibleSection.client";
import ExplainerModal from "@/app/_components/composed/ExplainerModal/ExplainerModal.client";
import { fenForOpening } from "@/lib/openings/classify";
import { computeClockStats } from "@/lib/analytics/clock-stats";
import { computeGameInsights } from "@/lib/analytics/game-insights";
import { aggregateOpenings } from "@/lib/analytics/openings";
import { extractRatingHistory } from "@/lib/analytics/ratings";
import { clusterSessions } from "@/lib/analytics/sessions";
import type { Session } from "@/lib/analytics/sessions";
import { computeTerminationStats } from "@/lib/analytics/termination-stats";
import { computeTimeOfDayStats } from "@/lib/analytics/time-of-day";
import type { UnifiedGame } from "@/lib/types/unified-game";

import CheckmatesSection from "./CheckmatesSection.client";
import ClockStatsSection from "./ClockStatsSection.client";
import PeriodChart from "./PeriodChart.client";
import RatingChart from "./RatingChart.client";
import SessionEloChart from "./SessionEloChart.client";
import TerminationChart from "./TerminationChart.client";
import TimeOfDayChart from "./TimeOfDayChart.client";

const OPENINGS_DEFAULT_ROWS = 10;

interface StatsViewProps {
  games: UnifiedGame[];
  /** Total unfiltered game count (to show "X of Y" when filters are active). */
  totalCount?: number;
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
  totalCount,
  chesscomCount,
  lichessCount,
  errors,
}: StatsViewProps) {
  const [gapMinutes, setGapMinutes] = useState(30);
  const [openingTab, setOpeningTab] = useState<"white" | "black">("white");
  const [showAllOpenings, setShowAllOpenings] = useState(false);
  type OpeningSortKey = "games" | "winRate" | "wins" | "draws" | "losses" | "avgMoves";
  const [openingSort, setOpeningSort] = useState<{ key: OpeningSortKey; dir: "desc" | "asc" }>({ key: "games", dir: "desc" });
  const [openingModal, setOpeningModal] = useState<{
    title: string;
    fen: string;
    orientation: "white" | "black";
  } | null>(null);

  useEffect(() => {
    if (!openingModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpeningModal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openingModal]);

  const sessionStats = useMemo(
    () => clusterSessions(games, gapMinutes),
    [games, gapMinutes]
  );
  const openingStats = useMemo(() => aggregateOpenings(games, 3), [games]);
  const ratingHistory = useMemo(() => extractRatingHistory(games), [games]);
  const terminationStats = useMemo(() => computeTerminationStats(games), [games]);
  const timeOfDayStats = useMemo(() => computeTimeOfDayStats(games), [games]);
  const clockStats = useMemo(() => computeClockStats(games), [games]);
  const gameInsights = useMemo(() => computeGameInsights(games), [games]);

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

  const openingEntriesRaw =
    openingTab === "white" ? openingStats.asWhite : openingStats.asBlack;

  const openingEntries = useMemo(() => {
    const sorted = [...openingEntriesRaw].sort((a, b) => {
      const v = (x: typeof a) => {
        if (openingSort.key === "games") return x.games;
        if (openingSort.key === "winRate") return x.winRate;
        if (openingSort.key === "wins") return x.wins;
        if (openingSort.key === "draws") return x.draws;
        if (openingSort.key === "avgMoves") return x.avgMoves;
        return x.losses;
      };
      return openingSort.dir === "desc" ? v(b) - v(a) : v(a) - v(b);
    });
    return sorted;
  }, [openingEntriesRaw, openingSort]);

  return (
    <div className="flex flex-col gap-12">
      {/* ── Opening board modal ───────────────────────────────────────────── */}
      {openingModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={openingModal.title}
          onClick={() => setOpeningModal(null)}
        >
          <div
            className="absolute inset-0 bg-[color-mix(in_srgb,var(--foreground)_25%,transparent)]"
            aria-hidden
          />
          <div
            className="relative z-10 flex flex-col items-center gap-5 rounded-xl border-2 border-[var(--foreground)] bg-[var(--background)] p-5 shadow-lg sm:p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-center text-lg font-semibold leading-snug">
              {openingModal.title}
            </h2>
            <ChessBoard
              position={openingModal.fen}
              orientation={openingModal.orientation}
              large
            />
            <button
              type="button"
              onClick={() => setOpeningModal(null)}
              className="rounded-lg border-2 border-[var(--foreground)] px-5 py-2 font-mono text-sm hover:opacity-80"
            >
              Close
            </button>
          </div>
        </div>
      )}
      {/* ── Summary ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm opacity-80">
        <span>
          {totalCount != null && totalCount !== games.length
            ? `${games.length.toLocaleString()} of ${totalCount.toLocaleString()} games`
            : `${games.length.toLocaleString()} games`}
        </span>
        {chesscomCount > 0 && <span>Chess.com: {chesscomCount}</span>}
        {lichessCount > 0 && <span>Lichess: {lichessCount}</span>}
        {dateRange && (
          <span>
            {dateRange.min.toLocaleDateString()} –{" "}
            {dateRange.max.toLocaleDateString()}
          </span>
        )}
        {games.length > 0 && (
          <span>Avg {gameInsights.avgMovesPerGame.toFixed(1)} moves/game</span>
        )}
        {gameInsights.longestBreak && gameInsights.longestBreak.days >= 1 && (
          <span>
            Longest break:{" "}
            {gameInsights.longestBreak.days >= 60
              ? `${(gameInsights.longestBreak.days / 30).toFixed(1)} months`
              : `${Math.round(gameInsights.longestBreak.days)} days`}{" "}
            ({gameInsights.longestBreak.from.toLocaleDateString()} –{" "}
            {gameInsights.longestBreak.to.toLocaleDateString()})
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
      <CollapsibleSection
        id="session-analytics"
        title="Session Analytics"
        explainer={
          <ExplainerModal title="Session Analytics">
            <p>
              A <strong>session</strong> is a run of consecutive games played
              without a gap longer than the threshold you set. If you step away
              for longer than the threshold, the next game starts a new
              session.
            </p>
            <p>
              <strong>What is shown:</strong> number of sessions, average games
              and duration per session, longest sessions by game count and by
              time, and a histogram of session sizes.
            </p>
            <p>
              <strong>Correspondence games</strong> (daily) are excluded here
              because their wall-clock duration is dominated by waiting, not
              playing.
            </p>
            <p>
              <strong>Best / worst sessions by ELO:</strong> only sessions whose
              first and last games both carry a rating for the same platform
              and time control are scored.
            </p>
          </ExplainerModal>
        }
      >
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
          const BW = 1020, BH = 390;
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
                className="w-full"
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
      </CollapsibleSection>

      {/* ── Opening Stats ─────────────────────────────────────────────── */}
      <CollapsibleSection
        id="opening-stats"
        title="Opening Stats"
        explainer={
          <ExplainerModal title="Opening Stats">
            <p>
              Openings are grouped by the PGN <code>Opening</code> header that
              Chess.com and Lichess attach to each game. The tab switches
              between games you played as White and as Black.
            </p>
            <p>
              <strong>Minimum sample:</strong> an opening only appears if you
              played it at least <strong>3 times</strong> on the selected side.
              <strong> Win%</strong> counts draws as half a win.
            </p>
            <p>
              By default the top {OPENINGS_DEFAULT_ROWS} openings are shown.
              Click <em>Show all</em> to expand the full list.
            </p>
          </ExplainerModal>
        }
      >
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
        ) : (() => {
          const visible = showAllOpenings
            ? openingEntries
            : openingEntries.slice(0, OPENINGS_DEFAULT_ROWS);
          const hiddenCount = openingEntries.length - visible.length;
          return (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[var(--foreground)]">
                    <th className="text-left py-2 pr-4 font-medium">Opening</th>
                    {(
                      [
                        { key: "games" as OpeningSortKey, label: "Games" },
                        { key: "winRate" as OpeningSortKey, label: "Win%" },
                        { key: "avgMoves" as OpeningSortKey, label: "Avg Moves" },
                        { key: "wins" as OpeningSortKey, label: "W" },
                        { key: "draws" as OpeningSortKey, label: "D" },
                        { key: "losses" as OpeningSortKey, label: "L" },
                      ] as { key: OpeningSortKey; label: string }[]
                    ).map(({ key, label }) => (
                      <th
                        key={key}
                        className="text-right py-2 px-2 font-medium"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setOpeningSort((prev) =>
                              prev.key === key
                                ? { key, dir: prev.dir === "desc" ? "asc" : "desc" }
                                : { key, dir: "desc" }
                            )
                          }
                          className="inline-flex items-center gap-1 hover:opacity-100 opacity-80 font-medium"
                        >
                          {label}
                          <span className="font-mono text-[10px] opacity-60">
                            {openingSort.key === key
                              ? openingSort.dir === "desc"
                                ? "↓"
                                : "↑"
                              : "↕"}
                          </span>
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((e) => (
                    <tr
                      key={e.key}
                      className="border-b border-[var(--foreground)]/20 hover:bg-[var(--foreground)]/5"
                    >
                      <td className="py-2 pr-4 max-w-xs">
                        <button
                          type="button"
                          title={e.key}
                          onClick={() => {
                            const fen = fenForOpening(e.eco, e.name);
                            if (fen) setOpeningModal({ title: e.key, fen, orientation: openingTab });
                          }}
                          className="truncate cursor-pointer text-left hover:underline max-w-xs"
                        >
                          {e.key}
                        </button>
                      </td>
                      <td className="text-right py-2 px-2 font-mono tabular-nums">
                        {e.games}
                      </td>
                      <td className="text-right py-2 px-2 font-mono tabular-nums">
                        {Math.round(e.winRate * 100)}%
                      </td>
                      <td className="text-right py-2 px-2 font-mono tabular-nums">
                        {e.avgMoves}
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
              {openingEntries.length > OPENINGS_DEFAULT_ROWS && (
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAllOpenings((v) => !v)}
                    className="rounded-lg border border-[var(--foreground)] px-3 py-1.5 font-mono text-xs hover:opacity-80"
                  >
                    {showAllOpenings
                      ? `Show top ${OPENINGS_DEFAULT_ROWS}`
                      : `Show all (${openingEntries.length})`}
                  </button>
                  {!showAllOpenings && hiddenCount > 0 && (
                    <span className="text-xs opacity-55">
                      {hiddenCount} more hidden · min 3 games each
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </CollapsibleSection>

      {/* ── Rating Trend ──────────────────────────────────────────────── */}
      {ratingHistory.length >= 2 && (
        <CollapsibleSection
          id="rating-trend"
          title="Rating Trend"
          explainer={
            <ExplainerModal title="Rating Trend">
              <p>
                Each point is the rating attached to a game&rsquo;s
                <code> WhiteElo </code> or <code>BlackElo</code> header for
                your side. A separate line is drawn per platform (Chess.com
                and Lichess) since ratings are not comparable across sites.
              </p>
              <p>
                <strong>All time controls are combined</strong> on a single
                line per platform — bullet, blitz, rapid, and classical
                ratings are plotted together. Sharp jumps usually mean you
                switched time control rather than actually gaining or losing
                rating.
              </p>
            </ExplainerModal>
          }
        >
          <p className="text-xs opacity-55">
            All time controls combined — separate lines per platform.
          </p>
          <RatingChart points={ratingHistory} />
        </CollapsibleSection>
      )}

      {/* ── Games per Period ─────────────────────────────────────────── */}
      <CollapsibleSection
        id="games-per-period"
        title="Games per Period"
        explainer={
          <ExplainerModal title="Games per Period">
            <p>
              Histogram of games played over time, bucketed by year, month,
              week, or day. Each bar is split into wins (green), draws (grey),
              and losses (red). Hover a bar for exact counts.
            </p>
            <p>
              Dates are derived from each game&rsquo;s <code>endAt</code>{" "}
              timestamp in your local browser timezone.
            </p>
          </ExplainerModal>
        }
      >
        <PeriodChart games={games} />
      </CollapsibleSection>

      {/* ── Game End Type ────────────────────────────────────────────── */}
      {terminationStats.length > 0 && (
        <CollapsibleSection
          id="termination-breakdown"
          title="Game End Type"
          explainer={
            <ExplainerModal title="Game End Type">
              <p>
                Each game is classified into one of ten end-type buckets based
                on the PGN <code>Termination</code> header and the final
                position (inspected with chess.js).
              </p>
              <p>
                <strong>Coverage:</strong> some games only carry{" "}
                <em>Normal</em> or no termination tag — these fall into{" "}
                <em>Resignation</em> (for decisive games) or{" "}
                <em>Agreement</em> (for draws) by convention.{" "}
                <em>Other / Unknown</em> slices mean the data was ambiguous.
              </p>
              <p>
                Switch between <em>Stacked</em> (total height = total games)
                and <em>Grouped</em> (W/D/L side-by-side per bucket).
              </p>
            </ExplainerModal>
          }
        >
          <TerminationChart rows={terminationStats} />

          {/* Resign & Draw material breakdown */}
          {(gameInsights.resignMaterial.total > 0 || gameInsights.drawMaterial.total > 0) && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 mt-2">
              {gameInsights.resignMaterial.total > 0 && (() => {
                const rm = gameInsights.resignMaterial;
                const pct = (n: number) => rm.total > 0 ? Math.round((n / rm.total) * 100) : 0;
                return (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium">
                      Material at resignation{" "}
                      <span className="opacity-55 font-normal">({rm.total} games)</span>
                    </p>
                    <div className="flex h-5 w-full overflow-hidden rounded-md">
                      {rm.ahead > 0 && (
                        <div
                          className="flex items-center justify-center text-[10px] font-mono text-white"
                          style={{ width: `${pct(rm.ahead)}%`, background: "#4caf72" }}
                        >
                          {pct(rm.ahead)}%
                        </div>
                      )}
                      {rm.equal > 0 && (
                        <div
                          className="flex items-center justify-center text-[10px] font-mono text-white"
                          style={{ width: `${pct(rm.equal)}%`, background: "#6b7280" }}
                        >
                          {pct(rm.equal)}%
                        </div>
                      )}
                      {rm.behind > 0 && (
                        <div
                          className="flex items-center justify-center text-[10px] font-mono text-white"
                          style={{ width: `${pct(rm.behind)}%`, background: "#d45555" }}
                        >
                          {pct(rm.behind)}%
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#4caf72" }} />
                        Ahead {rm.ahead} ({pct(rm.ahead)}%)
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#6b7280" }} />
                        Equal {rm.equal} ({pct(rm.equal)}%)
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#d45555" }} />
                        Behind {rm.behind} ({pct(rm.behind)}%)
                      </span>
                    </div>
                  </div>
                );
              })()}
              {gameInsights.drawMaterial.total > 0 && (() => {
                const dm = gameInsights.drawMaterial;
                const pct = (n: number) => dm.total > 0 ? Math.round((n / dm.total) * 100) : 0;
                return (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium">
                      Material at draw{" "}
                      <span className="opacity-55 font-normal">({dm.total} games)</span>
                    </p>
                    <div className="flex h-5 w-full overflow-hidden rounded-md">
                      {dm.ahead > 0 && (
                        <div
                          className="flex items-center justify-center text-[10px] font-mono text-white"
                          style={{ width: `${pct(dm.ahead)}%`, background: "#4caf72" }}
                        >
                          {pct(dm.ahead)}%
                        </div>
                      )}
                      {dm.equal > 0 && (
                        <div
                          className="flex items-center justify-center text-[10px] font-mono text-white"
                          style={{ width: `${pct(dm.equal)}%`, background: "#6b7280" }}
                        >
                          {pct(dm.equal)}%
                        </div>
                      )}
                      {dm.behind > 0 && (
                        <div
                          className="flex items-center justify-center text-[10px] font-mono text-white"
                          style={{ width: `${pct(dm.behind)}%`, background: "#d45555" }}
                        >
                          {pct(dm.behind)}%
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#4caf72" }} />
                        Ahead {dm.ahead} ({pct(dm.ahead)}%)
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#6b7280" }} />
                        Equal {dm.equal} ({pct(dm.equal)}%)
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#d45555" }} />
                        Behind {dm.behind} ({pct(dm.behind)}%)
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
          {(gameInsights.resignMaterial.total > 0 || gameInsights.drawMaterial.total > 0) && (
            <p className="text-[11px] opacity-50 mt-1">
              Material balance uses simple piece values (Q=9 R=5 B=3 N=3 P=1) from the final position, from your perspective.
            </p>
          )}
        </CollapsibleSection>
      )}

      {/* ── Time of Day ──────────────────────────────────────────────── */}
      <CollapsibleSection
        id="time-of-day"
        title="Time of Day"
        explainer={
          <ExplainerModal title="Time of Day">
            <p>
              Games grouped into four local-time buckets based on when each
              game ended (your browser&rsquo;s timezone):
            </p>
            <ul>
              <li>
                <strong>Morning</strong> 06:00–11:59
              </li>
              <li>
                <strong>Afternoon</strong> 12:00–17:59
              </li>
              <li>
                <strong>Evening</strong> 18:00–23:59
              </li>
              <li>
                <strong>Night</strong> 00:00–05:59
              </li>
            </ul>
            <p>
              Win% shown above each bar uses{" "}
              <em>(wins + 0.5 × draws) / decided games</em>.
            </p>
          </ExplainerModal>
        }
      >
        <TimeOfDayChart rows={timeOfDayStats} />
      </CollapsibleSection>

      {/* ── Checkmates ───────────────────────────────────────────────── */}
      <CollapsibleSection
        id="checkmates"
        title="Checkmates"
        explainer={
          <ExplainerModal title="Checkmates">
            <p>
              <strong>Delivering piece:</strong> the piece that made the final
              move in games ending in checkmate, attributed as{" "}
              <em>given</em> (you mated the opponent) or{" "}
              <em>received</em> (opponent mated you).
            </p>
            <p>
              <strong>Material balance:</strong> simple piece-value sum (Q=9
              R=5 B/N=3 P=1) from the final FEN, from your perspective.
              &ldquo;Ahead&rdquo; means you had more material when the
              checkmate landed.
            </p>
            <p>
              Only games whose final position is a legal checkmate are counted.
              Games with broken or missing PGN are skipped.
            </p>
          </ExplainerModal>
        }
      >
        <CheckmatesSection games={games} />
      </CollapsibleSection>

      {/* ── Clock / Time Management ──────────────────────────────────── */}
      <CollapsibleSection
        id="clock-stats"
        title="Clock Management"
        explainer={
          <ExplainerModal title="Clock Management">
            <p>
              Statistics based on the remaining clock time for each player at
              the end of the game, read from <code>%clk</code> annotations in
              the PGN.
            </p>
            <p>
              <strong>Correspondence games are excluded</strong> — their
              time-control mechanics make clock values meaningless here. All
              figures are for live games only.
            </p>
            <p>
              <strong>Coverage depends on your exports:</strong> many older
              games or platform settings omit clock annotations entirely.
              Always check the sample size shown.
            </p>
            <p>
              <em>Ahead on clock</em> means you had more clock remaining than
              your opponent when the last move was played.
            </p>
          </ExplainerModal>
        }
      >
        <ClockStatsSection stats={clockStats} />
      </CollapsibleSection>
    </div>
  );
}
