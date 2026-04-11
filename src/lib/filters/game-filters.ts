import { Chess } from "chess.js";

import type { UnifiedGame, UserResult, GameSource } from "@/lib/types/unified-game";

/* ──────────────────────────────────────────────────────────────────────── */
/*  Termination bucketing                                                   */
/* ──────────────────────────────────────────────────────────────────────── */

export type TerminationBucket =
  | "checkmate"
  | "resign"
  | "timeout"
  | "stalemate"
  | "insufficient"
  | "repetition"
  | "agreement"
  | "abandoned"
  | "other"
  | "unknown";

export const TERMINATION_BUCKETS: TerminationBucket[] = [
  "checkmate",
  "resign",
  "timeout",
  "stalemate",
  "insufficient",
  "repetition",
  "agreement",
  "abandoned",
  "other",
  "unknown",
];

const TERMINATION_LABELS: Record<TerminationBucket, string> = {
  checkmate: "Checkmate",
  resign: "Resignation",
  timeout: "Timeout",
  stalemate: "Stalemate",
  insufficient: "Insufficient material",
  repetition: "Repetition",
  agreement: "Agreement",
  abandoned: "Abandoned",
  other: "Other",
  unknown: "Unknown",
};

export function terminationLabel(bucket: TerminationBucket): string {
  return TERMINATION_LABELS[bucket];
}

/**
 * Map a game to a coarse termination bucket using:
 *   1. explicit text hints in `termination`,
 *   2. the final-position state via chess.js for checkmate / stalemate /
 *      insufficient material,
 *   3. the game result when none of the above narrow it down.
 *
 * Non-perfect by design — see the plan's "out of scope" notes. Missing or
 * ambiguous data falls through to `unknown`.
 */

// Module-level cache so the chess.js FEN inspection is only done once per game
// across the session. Keyed by `${source}:${id}`.
const _terminationCache = new Map<string, TerminationBucket>();

export function terminationBucketForGame(game: UnifiedGame): TerminationBucket {
  const cacheKey = `${game.source}:${game.id}`;
  const cached = _terminationCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const result = _computeTerminationBucket(game);
  _terminationCache.set(cacheKey, result);
  return result;
}

