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

interface LichessNdjsonGame {
  id: string;
  createdAt: number;
  lastMoveAt?: number;
  pgn?: string;
  opening?: { eco?: string; name?: string };
  players?: {
    white?: { user?: { name?: string }; rating?: number };
    black?: { user?: { name?: string }; rating?: number };
  };
}

function parseRating(n: unknown): number | undefined {
  if (typeof n !== "number" || !Number.isFinite(n)) return undefined;
  return n;
}

function eloFromHeader(v: string | undefined): number | undefined {
  if (!v || v === "?" || v === "-") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function mapRow(row: LichessNdjsonGame, user: string): UnifiedGame | null {
  const pgn = row.pgn?.trim();
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
  const white = (h.White ?? row.players?.white?.user?.name ?? "").trim();
  const black = (h.Black ?? row.players?.black?.user?.name ?? "").trim();
  const rr = resultFromPgnHeaders(white, black, user, h.Result ?? undefined);
  if (!rr) return null;

  const playedAt = new Date(row.createdAt).toISOString();
  const endAt = new Date(row.lastMoveAt ?? row.createdAt).toISOString();

  const whiteR =
    parseRating(row.players?.white?.rating) ?? eloFromHeader(h.WhiteElo);
  const blackR =
    parseRating(row.players?.black?.rating) ?? eloFromHeader(h.BlackElo);

  const hist = chess.history({ verbose: true });
  const snap = clocksAtEachPly(pgn, hist);
  const end = snap[hist.length] ?? { white: null, black: null };
  const tc =
    extractTimeControlFromPgn(pgn) ?? h.TimeControl?.trim() ?? undefined;

  return {
    source: "lichess",
    id: row.id,
    playedAt,
    endAt,
    whiteName: white,
    blackName: black,
    whiteRating: whiteR,
    blackRating: blackR,
    result: rr.result,
    userColor: rr.userColor,
    pgn,
    finalFen: fen,
    opening: resolveOpeningFromLoadedGame(hist, {
      eco: row.opening?.eco,
      name: row.opening?.name,
    }),
    timeControl: tc,
    endClockWhite: end.white ?? undefined,
    endClockBlack: end.black ?? undefined,
    plyCount: hist.length,
    termination: h.Termination?.trim() || undefined,
    gameUrl: `https://lichess.org/${row.id}`,
  };
}

const RETRY_STATUS_CODES = new Set([429, 502, 503, 504]);
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2_000;

async function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch up to `limit` games. Pass `until` (ms) from a previous `nextUntil` to
 * get older games. Pass `since` (ms) to stop once all games are older than
 * that timestamp — used by refresh to avoid re-downloading full history.
 */
export async function fetchLichessGamesPage(
  username: string,
  limit: number,
  until: number | undefined,
  since?: number
): Promise<{
  games: UnifiedGame[];
  /** Pass to the next request to continue (older games). Null if no more. */
  nextUntil: number | null;
}> {
  const user = username.trim().toLowerCase();
  if (!user || limit < 1) {
    return { games: [], nextUntil: null };
  }

  const out: UnifiedGame[] = [];
  let pageUntil = until;

  while (out.length < limit) {
    const batch = Math.min(100, limit - out.length);
    const url = new URL(
      `https://lichess.org/api/games/user/${encodeURIComponent(user)}`
    );
    url.searchParams.set("max", String(batch));
    url.searchParams.set("pgnInJson", "true");
    url.searchParams.set("clocks", "true");
    if (pageUntil != null) {
      url.searchParams.set("until", String(pageUntil));
    }
    if (since != null) {
      url.searchParams.set("since", String(since));
    }

    let res: Response | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      res = await fetch(url, {
        headers: publicApiHeaders({
          Accept: "application/x-ndjson",
        }),
        cache: "no-store",
      });

      if (res.status === 404) {
        return { games: out, nextUntil: null };
      }

      if (res.ok) break;

      if (RETRY_STATUS_CODES.has(res.status) && attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * 2 ** attempt;
        await sleepMs(delay);
        continue;
      }

      throw new Error(`Lichess games HTTP ${res.status}`);
    }

    const text = await res!.text();
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      return { games: out, nextUntil: null };
    }

    /** Oldest among games we actually stored (when stopping at limit). */
    let oldestIncludedMs: number | undefined;

    for (const line of lines) {
      if (out.length >= limit) break;

      let row: LichessNdjsonGame;
      try {
        row = JSON.parse(line) as LichessNdjsonGame;
      } catch {
        continue;
      }

      const mapped = mapRow(row, user);
      if (mapped) {
        out.push(mapped);
        oldestIncludedMs = row.createdAt;
      }
    }

    let oldestInBatchMs: number | undefined;
    try {
      oldestInBatchMs = (
        JSON.parse(lines[lines.length - 1]!) as LichessNdjsonGame
      ).createdAt;
    } catch {
      oldestInBatchMs = undefined;
    }

    if (oldestInBatchMs == null) {
      return { games: out, nextUntil: null };
    }

    if (out.length >= limit) {
      const cursor = (oldestIncludedMs ?? oldestInBatchMs) - 1;
      return { games: out, nextUntil: cursor };
    }

    if (lines.length < batch) {
      return { games: out, nextUntil: null };
    }

    pageUntil = oldestInBatchMs - 1;
  }

  return { games: out, nextUntil: null };
}
