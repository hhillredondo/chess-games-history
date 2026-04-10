import { publicApiHeaders } from "@/lib/http/user-agent";
import type { UnifiedGame } from "@/lib/types/unified-game";
import {
  clocksAtEachPly,
  extractTimeControlFromPgn,
} from "@/lib/pgn/clock-info";
import { pgnToFinalFen } from "@/lib/pgn/final-fen";
import { resultFromPgnHeaders } from "@/lib/pgn/user-result";
import { resolveOpeningFromLoadedGame } from "@/lib/openings/classify";
import { Chess } from "chess.js";

interface ArchivesResponse {
  archives?: string[];
}

interface MonthlyGamesResponse {
  games?: ChessComGameJson[];
}

interface ChessComGameJson {
  url?: string;
  pgn?: string;
  end_time?: number;
}

/** Resume fetching: month index (newest-first), skip first N games in that month. */
export type ChessComCursor = { monthIdx: number; gameSkip: number };

function isoFromPgnHeaders(h: Record<string, string | null>): string {
  const date = h.UTCDate;
  const time = h.UTCTime;
  if (date && time) {
    const [y, m, d] = date.split(".");
    const [hh, mm, ss] = time.split(":");
    if (y && m && d && hh != null && mm != null) {
      return new Date(
        Date.UTC(
          Number(y),
          Number(m) - 1,
          Number(d),
          Number(hh),
          Number(mm),
          Number(ss ?? 0)
        )
      ).toISOString();
    }
  }
  return new Date().toISOString();
}

function parseRating(v: string | undefined): number | undefined {
  if (!v || v === "?" || v === "-") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function tryMapGame(
  g: ChessComGameJson,
  user: string
): UnifiedGame | null {
  const pgn = g.pgn?.trim();
  if (!pgn) return null;

  const fen = pgnToFinalFen(pgn);
  if (!fen) return null;

  let chess: Chess;
  try {
    chess = new Chess();
    chess.loadPgn(pgn, { newlineChar: "\n" });
  } catch {
    return null;
  }

  const h = chess.getHeaders();
  const white = (h.White ?? "").trim();
  const black = (h.Black ?? "").trim();
  const rr = resultFromPgnHeaders(white, black, user, h.Result ?? undefined);
  if (!rr) return null;

  const playedAt = isoFromPgnHeaders(h);
  const endAt =
    typeof g.end_time === "number"
      ? new Date(g.end_time * 1000).toISOString()
      : playedAt;

  const hist = chess.history({ verbose: true });
  const snap = clocksAtEachPly(pgn, hist);
  const end = snap[hist.length] ?? { white: null, black: null };
  const tc =
    extractTimeControlFromPgn(pgn) ?? h.TimeControl?.trim() ?? undefined;

  return {
    source: "chesscom",
    id: g.url ?? `cc-${g.end_time}-${white}-${black}`,
    playedAt,
    endAt,
    whiteName: white,
    blackName: black,
    whiteRating: parseRating(h.WhiteElo ?? undefined),
    blackRating: parseRating(h.BlackElo ?? undefined),
    result: rr.result,
    userColor: rr.userColor,
    pgn,
    finalFen: fen,
    opening: resolveOpeningFromLoadedGame(hist, {
      eco: h.ECO?.trim(),
      name: h.Opening?.trim(),
    }),
    timeControl: tc,
    endClockWhite: end.white ?? undefined,
    endClockBlack: end.black ?? undefined,
  };
}

/**
 * Fetch up to `limit` games starting at `cursor` (newest months first).
 */
export async function fetchChessComGamesPage(
  username: string,
  limit: number,
  cursor: ChessComCursor | null
): Promise<{
  games: UnifiedGame[];
  nextCursor: ChessComCursor | null;
}> {
  const user = username.trim().toLowerCase();
  if (!user || limit < 1) {
    return { games: [], nextCursor: null };
  }

  const archivesUrl = `https://api.chess.com/pub/player/${encodeURIComponent(
    user
  )}/games/archives`;

  const res = await fetch(archivesUrl, {
    headers: publicApiHeaders(),
    cache: "no-store",
  });

  if (res.status === 404) return { games: [], nextCursor: null };
  if (!res.ok) {
    throw new Error(`Chess.com archives HTTP ${res.status}`);
  }

  const data = (await res.json()) as ArchivesResponse;
  const archives = data.archives ?? [];
  /** Newest months first. */
  const months = [...archives].reverse();

  if (months.length === 0) {
    return { games: [], nextCursor: null };
  }

  let monthIdx = Math.max(0, cursor?.monthIdx ?? 0);
  let gameSkip = Math.max(0, cursor?.gameSkip ?? 0);

  if (monthIdx >= months.length) {
    return { games: [], nextCursor: null };
  }

  const out: UnifiedGame[] = [];

  while (out.length < limit && monthIdx < months.length) {
    const monthUrl = months[monthIdx]!;

    const monthRes = await fetch(monthUrl, {
      headers: publicApiHeaders(),
      cache: "no-store",
    });
    if (!monthRes.ok) {
      monthIdx += 1;
      gameSkip = 0;
      continue;
    }

    const monthData = (await monthRes.json()) as MonthlyGamesResponse;
    const games = monthData.games ?? [];

    let i = gameSkip;
    for (; i < games.length && out.length < limit; i++) {
      const mapped = tryMapGame(games[i]!, user);
      if (mapped) out.push(mapped);
    }

    const stoppedMidMonth = i < games.length && out.length >= limit;
    const finishedMonth = i >= games.length;

    if (stoppedMidMonth) {
      return {
        games: out,
        nextCursor: { monthIdx, gameSkip: i },
      };
    }

    monthIdx += 1;
    gameSkip = 0;

    if (finishedMonth && monthIdx >= months.length) {
      return { games: out, nextCursor: null };
    }
  }

  return { games: out, nextCursor: null };
}