function _computeTerminationBucket(game: UnifiedGame): TerminationBucket {
  const raw = game.termination?.toLowerCase().trim() ?? "";

  // Timeout — Lichess: "time forfeit"; Chess.com: "won on time" / "lost on time"
  if (
    raw.includes("time forfeit") ||
    raw.includes("timeout") ||
    raw.includes("time out") ||
    raw.includes("on time")
  ) {
    return "timeout";
  }
  // Resignation — Chess.com: "won by resignation" / "lost by resignation"
  if (raw.includes("resign")) return "resign";
  if (raw.includes("abandon")) return "abandoned";
  if (raw.includes("stalemate")) return "stalemate";
  if (raw.includes("insufficient")) return "insufficient";
  if (raw.includes("repetition")) return "repetition";
  if (raw.includes("agreement") || raw.includes("agreed") || raw.includes("mutual")) {
    return "agreement";
  }
  // Chess.com encodes checkmate in the termination string too
  if (raw.includes("checkmate")) return "checkmate";

  // Final-position inspection (catches Lichess "Normal" + other ambiguous tags).
  let endState: { mate: boolean; stalemate: boolean; insufficient: boolean } | null = null;
  try {
    const c = new Chess(game.finalFen);
    endState = {
      mate: c.isCheckmate(),
      stalemate: c.isStalemate(),
      insufficient: c.isInsufficientMaterial(),
    };
  } catch {
    endState = null;
  }

  if (endState?.mate) return "checkmate";
  if (endState?.stalemate) return "stalemate";

  if (game.result === "draw") {
    if (endState?.insufficient) return "insufficient";
    // Without better info, assume draws with no other hint are by agreement.
    if (raw === "" || raw === "normal") return "agreement";
    return "other";
  }

  if (game.result === "win" || game.result === "loss") {
    // Decisive + not mate → resignation is the dominant real-world case on both sites.
    if (raw === "" || raw === "normal") return "resign";
    return "other";
  }

  return "unknown";
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Time control normalization                                              */
/* ──────────────────────────────────────────────────────────────────────── */

export type TimeControlCategory =
  | "bullet"
  | "blitz"
  | "rapid"
  | "classical"
  | "correspondence"
  | "unknown";

export const TIME_CONTROL_CATEGORIES: TimeControlCategory[] = [
  "bullet",
  "blitz",
  "rapid",
  "classical",
  "correspondence",
  "unknown",
];

const TIME_CONTROL_LABELS: Record<TimeControlCategory, string> = {
  bullet: "Bullet",
  blitz: "Blitz",
  rapid: "Rapid",
  classical: "Classical",
  correspondence: "Correspondence",
  unknown: "Unknown",
};

export function timeControlLabel(cat: TimeControlCategory): string {
  return TIME_CONTROL_LABELS[cat];
}

/**
 * Parse `base+increment` (seconds) from a PGN TimeControl header and bucket
 * into bullet / blitz / rapid / classical / correspondence.
 *
 * Uses the common "estimated duration" formula: `base + 40 * increment`.
 * Correspondence is detected by an explicit `1/{days}` format.
 */
export function timeControlCategory(timeControl: string | undefined): TimeControlCategory {
  if (!timeControl) return "unknown";
  const tc = timeControl.trim();
  if (!tc || tc === "-") return "unknown";
  if (tc.startsWith("1/")) return "correspondence";
  const m = /^(\d+)(?:\+(\d+))?$/.exec(tc);
  if (!m) return "unknown";
  const base = Number(m[1]);
  const inc = Number(m[2] ?? 0);
  if (!Number.isFinite(base)) return "unknown";
  const est = base + 40 * inc;
  if (est < 180) return "bullet";
  if (est < 600) return "blitz";
  if (est < 1800) return "rapid";
  return "classical";
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Filter shape                                                            */
/* ──────────────────────────────────────────────────────────────────────── */

export interface GameFilters {
  /** Only games whose time control is in this set. Empty / undefined = no filter. */
  timeControls?: TimeControlCategory[];
  /** Only games whose source platform is in this set. */
  sources?: GameSource[];
  /** Inclusive lower bound on `endAt` (ISO date string YYYY-MM-DD, interpreted in UTC). */
  dateFrom?: string;
  /** Inclusive upper bound on `endAt` (ISO date string YYYY-MM-DD, interpreted in UTC end-of-day). */
  dateUntil?: string;
  /** Restrict to games played as this colour. */
  color?: "white" | "black";
  /** Restrict to one or more results (win / loss / draw). */
  results?: UserResult[];
  /** Min (user_rating - opponent_rating). */
  eloDiffMin?: number;
  /** Max (user_rating - opponent_rating). */
  eloDiffMax?: number;
  /** Case-insensitive substring match on opening name / ECO. */
  opening?: string;
  /** Min total moves (ply count / 2, rounded up). */
  movesMin?: number;
  /** Max total moves. */
  movesMax?: number;
  /** Case-insensitive substring on opponent name. */
  opponent?: string;
  /** Min wall-clock duration in minutes. */
  minutesMin?: number;
  /** Max wall-clock duration in minutes. */
  minutesMax?: number;
  /** Restrict to one or more termination buckets. */
  terminations?: TerminationBucket[];
}

export const EMPTY_FILTERS: GameFilters = {};

export function isFilterActive(filters: GameFilters): boolean {
  return (
    (filters.timeControls?.length ?? 0) > 0 ||
    (filters.sources?.length ?? 0) > 0 ||
    Boolean(filters.dateFrom) ||
    Boolean(filters.dateUntil) ||
    Boolean(filters.color) ||
    (filters.results?.length ?? 0) > 0 ||
    filters.eloDiffMin != null ||
    filters.eloDiffMax != null ||
    Boolean(filters.opening?.trim()) ||
    filters.movesMin != null ||
    filters.movesMax != null ||
    Boolean(filters.opponent?.trim()) ||
    filters.minutesMin != null ||
    filters.minutesMax != null ||
    (filters.terminations?.length ?? 0) > 0
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Game-level helpers                                                      */
/* ──────────────────────────────────────────────────────────────────────── */

export function userRating(g: UnifiedGame): number | undefined {
  return g.userColor === "white" ? g.whiteRating : g.blackRating;
}

export function opponentRating(g: UnifiedGame): number | undefined {
  return g.userColor === "white" ? g.blackRating : g.whiteRating;
}

export function opponentName(g: UnifiedGame): string {
  return g.userColor === "white" ? g.blackName : g.whiteName;
}

export function fullMoveCount(g: UnifiedGame): number {
  return Math.ceil(g.plyCount / 2);
}

export function wallClockMinutes(g: UnifiedGame): number | null {
  const a = new Date(g.playedAt).getTime();
  const b = new Date(g.endAt).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return (b - a) / 60_000;
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Apply                                                                   */
/* ──────────────────────────────────────────────────────────────────────── */

function dateBoundary(value: string | undefined, endOfDay: boolean): number | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d] = m;
  const t = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0
  );
  return Number.isFinite(t) ? t : null;
}

export function applyFilters(
  games: UnifiedGame[],
  filters: GameFilters
): UnifiedGame[] {
  if (!isFilterActive(filters)) return games;

  const fromT = dateBoundary(filters.dateFrom, false);
  const untilT = dateBoundary(filters.dateUntil, true);
  const openingQ = filters.opening?.trim().toLowerCase() ?? "";
  const opponentQ = filters.opponent?.trim().toLowerCase() ?? "";
  const tcSet = filters.timeControls?.length ? new Set(filters.timeControls) : null;
  const srcSet = filters.sources?.length ? new Set(filters.sources) : null;
  const resultSet = filters.results?.length ? new Set(filters.results) : null;
  const termSet = filters.terminations?.length ? new Set(filters.terminations) : null;

  return games.filter((g) => {
    if (srcSet && !srcSet.has(g.source)) return false;
    if (tcSet && !tcSet.has(timeControlCategory(g.timeControl))) return false;

    if (fromT != null || untilT != null) {
      const t = new Date(g.endAt).getTime();
      if (fromT != null && t < fromT) return false;
      if (untilT != null && t > untilT) return false;
    }

    if (filters.color && g.userColor !== filters.color) return false;
    if (resultSet && !resultSet.has(g.result)) return false;

    if (filters.eloDiffMin != null || filters.eloDiffMax != null) {
      const ur = userRating(g);
      const or = opponentRating(g);
      if (ur == null || or == null) return false;
      const diff = ur - or;
      if (filters.eloDiffMin != null && diff < filters.eloDiffMin) return false;
      if (filters.eloDiffMax != null && diff > filters.eloDiffMax) return false;
    }

    if (openingQ) {
      const name = g.opening?.name?.toLowerCase() ?? "";
      const eco = g.opening?.eco?.toLowerCase() ?? "";
      if (!name.includes(openingQ) && !eco.includes(openingQ)) return false;
    }

    if (filters.movesMin != null || filters.movesMax != null) {
      const moves = fullMoveCount(g);
      if (filters.movesMin != null && moves < filters.movesMin) return false;
      if (filters.movesMax != null && moves > filters.movesMax) return false;
    }

    if (opponentQ) {
      if (!opponentName(g).toLowerCase().includes(opponentQ)) return false;
    }

    if (filters.minutesMin != null || filters.minutesMax != null) {
      // Reported session span is not meaningful for correspondence / daily games.
      if (timeControlCategory(g.timeControl) === "correspondence") return false;
      const mins = wallClockMinutes(g);
      if (mins == null) return false;
      if (filters.minutesMin != null && mins < filters.minutesMin) return false;
      if (filters.minutesMax != null && mins > filters.minutesMax) return false;
    }

    if (termSet && !termSet.has(terminationBucketForGame(g))) return false;

    return true;
  });
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Option derivation for filter UI                                         */
/* ──────────────────────────────────────────────────────────────────────── */

export interface DerivedFilterOptions {
  timeControls: TimeControlCategory[];
  sources: GameSource[];
  terminations: TerminationBucket[];
  /** Result values that appear at least once in the loaded set. */
  results: UserResult[];
  minDate: string | null;
  maxDate: string | null;
  minMoves: number;
  maxMoves: number;
  /** At least one game is not correspondence — wall-clock span filter is meaningful. */
  minutesFilterAvailable: boolean;
}

export function deriveFilterOptions(games: UnifiedGame[]): DerivedFilterOptions {
  const tcs = new Set<TimeControlCategory>();
  const srcs = new Set<GameSource>();
  const terms = new Set<TerminationBucket>();
  const results = new Set<UserResult>();
  let minT: number | null = null;
  let maxT: number | null = null;
  let minM = Number.POSITIVE_INFINITY;
  let maxM = 0;
  let minutesFilterAvailable = false;

  for (const g of games) {
    const cat = timeControlCategory(g.timeControl);
    if (cat !== "correspondence") minutesFilterAvailable = true;
    tcs.add(cat);
    srcs.add(g.source);
    terms.add(terminationBucketForGame(g));
    results.add(g.result);
    const t = new Date(g.endAt).getTime();
    if (Number.isFinite(t)) {
      if (minT == null || t < minT) minT = t;
      if (maxT == null || t > maxT) maxT = t;
    }
    const moves = fullMoveCount(g);
    if (moves < minM) minM = moves;
    if (moves > maxM) maxM = moves;
  }

  const toIsoDate = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

  const RESULT_ORDER: UserResult[] = ["win", "loss", "draw", "unknown"];

  return {
    timeControls: TIME_CONTROL_CATEGORIES.filter((c) => tcs.has(c)),
    sources: (["chesscom", "lichess"] as GameSource[]).filter((s) => srcs.has(s)),
    terminations: TERMINATION_BUCKETS.filter((t) => terms.has(t)),
    results: RESULT_ORDER.filter((r) => results.has(r)),
    minDate: minT == null ? null : toIsoDate(minT),
    maxDate: maxT == null ? null : toIsoDate(maxT),
    minMoves: Number.isFinite(minM) ? minM : 0,
    maxMoves: maxM,
    minutesFilterAvailable,
  };
}
