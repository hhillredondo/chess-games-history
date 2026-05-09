import type { UnifiedGame } from "@/lib/types/unified-game";

import { computeCheckmateStats } from "./checkmates";
import { computeClockStats } from "./clock-stats";
import { computeGameInsights } from "./game-insights";
import { aggregateOpenings, type OpeningEntry } from "./openings";
import { computePeriodStats } from "./period-stats";
import { computeQuickStats, formatClockMs } from "./quick-stats";
import { extractRatingHistory } from "./ratings";
import { clusterSessions } from "./sessions";
import { computeTerminationStats } from "./termination-stats";
import { computeTimeOfDayStats } from "./time-of-day";

/** Minimum games required before an opening's stats are considered meaningful. */
const OPENING_MIN_GAMES = 5;
/** Top-N openings (by games played) included verbatim in the summary. */
const TOP_OPENINGS_BY_COUNT = 12;
/** Additional high-win-rate openings surfaced as "untapped potential". */
const HIGH_WIN_RATE_OPENINGS = 5;
/** Additional low-win-rate openings surfaced as "bleeding points". */
const LOW_WIN_RATE_OPENINGS = 5;

interface CoachContextOptions {
  chesscomUsername?: string;
  lichessUsername?: string;
  /** Session gap threshold used by the session clustering analytics. */
  gapMinutes?: number;
}

