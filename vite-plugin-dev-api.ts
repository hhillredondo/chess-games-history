import type { IncomingMessage, ServerResponse } from "node:http";

import type { Plugin, ViteDevServer } from "vite";

/**
 * Vite middleware that serves /api/games and /api/coach during local dev,
 * mirroring the Lambda handlers that run in production behind CloudFront. The
 * actual fetch / Anthropic logic lives in src/lib/* and is loaded through
 * Vite's SSR module loader so the `@/` path alias resolves correctly.
 */
export function devApiPlugin(): Plugin {
  return {
    name: "dev-api",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? "";

        try {
          if (url.startsWith("/api/games") && req.method === "GET") {
            await handleGames(req, res, server);
          } else if (url.startsWith("/api/coach") && req.method === "POST") {
            await handleCoach(req, res, server);
          } else {
            next();
          }
        } catch (e) {
          if (!res.headersSent) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                error: e instanceof Error ? e.message : "Internal error",
              })
            );
          } else {
            res.end();
          }
        }
      });
    },
  };
}

async function handleGames(
  req: IncomingMessage,
  res: ServerResponse,
  server: ViteDevServer
): Promise<void> {
  const u = new URL(req.url ?? "/", "http://localhost");
  const sp = u.searchParams;

  const chesscom = (sp.get("chesscom") ?? "").trim();
  const lichess = (sp.get("lichess") ?? "").trim();
  const rawPer = Number(sp.get("perPlatform") ?? "");
  const perPlatform = Math.min(
    100,
    Number.isFinite(rawPer) && rawPer >= 1 ? Math.floor(rawPer) : 100
  );
  const noChesscom = sp.get("noChesscom") === "1";
  const noLichess = sp.get("noLichess") === "1";

  if (!chesscom && !lichess) {
    return jsonResponse(res, 400, {
      error: "Provide query params chesscom and/or lichess (username).",
    });
  }

  const fetchCc = Boolean(chesscom) && !noChesscom;
  const fetchLi = Boolean(lichess) && !noLichess;

  if (!fetchCc && !fetchLi) {
    return jsonResponse(res, 400, {
      error: "Nothing to fetch (check noChesscom / noLichess vs usernames).",
    });
  }

  type ChessComCursor = { monthIdx: number; gameSkip: number };

  let chesscomCursor: ChessComCursor | null = null;
  const ccMonth = sp.get("ccMonth");
  const ccSkip = sp.get("ccSkip");
  if (ccMonth != null || ccSkip != null) {
    chesscomCursor = {
      monthIdx: Math.max(0, Math.floor(Number(ccMonth ?? "0"))),
      gameSkip: Math.max(0, Math.floor(Number(ccSkip ?? "0"))),
    };
  }

  let lichessUntil: number | undefined;
  const rawUntil = sp.get("lichessUntil");
  if (rawUntil != null && rawUntil !== "") lichessUntil = Number(rawUntil);

  const ccMod = await server.ssrLoadModule("/src/lib/fetch/chesscom.ts");
  const liMod = await server.ssrLoadModule("/src/lib/fetch/lichess.ts");
  const { fetchChessComGamesPage } = ccMod;
  const { fetchLichessGamesPage } = liMod;

  const errors: { chesscom?: string; lichess?: string } = {};
  let ccGames: unknown[] = [];
  let nextChesscom: ChessComCursor | null = null;
  let liGames: unknown[] = [];
  let nextLichessUntil: number | null = null;

  await Promise.all([
    fetchCc
      ? fetchChessComGamesPage(chesscom, perPlatform, chesscomCursor)
          .then(
            (out: { games: unknown[]; nextCursor: ChessComCursor | null }) => {
              ccGames = out.games;
              nextChesscom = out.nextCursor;
            }
          )
          .catch((e: unknown) => {
            errors.chesscom =
              e instanceof Error ? e.message : "Chess.com fetch failed";
          })
      : Promise.resolve(),
    fetchLi
      ? fetchLichessGamesPage(lichess, perPlatform, lichessUntil)
          .then(
            (out: { games: unknown[]; nextUntil: number | null }) => {
              liGames = out.games;
              nextLichessUntil = out.nextUntil;
            }
          )
          .catch((e: unknown) => {
            errors.lichess =
              e instanceof Error ? e.message : "Lichess fetch failed";
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

  const merged = [...ccGames, ...liGames].sort((a, b) => {
    const ax = (a as { endAt: string }).endAt;
    const bx = (b as { endAt: string }).endAt;
    return new Date(bx).getTime() - new Date(ax).getTime();
  });

  return jsonResponse(res, 200, {
    games: merged,
    cursors,
    hasMore,
    ...(Object.keys(errors).length > 0 ? { errors } : {}),
  });
}

async function handleCoach(
  req: IncomingMessage,
  res: ServerResponse,
  server: ViteDevServer
): Promise<void> {
  let raw: unknown;
  try {
    const body = await readBody(req);
    raw = JSON.parse(body);
  } catch {
    return jsonResponse(res, 400, { error: "Request body is not valid JSON." });
  }

  const reqMod = await server.ssrLoadModule("/src/lib/coach/request.ts");
  const { buildCoachRequest, parseCoachBody, sseEvent } = reqMod as {
    buildCoachRequest: (
      ctx: string,
      msgs: { role: "user" | "assistant"; content: string }[]
    ) => unknown;
    parseCoachBody: (raw: unknown) => {
      context: string;
      messages: { role: "user" | "assistant"; content: string }[];
    };
    sseEvent: (event: string, data: unknown) => string;
  };

  let context: string;
  let messages: { role: "user" | "assistant"; content: string }[];
  try {
    ({ context, messages } = parseCoachBody(raw));
  } catch (e) {
    return jsonResponse(res, 400, {
      error: e instanceof Error ? e.message : "Invalid request",
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return jsonResponse(res, 500, {
      error: "ANTHROPIC_API_KEY env var is not set in the dev environment.",
    });
  }

  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey });

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
  });

  try {
    const stream = client.messages.stream(
      buildCoachRequest(context, messages) as Parameters<
        typeof client.messages.stream
      >[0]
    );
    for await (const chunk of stream) {
      if (
        chunk.type === "content_block_delta" &&
        chunk.delta.type === "text_delta" &&
        chunk.delta.text
      ) {
        res.write(sseEvent("delta", { text: chunk.delta.text }));
      }
    }
    res.write(sseEvent("done", {}));
  } catch (e) {
    res.write(
      sseEvent("error", {
        message: e instanceof Error ? e.message : "Coach API failed",
      })
    );
  } finally {
    res.end();
  }
}

function jsonResponse(
  res: ServerResponse,
  status: number,
  body: unknown
): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}
