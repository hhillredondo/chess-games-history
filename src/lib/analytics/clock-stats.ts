import {
  terminationBucketForGame,
  timeControlCategory,
} from "@/lib/filters/game-filters";
import type { UnifiedGame, UserResult } from "@/lib/types/unified-game";

import { clockStringToMs } from "./quick-stats";

/* ── Timeout material helpers ─────────────────────────────────────────── */

/** Material difference (user − opponent) computed directly from FEN, no chess.js. */
function materialDiffFromFen(fen: string, userColor: "white" | "black"): number {
  const placement = fen.split(" ")[0] ?? "";
  // Simple piece values — king excluded from sum
  const VALUES: Record<string, number> = {
    P: 1, N: 3, B: 3, R: 5, Q: 9,
    p: 1, n: 3, b: 3, r: 5, q: 9,
  };
  let white = 0;
  let black = 0;
  for (const ch of placement) {
    const v = VALUES[ch];
    if (v == null) continue;
    if (ch === ch.toUpperCase()) white += v;
    else black += v;
  }
  const diff = white - black;
  return userColor === "white" ? diff : -diff;
}

export type MaterialBucket = "ahead" | "equal" | "behind";

function toMaterialBucket(diff: number): MaterialBucket {
  if (diff > 0) return "ahead";
  if (diff < 0) return "behind";
  return "equal";
}

export interface TimeoutMaterialCounts {
  ahead: number;
  equal: number;
  behind: number;
  total: number;
}

export interface TimeoutMaterialStats {
  /** Timeout games the user won — material balance at the end. */
  wins: TimeoutMaterialCounts;
  /** Timeout games the user lost — material balance at the end. */
  losses: TimeoutMaterialCounts;
}

export interface ClockByResultRow {
  result: UserResult;
  label: string;
  avgUserMs: number | null;
  avgOppMs: number | null;
  count: number;
}

export interface ClockStats {
  byResult: ClockByResultRow[];
  /** Win rate (excl. draws) when user had more clock remaining. Null if no data. */
  aheadOnClockWinRate: number | null;
  /** Win rate (excl. draws) when user had less clock remaining. Null if no data. */
  behindOnClockWinRate: number | null;
  aheadCount: number;
  behindCount: number;
  /** Live games with both end-clock values present. */
  sampleSize: number;
  /** All live (non-correspondence) games in the input. */
  totalLiveGames: number;
  /** Material balance breakdown for timeout wins and losses. Null if no timeout games. */
  timeoutMaterial: TimeoutMaterialStats | null;
}

export function computeClockStats(games: UnifiedGame[]): ClockStats {
  const liveGames = games.filter(
    (g) => timeControlCategory(g.timeControl) !== "correspondence"
  );

  const clockGames = liveGames.filter((g) => {
    const userMs =
      g.userColor === "white"
        ? clockStringToMs(g.endClockWhite)
        : clockStringToMs(g.endClockBlack);
    const oppMs =
      g.userColor === "white"
        ? clockStringToMs(g.endClockBlack)
        : clockStringToMs(g.endClockWhite);
    return userMs != null && oppMs != null;
  });

  // By result
  const RESULTS: { id: UserResult; label: string }[] = [
    { id: "win", label: "Win" },
    { id: "draw", label: "Draw" },
    { id: "loss", label: "Loss" },
  ];

  const resultMap = new Map<
    UserResult,
    { userSum: number; oppSum: number; count: number }
  >();

  for (const g of clockGames) {
    const userMs =
      g.userColor === "white"
        ? clockStringToMs(g.endClockWhite)!
        : clockStringToMs(g.endClockBlack)!;
    const oppMs =
      g.userColor === "white"
        ? clockStringToMs(g.endClockBlack)!
        : clockStringToMs(g.endClockWhite)!;
    const prev = resultMap.get(g.result) ?? { userSum: 0, oppSum: 0, count: 0 };
    prev.userSum += userMs;
    prev.oppSum += oppMs;
    prev.count++;
    resultMap.set(g.result, prev);
  }

  const byResult: ClockByResultRow[] = RESULTS.map((r) => {
    const d = resultMap.get(r.id);
    return {
      result: r.id,
      label: r.label,
      avgUserMs: d ? d.userSum / d.count : null,
      avgOppMs: d ? d.oppSum / d.count : null,
      count: d?.count ?? 0,
    };
  });

  // Clock-ahead / clock-behind win rates (decisive games only)
  let aheadWins = 0;
  let aheadTotal = 0;
  let behindWins = 0;
  let behindTotal = 0;

  for (const g of clockGames) {
    if (g.result === "draw") continue;
    const userMs =
      g.userColor === "white"
        ? clockStringToMs(g.endClockWhite)!
        : clockStringToMs(g.endClockBlack)!;
    const oppMs =
      g.userColor === "white"
        ? clockStringToMs(g.endClockBlack)!
        : clockStringToMs(g.endClockWhite)!;
    if (userMs > oppMs) {
      aheadTotal++;
      if (g.result === "win") aheadWins++;
    } else if (userMs < oppMs) {
      behindTotal++;
      if (g.result === "win") behindWins++;
    }
  }

  // Timeout material balance — scan all live games (not just clock-annotated ones)
  const tmWins: TimeoutMaterialCounts = { ahead: 0, equal: 0, behind: 0, total: 0 };
  const tmLosses: TimeoutMaterialCounts = { ahead: 0, equal: 0, behind: 0, total: 0 };
  for (const g of liveGames) {
    if (terminationBucketForGame(g) !== "timeout") continue;
    if (g.result !== "win" && g.result !== "loss") continue;
    if (!g.finalFen) continue;
    const bucket = toMaterialBucket(materialDiffFromFen(g.finalFen, g.userColor));
    const counts = g.result === "win" ? tmWins : tmLosses;
    counts[bucket]++;
    counts.total++;
  }
  const hasTimeouts = tmWins.total > 0 || tmLosses.total > 0;

  return {
    byResult,
    aheadOnClockWinRate: aheadTotal === 0 ? null : aheadWins / aheadTotal,
    behindOnClockWinRate: behindTotal === 0 ? null : behindWins / behindTotal,
    aheadCount: aheadTotal,
    behindCount: behindTotal,
    sampleSize: clockGames.length,
    totalLiveGames: liveGames.length,
    timeoutMaterial: hasTimeouts ? { wins: tmWins, losses: tmLosses } : null,
  };
}
