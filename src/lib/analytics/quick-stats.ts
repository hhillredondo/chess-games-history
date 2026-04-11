import { timeControlCategory } from "@/lib/filters/game-filters";
import type { UnifiedGame } from "@/lib/types/unified-game";

export interface QuickStats {
  count: number;
  wins: number;
  losses: number;
  draws: number;
  unknownResults: number;
  /** Wins + 0.5 * draws over decided games. `null` if no decided games. */
  winRate: number | null;
  /** Average remaining clock (ms) for the user, across games that have clock data. */
  userAvgClockMs: number | null;
  /** Average remaining clock (ms) for the opponent, same sample. */
  opponentAvgClockMs: number | null;
  /** Games in the set that had clock data (non-correspondence + `%clk` present). */
  clockCoverageCount: number;
  /** Games in the set that could have had clock data (everything non-correspondence). */
  clockCoverageDenominator: number;
}

/**
 * Parse `H:MM:SS` / `HH:MM:SS(.f)` / `MM:SS` / `SS.s` clock strings emitted
 * by the PGN `[%clk …]` annotation into milliseconds.
 */
export function clockStringToMs(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":").map((p) => p.trim());
  if (parts.length === 0 || parts.length > 3) return null;
  let h = 0;
  let m = 0;
  let s = 0;
  if (parts.length === 3) {
    h = Number(parts[0]);
    m = Number(parts[1]);
    s = Number(parts[2]);
  } else if (parts.length === 2) {
    m = Number(parts[0]);
    s = Number(parts[1]);
  } else {
    s = Number(parts[0]);
  }
  if (!Number.isFinite(h) || !Number.isFinite(m) || !Number.isFinite(s)) return null;
  if (h < 0 || m < 0 || s < 0) return null;
  return Math.round((h * 3600 + m * 60 + s) * 1000);
}

export function formatClockMs(ms: number | null): string {
  if (ms == null) return "—";
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function computeQuickStats(games: UnifiedGame[]): QuickStats {
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let unknownResults = 0;

  let userClockSum = 0;
  let opponentClockSum = 0;
  let clockCoverageCount = 0;
  let clockCoverageDenominator = 0;

  for (const g of games) {
    switch (g.result) {
      case "win":
        wins++;
        break;
      case "loss":
        losses++;
        break;
      case "draw":
        draws++;
        break;
      default:
        unknownResults++;
    }

    // Clock stats only for non-correspondence games.
    const tc = timeControlCategory(g.timeControl);
    if (tc === "correspondence") continue;
    clockCoverageDenominator++;

    const userRaw = g.userColor === "white" ? g.endClockWhite : g.endClockBlack;
    const oppRaw = g.userColor === "white" ? g.endClockBlack : g.endClockWhite;
    const userMs = clockStringToMs(userRaw);
    const oppMs = clockStringToMs(oppRaw);
    if (userMs != null && oppMs != null) {
      clockCoverageCount++;
      userClockSum += userMs;
      opponentClockSum += oppMs;
    }
  }

  const decided = wins + losses + draws;
  const winRate = decided === 0 ? null : (wins + 0.5 * draws) / decided;

  const userAvg =
    clockCoverageCount === 0 ? null : userClockSum / clockCoverageCount;
  const oppAvg =
    clockCoverageCount === 0 ? null : opponentClockSum / clockCoverageCount;

  return {
    count: games.length,
    wins,
    losses,
    draws,
    unknownResults,
    winRate,
    userAvgClockMs: userAvg,
    opponentAvgClockMs: oppAvg,
    clockCoverageCount,
    clockCoverageDenominator,
  };
}
