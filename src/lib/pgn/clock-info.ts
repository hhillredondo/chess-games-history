import type { Move } from "chess.js";

/** `[TimeControl "300+2"]` tag value, if present. */
export function extractTimeControlFromPgn(pgn: string): string | undefined {
  const m = /\[TimeControl\s+"([^"]*)"\]/i.exec(pgn);
  const v = m?.[1]?.trim();
  return v || undefined;
}

/** All `[%clk …]` values in PGN order (one per annotated half-move). */
export function parseClkStringsFromPgn(pgn: string): string[] {
  return [...pgn.matchAll(/\[%clk\s+([^\]]+?)\s*\]/gi)].map((x) =>
    x[1]!.trim()
  );
}

export type ClockPair = { white: string | null; black: string | null };

/**
 * After each ply index `p` (0 = before first move), last known clock for each side.
 * Relies on `%clk` order matching `hist` half-moves (Lichess / many Chess.com exports).
 */
export function clocksAtEachPly(pgn: string, hist: Move[]): ClockPair[] {
  const clks = parseClkStringsFromPgn(pgn);
  const out: ClockPair[] = [];
  let white: string | null = null;
  let black: string | null = null;
  out.push({ white, black });
  for (let i = 0; i < hist.length; i++) {
    const t = clks[i];
    if (hist[i]!.color === "w" && t) white = t;
    else if (hist[i]!.color === "b" && t) black = t;
    out.push({ white, black });
  }
  return out;
}

/** Real-world span between first and last timestamp (wall clock). */
export function formatWallClockDuration(playedAt: string, endAt: string): string {
  const a = new Date(playedAt).getTime();
  const b = new Date(endAt).getTime();
  const ms = b - a;
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const sTotal = Math.floor(ms / 1000);
  const h = Math.floor(sTotal / 3600);
  const m = Math.floor((sTotal % 3600) / 60);
  const s = sTotal % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
