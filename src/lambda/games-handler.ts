import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";

import { fetchChessComGamesPage, type ChessComCursor } from "../lib/fetch/chesscom";
import { fetchLichessGamesPage } from "../lib/fetch/lichess";
import type { UnifiedGame } from "../lib/types/unified-game";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

function jsonResponse(body: unknown, status = 200): APIGatewayProxyResultV2 {
  return {
    statusCode: status,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

function parsePerPlatform(raw: string | undefined): number {
  const n = Number(raw ?? "");
  if (!Number.isFinite(n) || n < 1) return 100;
  return Math.min(100, Math.floor(n));
}

function mergeByEndAtDesc(games: UnifiedGame[]): UnifiedGame[] {
  return [...games].sort(
    (a, b) => new Date(b.endAt).getTime() - new Date(a.endAt).getTime()
  );
}

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  // Handle CORS preflight
  if (event.requestContext.http.method === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  const p = event.queryStringParameters ?? {};

  const chesscom = (p.chesscom ?? "").trim();
  const lichess = (p.lichess ?? "").trim();
  const perPlatform = parsePerPlatform(p.perPlatform);

  const noChesscom = p.noChesscom === "1";
  const noLichess = p.noLichess === "1";

  let lichessUntil: number | undefined;
  if (p.lichessUntil != null && p.lichessUntil !== "") {
    const u = Number(p.lichessUntil);
    if (!Number.isFinite(u)) {
      return jsonResponse(
        { error: "Invalid lichessUntil (expected milliseconds timestamp)." },
        400
      );
    }
    lichessUntil = u;
  }

  let chesscomCursor: ChessComCursor | null = null;
  if (p.ccMonth != null || p.ccSkip != null) {
    const monthIdx = Number(p.ccMonth ?? "0");
    const gameSkip = Number(p.ccSkip ?? "0");
    if (!Number.isFinite(monthIdx) || !Number.isFinite(gameSkip)) {
      return jsonResponse(
        { error: "Invalid ccMonth / ccSkip (expected integers)." },
        400
      );
    }
    chesscomCursor = {
      monthIdx: Math.max(0, Math.floor(monthIdx)),
      gameSkip: Math.max(0, Math.floor(gameSkip)),
    };
  }

  if (!chesscom && !lichess) {
    return jsonResponse(
      { error: "Provide query params chesscom and/or lichess (username)." },
      400
    );
  }

  const fetchCc = Boolean(chesscom) && !noChesscom;
  const fetchLi = Boolean(lichess) && !noLichess;

  if (!fetchCc && !fetchLi) {
    return jsonResponse(
      { error: "Nothing to fetch (check noChesscom / noLichess vs usernames)." },
      400
    );
  }

  const errors: { chesscom?: string; lichess?: string } = {};
  let ccGames: UnifiedGame[] = [];
  let nextChesscom: ChessComCursor | null = null;
  let liGames: UnifiedGame[] = [];
  let nextLichessUntil: number | null = null;

  await Promise.all([
    fetchCc
      ? fetchChessComGamesPage(chesscom, perPlatform, chesscomCursor)
          .then(({ games, nextCursor }) => {
            ccGames = games;
            nextChesscom = nextCursor;
          })
          .catch((e: unknown) => {
            errors.chesscom =
              e instanceof Error ? e.message : "Chess.com fetch failed";
          })
      : Promise.resolve(),
    fetchLi
      ? fetchLichessGamesPage(lichess, perPlatform, lichessUntil)
          .then(({ games, nextUntil }) => {
            liGames = games;
            nextLichessUntil = nextUntil;
          })
          .catch((e: unknown) => {
            errors.lichess =
              e instanceof Error ? e.message : "Lichess fetch failed";
          })
      : Promise.resolve(),
  ]);

  const collected = mergeByEndAtDesc([...ccGames, ...liGames]);

  const cursors: {
    chesscom?: ChessComCursor | null;
    lichessUntil?: number | null;
  } = {};
  if (fetchCc) cursors.chesscom = nextChesscom;
  if (fetchLi) cursors.lichessUntil = nextLichessUntil;

  const hasMore =
    (fetchCc ? nextChesscom != null : false) ||
    (fetchLi ? nextLichessUntil != null : false);

  return jsonResponse({
    games: collected,
    cursors,
    hasMore,
    ...(Object.keys(errors).length > 0 ? { errors } : {}),
  });
};
