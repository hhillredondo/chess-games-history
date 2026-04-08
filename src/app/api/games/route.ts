import { type NextRequest, NextResponse } from "next/server";

import { fetchChessComGamesPage, type ChessComCursor } from "@/lib/fetch/chesscom";
import { fetchLichessGamesPage } from "@/lib/fetch/lichess";
import type { UnifiedGame } from "@/lib/types/unified-game";

// force-static lets this file exist in an output:'export' build without erroring.
// In development (npm run dev), Next.js still forwards the real request to the
// handler so search params work normally. In production the Lambda handles
// /api/* via CloudFront — the exported placeholder file is never served.
export const dynamic = "force-static";

function mergeByEndAtDesc(games: UnifiedGame[]): UnifiedGame[] {
  return [...games].sort(
    (a, b) => new Date(b.endAt).getTime() - new Date(a.endAt).getTime()
  );
}

export async function GET(request: NextRequest) {
  // Build-time pre-render during static export — return a placeholder that is
  // never served (Lambda handles /api/* in production via CloudFront).
  if (process.env.NEXT_EXPORT === "1") {
    return NextResponse.json({ games: [], cursors: {}, hasMore: false });
  }

  const sp = request.nextUrl.searchParams;

  const chesscom = (sp.get("chesscom") ?? "").trim();
  const lichess = (sp.get("lichess") ?? "").trim();
  const rawPer = Number(sp.get("perPlatform") ?? "");
  const perPlatform = Math.min(100, Number.isFinite(rawPer) && rawPer >= 1 ? Math.floor(rawPer) : 100);
  const noChesscom = sp.get("noChesscom") === "1";
  const noLichess = sp.get("noLichess") === "1";

  if (!chesscom && !lichess) {
    return NextResponse.json(
      { error: "Provide query params chesscom and/or lichess (username)." },
      { status: 400 }
    );
  }

  const fetchCc = Boolean(chesscom) && !noChesscom;
  const fetchLi = Boolean(lichess) && !noLichess;

  if (!fetchCc && !fetchLi) {
    return NextResponse.json(
      { error: "Nothing to fetch (check noChesscom / noLichess vs usernames)." },
      { status: 400 }
    );
  }

  // Parse Chess.com cursor
  let chesscomCursor: ChessComCursor | null = null;
  const ccMonth = sp.get("ccMonth");
  const ccSkip = sp.get("ccSkip");
  if (ccMonth != null || ccSkip != null) {
    chesscomCursor = {
      monthIdx: Math.max(0, Math.floor(Number(ccMonth ?? "0"))),
      gameSkip: Math.max(0, Math.floor(Number(ccSkip ?? "0"))),
    };
  }

  // Parse Lichess cursor
  let lichessUntil: number | undefined;
  const rawUntil = sp.get("lichessUntil");
  if (rawUntil != null && rawUntil !== "") {
    lichessUntil = Number(rawUntil);
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
            errors.chesscom = e instanceof Error ? e.message : "Chess.com fetch failed";
          })
      : Promise.resolve(),
    fetchLi
      ? fetchLichessGamesPage(lichess, perPlatform, lichessUntil)
          .then(({ games, nextUntil }) => {
            liGames = games;
            nextLichessUntil = nextUntil;
          })
          .catch((e: unknown) => {
            errors.lichess = e instanceof Error ? e.message : "Lichess fetch failed";
          })
      : Promise.resolve(),
  ]);

  const cursors: {
    chesscom?: ChessComCursor | null;
    lichessUntil?: number | null;
  } = {};
  if (fetchCc) cursors.chesscom = nextChesscom;
  if (fetchLi) cursors.lichessUntil = nextLichessUntil;

  const hasMore =
    (fetchCc ? nextChesscom != null : false) ||
    (fetchLi ? nextLichessUntil != null : false);

  return NextResponse.json({
    games: mergeByEndAtDesc([...ccGames, ...liGames]),
    cursors,
    hasMore,
    ...(Object.keys(errors).length > 0 ? { errors } : {}),
  });
}