/** Format a 0–1 proportion as a percentage with no decimals. */
function pct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${Math.round(v * 100)}%`;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function fmtDateRange(min: Date, max: Date): string {
  const opts: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  };
  return `${min.toLocaleDateString("en-US", opts)} → ${max.toLocaleDateString("en-US", opts)}`;
}

function formatOpeningRow(o: OpeningEntry): string {
  const key = o.eco ? `${o.eco} ${o.name}` : o.name;
  return `  - ${key}: ${o.games} games, ${pct(o.winRate)} win rate (W${o.wins}/L${o.losses}/D${o.draws}), avg ${o.avgMoves} moves`;
}

function formatOpeningsBlock(entries: OpeningEntry[], colorLabel: string): string {
  if (entries.length === 0) {
    return `Openings as ${colorLabel}: no openings with ${OPENING_MIN_GAMES}+ games.`;
  }

  const byCount = [...entries].sort((a, b) => b.games - a.games);
  const topByCount = byCount.slice(0, TOP_OPENINGS_BY_COUNT);
  const totalGames = entries.reduce((s, e) => s + e.games, 0);

  const headerLines = [
    `Openings as ${colorLabel} (${entries.length} distinct openings, ${fmt(totalGames)} games total):`,
    "  Most played:",
    ...topByCount.map(
      (o) =>
        `${formatOpeningRow(o)} (${pct(o.games / totalGames)} of ${colorLabel} games)`
    ),
  ];

  // Untapped potential: high win rate, but lower game count than the top entries
  const minPlayedInTop = topByCount[topByCount.length - 1]?.games ?? 0;
  const highWinRate = [...entries]
    .filter((o) => o.games >= OPENING_MIN_GAMES && o.games < minPlayedInTop && o.winRate >= 0.55)
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, HIGH_WIN_RATE_OPENINGS);

  if (highWinRate.length > 0) {
    headerLines.push("  High win rate, under-played:");
    headerLines.push(...highWinRate.map(formatOpeningRow));
  }

  // Bleeding points: low win rate, many games
  const lowWinRate = [...entries]
    .filter((o) => o.games >= OPENING_MIN_GAMES && o.winRate <= 0.4)
    .sort((a, b) => a.winRate - b.winRate || b.games - a.games)
    .slice(0, LOW_WIN_RATE_OPENINGS);

  if (lowWinRate.length > 0) {
    headerLines.push("  Low win rate (Elo drains):");
    headerLines.push(...lowWinRate.map(formatOpeningRow));
  }

  return headerLines.join("\n");
}

function summariseRatings(
  games: UnifiedGame[]
): string {
  const history = extractRatingHistory(games);
  if (history.length === 0) return "Ratings: no rated-game history available.";

  // Split by source — ratings aren't comparable across platforms.
  const bySource = new Map<string, typeof history>();
  for (const p of history) {
    const arr = bySource.get(p.source) ?? [];
    arr.push(p);
    bySource.set(p.source, arr);
  }

  const lines: string[] = ["Rating trajectory:"];
  for (const [source, pts] of bySource) {
    if (pts.length === 0) continue;
    const first = pts[0]!;
    const last = pts[pts.length - 1]!;
    const sorted = [...pts].sort((a, b) => a.rating - b.rating);
    const min = sorted[0]!;
    const max = sorted[sorted.length - 1]!;
    const net = last.rating - first.rating;
    const sign = net >= 0 ? "+" : "";
    lines.push(
      `  - ${source}: start ${first.rating} → current ${last.rating} (net ${sign}${net}), all-time low ${min.rating} (${min.date.slice(0, 10)}), peak ${max.rating} (${max.date.slice(0, 10)}), ${pts.length} rated games`
    );
  }

  return lines.join("\n");
}

function summariseTermination(games: UnifiedGame[]): string {
  const rows = computeTerminationStats(games);
  if (rows.length === 0) return "Terminations: no data.";
  const total = rows.reduce((s, r) => s + r.total, 0);
  const lines = ["How games end (W/L/D split):"];
  for (const r of rows) {
    lines.push(
      `  - ${r.label}: ${fmt(r.total)} (${pct(r.total / total)}) — W${r.wins}/L${r.losses}/D${r.draws}`
    );
  }
  return lines.join("\n");
}

function summariseTimeOfDay(games: UnifiedGame[]): string {
  const rows = computeTimeOfDayStats(games);
  const any = rows.some((r) => r.games > 0);
  if (!any) return "Time-of-day: no data.";
  const lines = ["Performance by time of day (local time):"];
  for (const r of rows) {
    if (r.games === 0) continue;
    lines.push(
      `  - ${r.label} (${r.range}): ${fmt(r.games)} games, win rate ${pct(r.winRate)}`
    );
  }
  return lines.join("\n");
}

function summariseClock(games: UnifiedGame[]): string {
  const s = computeClockStats(games);
  if (s.sampleSize === 0 && s.totalLiveGames === 0) {
    return "Clock management: no live-game clock data.";
  }
  const lines = [
    `Clock management (${fmt(s.sampleSize)} games with %clk data out of ${fmt(s.totalLiveGames)} live games):`,
  ];
  for (const r of s.byResult) {
    if (r.count === 0) continue;
    lines.push(
      `  - ${r.label}: avg user clock ${formatClockMs(r.avgUserMs)}, opponent ${formatClockMs(r.avgOppMs)} over ${fmt(r.count)} games`
    );
  }
  if (s.aheadCount > 0 || s.behindCount > 0) {
    lines.push(
      `  - Win rate when ahead on clock: ${pct(s.aheadOnClockWinRate)} (${fmt(s.aheadCount)} games); when behind: ${pct(s.behindOnClockWinRate)} (${fmt(s.behindCount)} games)`
    );
  }
  if (s.timeoutMaterial) {
    const { wins, losses } = s.timeoutMaterial;
    if (wins.total > 0) {
      lines.push(
        `  - Timeout wins by final material: ahead ${wins.ahead}, equal ${wins.equal}, behind ${wins.behind} (total ${wins.total})`
      );
    }
    if (losses.total > 0) {
      lines.push(
        `  - Timeout losses by final material: ahead ${losses.ahead}, equal ${losses.equal}, behind ${losses.behind} (total ${losses.total})`
      );
    }
  }
  return lines.join("\n");
}

function summariseSessions(games: UnifiedGame[], gapMinutes: number): string {
  const s = clusterSessions(games, gapMinutes);
  if (s.sessions.length === 0) return "Sessions: no data.";

  const avgMs = Math.round(s.avgDurationMs);
  const avgMin = Math.round(avgMs / 60000);
  const lines = [
    `Playing sessions (${gapMinutes}-min gap threshold):`,
    `  - ${fmt(s.sessions.length)} sessions, ${s.avgGamesPerSession.toFixed(1)} games/session avg, ${avgMin} min avg duration`,
  ];

  if (s.longestByCount) {
    const sess = s.longestByCount;
    lines.push(
      `  - Longest session by game count: ${sess.games.length} games (W${sess.wins}/L${sess.losses}/D${sess.draws}) on ${sess.startAt.toISOString().slice(0, 10)}`
    );
  }
  if (s.bestByEloGain && s.bestByEloGain.eloGain !== undefined) {
    const sess = s.bestByEloGain;
    lines.push(
      `  - Best single-session Elo gain: +${sess.eloGain} over ${sess.games.length} games on ${sess.startAt.toISOString().slice(0, 10)}`
    );
  }
  if (s.worstByEloLoss && s.worstByEloLoss.eloGain !== undefined) {
    const sess = s.worstByEloLoss;
    lines.push(
      `  - Worst single-session Elo drop: ${sess.eloGain} over ${sess.games.length} games on ${sess.startAt.toISOString().slice(0, 10)}`
    );
  }

  // Win rate by session length bucket — useful for detecting tilt
  const buckets = [
    { label: "1–2 games", min: 1, max: 2 },
    { label: "3–5 games", min: 3, max: 5 },
    { label: "6–10 games", min: 6, max: 10 },
    { label: "11–20 games", min: 11, max: 20 },
    { label: "21+ games", min: 21, max: Infinity },
  ];
  const bucketLines: string[] = [];
  for (const b of buckets) {
    const sessions = s.sessions.filter(
      (sess) => sess.games.length >= b.min && sess.games.length <= b.max
    );
    if (sessions.length === 0) continue;
    let wins = 0;
    let losses = 0;
    let draws = 0;
    let total = 0;
    for (const sess of sessions) {
      wins += sess.wins;
      losses += sess.losses;
      draws += sess.draws;
      total += sess.games.length;
    }
    const decided = wins + losses + draws;
    const wr = decided === 0 ? null : (wins + 0.5 * draws) / decided;
    bucketLines.push(
      `    · ${b.label}: ${sessions.length} sessions, ${fmt(total)} games, win rate ${pct(wr)}`
    );
  }
  if (bucketLines.length > 0) {
    lines.push("  - Win rate by session length:");
    lines.push(...bucketLines);
  }

  return lines.join("\n");
}

function summarisePeriods(games: UnifiedGame[]): string {
  const yearly = computePeriodStats(games, "year");
  if (yearly.length === 0) return "Activity: no data.";

  const lines = ["Activity by year (games played):"];
  for (const r of yearly) {
    const decided = r.wins + r.losses + r.draws;
    const wr = decided === 0 ? null : (r.wins + 0.5 * r.draws) / decided;
    lines.push(
      `  - ${r.label}: ${fmt(r.games)} games (W${r.wins}/L${r.losses}/D${r.draws}), win rate ${pct(wr)}`
    );
  }
  return lines.join("\n");
}

function summariseCheckmates(games: UnifiedGame[]): string {
  const s = computeCheckmateStats(games);
  if (s.totalGiven === 0 && s.totalReceived === 0) {
    return "Checkmates: none in the dataset.";
  }

  const avg = (arr: number[]): string =>
    arr.length === 0 ? "—" : (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1);

  const lines = [
    `Checkmates: delivered ${fmt(s.totalGiven)}, received ${fmt(s.totalReceived)} (avg moves per mate — given ${avg(s.moveCountsGiven)}, received ${avg(s.moveCountsReceived)}):`,
    "  Delivering piece breakdown:",
  ];
  for (const p of s.deliveringPiece) {
    lines.push(`    - ${p.label}: ${p.given} given / ${p.received} received`);
  }
  lines.push("  Material balance at checkmate:");
  for (const m of s.materialBalance) {
    lines.push(`    - ${m.label}: ${m.given} given / ${m.received} received`);
  }
  return lines.join("\n");
}

function summariseGameInsights(games: UnifiedGame[]): string {
  const s = computeGameInsights(games);
  const lines = [
    `Game flow: avg ${s.avgMovesPerGame.toFixed(1)} full moves per game.`,
  ];
  if (s.longestBreak) {
    lines.push(
      `  - Longest break between games: ${s.longestBreak.days.toFixed(1)} days (${s.longestBreak.from.toISOString().slice(0, 10)} → ${s.longestBreak.to.toISOString().slice(0, 10)})`
    );
  }
  if (s.resignMaterial.total > 0) {
    const r = s.resignMaterial;
    lines.push(
      `  - Resignation material balance: ahead ${r.ahead} (${pct(r.ahead / r.total)}), equal ${r.equal} (${pct(r.equal / r.total)}), behind ${r.behind} (${pct(r.behind / r.total)}) across ${fmt(r.total)} resigned games`
    );
  }
  if (s.drawMaterial.total > 0) {
    const d = s.drawMaterial;
    lines.push(
      `  - Draw material balance: ahead ${d.ahead} (${pct(d.ahead / d.total)}), equal ${d.equal} (${pct(d.equal / d.total)}), behind ${d.behind} (${pct(d.behind / d.total)}) across ${fmt(d.total)} draws`
    );
  }
  return lines.join("\n");
}

/**
 * Build a structured text summary of the user's full game history for LLM
 * consumption. Aggregates all analytics modules into compact, percentage-first
 * prose that fits comfortably in a single prompt (~3–5K tokens for a heavy user).
 *
 * The resulting string is sent to `/api/coach` as the coaching context.
 */
export function buildCoachContext(
  games: UnifiedGame[],
  opts: CoachContextOptions = {}
): string {
  if (games.length === 0) {
    return "No games in the filtered dataset.";
  }

  const gapMinutes = opts.gapMinutes ?? 30;

  // Games may arrive in any order; analytics that care about chronology handle
  // their own sorting, so we don't re-sort here.
  const quick = computeQuickStats(games);

  const timestamps = games.map((g) => new Date(g.endAt).getTime());
  const range = {
    min: new Date(Math.min(...timestamps)),
    max: new Date(Math.max(...timestamps)),
  };

  const whoAmI: string[] = [];
  if (opts.chesscomUsername) whoAmI.push(`Chess.com: ${opts.chesscomUsername}`);
  if (opts.lichessUsername) whoAmI.push(`Lichess: ${opts.lichessUsername}`);
  const whoLine = whoAmI.length > 0 ? `Player — ${whoAmI.join(", ")}.` : "";

  const overview = [
    `Dataset covers ${fmt(games.length)} games from ${fmtDateRange(range.min, range.max)}.`,
    `Overall: W${quick.wins} / L${quick.losses} / D${quick.draws} (${pct(quick.winRate)} win rate across ${fmt(quick.wins + quick.losses + quick.draws)} decided games${quick.unknownResults > 0 ? `; ${quick.unknownResults} unknown results` : ""}).`,
  ];
  if (quick.userAvgClockMs != null) {
    overview.push(
      `Average remaining clock: user ${formatClockMs(quick.userAvgClockMs)}, opponent ${formatClockMs(quick.opponentAvgClockMs)} (sample ${fmt(quick.clockCoverageCount)} of ${fmt(quick.clockCoverageDenominator)} live games).`
    );
  }

  const openings = aggregateOpenings(games, OPENING_MIN_GAMES);

  const blocks: string[] = [];
  if (whoLine) blocks.push(whoLine);
  blocks.push(overview.join("\n"));
  blocks.push(summariseRatings(games));
  blocks.push(summariseTermination(games));
  blocks.push(formatOpeningsBlock(openings.asWhite, "White"));
  blocks.push(formatOpeningsBlock(openings.asBlack, "Black"));
  blocks.push(summariseTimeOfDay(games));
  blocks.push(summariseClock(games));
  blocks.push(summariseSessions(games, gapMinutes));
  blocks.push(summarisePeriods(games));
  blocks.push(summariseCheckmates(games));
  blocks.push(summariseGameInsights(games));

  return blocks.join("\n\n");
}
