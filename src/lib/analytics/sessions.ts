import type { GameSource, UnifiedGame } from "@/lib/types/unified-game";

export interface Session {
  games: UnifiedGame[];
  startAt: Date;
  endAt: Date;
  durationMs: number;
  wins: number;
  losses: number;
  draws: number;
  /**
   * Net ELO change over the session (last game's rating − first game's rating).
   * Only set for single-source sessions where both endpoints have rating data.
   */
  eloGain?: number;
}

export interface SessionStats {
  sessions: Session[];
  totalGames: number;
  /** Number of correspondence games excluded before clustering. */
  correspondenceFiltered: number;
  longestByCount: Session | null;
  longestByDuration: Session | null;
  avgGamesPerSession: number;
  avgDurationMs: number;
  bestByEloGain: Session | null;
  worstByEloLoss: Session | null;
}

/**
 * Returns true for correspondence / daily games that should be excluded from
 * session analytics (they can span days or weeks, making duration stats useless).
 */
function isCorrespondence(timeControl?: string): boolean {
  if (!timeControl) return false;
  // Standard marker used by both Chess.com and Lichess in PGN headers
  if (timeControl === "-") return true;
  // Lichess occasionally uses the word explicitly
  if (timeControl.toLowerCase() === "correspondence") return true;
  // Chess.com daily format: moves-per-seconds e.g. "1/86400", "1/259200"
  if (/^\d+\/\d+$/.test(timeControl)) return true;
  return false;
}

function userRating(g: UnifiedGame): number | undefined {
  return g.userColor === "white" ? g.whiteRating : g.blackRating;
}

function buildSession(games: UnifiedGame[]): Session {
  const startAt = new Date(games[0]!.playedAt);
  const endAt = new Date(games[games.length - 1]!.endAt);

  // ELO gain only meaningful for single-source sessions (ratings aren't
  // comparable across Chess.com and Lichess pools)
  const sources = new Set<GameSource>(games.map((g) => g.source));
  let eloGain: number | undefined;
  if (sources.size === 1) {
    const rated = games.filter((g) => userRating(g) != null);
    if (rated.length >= 2) {
      eloGain =
        userRating(rated[rated.length - 1]!)! - userRating(rated[0]!)!;
    }
  }

  return {
    games,
    startAt,
    endAt,
    durationMs: Math.max(0, endAt.getTime() - startAt.getTime()),
    wins: games.filter((g) => g.result === "win").length,
    losses: games.filter((g) => g.result === "loss").length,
    draws: games.filter((g) => g.result === "draw").length,
    eloGain,
  };
}

export function clusterSessions(
  games: UnifiedGame[],
  gapMinutes: number
): SessionStats {
  const realTime = games.filter((g) => !isCorrespondence(g.timeControl));
  const correspondenceFiltered = games.length - realTime.length;

  const empty: SessionStats = {
    sessions: [],
    totalGames: 0,
    correspondenceFiltered,
    longestByCount: null,
    longestByDuration: null,
    avgGamesPerSession: 0,
    avgDurationMs: 0,
    bestByEloGain: null,
    worstByEloLoss: null,
  };
  if (realTime.length === 0) return empty;

  const sorted = [...realTime].sort(
    (a, b) => new Date(a.endAt).getTime() - new Date(b.endAt).getTime()
  );

  const gapMs = gapMinutes * 60 * 1000;
  const sessions: Session[] = [];
  let current: UnifiedGame[] = [sorted[0]!];

  for (let i = 1; i < sorted.length; i++) {
    const prevEnd = new Date(sorted[i - 1]!.endAt).getTime();
    const currEnd = new Date(sorted[i]!.endAt).getTime();
    if (currEnd - prevEnd > gapMs) {
      sessions.push(buildSession(current));
      current = [sorted[i]!];
    } else {
      current.push(sorted[i]!);
    }
  }
  sessions.push(buildSession(current));

  const longestByCount = sessions.reduce<Session | null>(
    (best, s) => (best === null || s.games.length > best.games.length ? s : best),
    null
  );
  const longestByDuration = sessions.reduce<Session | null>(
    (best, s) => (best === null || s.durationMs > best.durationMs ? s : best),
    null
  );
  const totalDurationMs = sessions.reduce((sum, s) => sum + s.durationMs, 0);

  const withElo = sessions.filter(
    (s): s is Session & { eloGain: number } => s.eloGain !== undefined
  );
  const bestByEloGain =
    withElo.length > 0
      ? withElo.reduce((b, s) => (s.eloGain > b.eloGain ? s : b))
      : null;
  const worstByEloLoss =
    withElo.length > 0
      ? withElo.reduce((b, s) => (s.eloGain < b.eloGain ? s : b))
      : null;

  return {
    sessions,
    totalGames: realTime.length,
    correspondenceFiltered,
    longestByCount,
    longestByDuration,
    avgGamesPerSession: realTime.length / sessions.length,
    avgDurationMs: totalDurationMs / sessions.length,
    bestByEloGain,
    worstByEloLoss,
  };
}
