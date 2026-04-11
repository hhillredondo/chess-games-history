import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

import { fetchChessComGamesPage, type ChessComCursor } from "../lib/fetch/chesscom";
import { fetchLichessGamesPage } from "../lib/fetch/lichess";
import {
  emptyMeta,
  getMeta,
  putMeta,
  withCursor,
  withStatus,
} from "../lib/cache/dynamo";
import { writeShardsForBatch } from "../lib/cache/s3-shards";
import type { CacheMeta, PlatformCursor } from "../lib/cache/types";
import type { GameSource } from "../lib/types/unified-game";

export interface IngestEvent {
  platform: GameSource;
  username: string;
  /** Optional override; normally the worker reads its cursor from Dynamo. */
  resetCursor?: boolean;
  /**
   * For refresh: ISO timestamp of the last successful full ingest.
   * Fetchers skip content older than this so only new games are processed.
   */
  since?: string;
}

const REGION = process.env.AWS_REGION ?? "us-east-1";
const SELF_NAME = process.env.WORKER_FUNCTION_NAME;
const MAX_GAMES_PER_USER = Number(process.env.MAX_GAMES_PER_USER ?? "50000");
const PER_BATCH = 100;
/** Self-invoke if fewer than this many ms remain on the Lambda budget. */
const SAFETY_MARGIN_MS = 60_000;

let _lambda: LambdaClient | null = null;
function lambda(): LambdaClient {
  if (!_lambda) _lambda = new LambdaClient({ region: REGION });
  return _lambda;
}

async function selfInvoke(event: IngestEvent): Promise<void> {
  if (!SELF_NAME) {
    throw new Error("WORKER_FUNCTION_NAME not set; cannot self-invoke");
  }
  await lambda().send(
    new InvokeCommand({
      FunctionName: SELF_NAME,
      InvocationType: "Event",
      Payload: Buffer.from(JSON.stringify(event)),
    })
  );
}

function chesscomCursorOf(meta: CacheMeta): ChessComCursor | null {
  if (meta.cursor?.kind === "chesscom") return meta.cursor.cursor;
  return null;
}

function lichessUntilOf(meta: CacheMeta): number | undefined {
  if (meta.cursor?.kind === "lichess") return meta.cursor.until ?? undefined;
  return undefined;
}

async function loadOrInit(
  platform: GameSource,
  username: string,
  resetCursor: boolean
): Promise<CacheMeta> {
  const existing = await getMeta(platform, username);
  if (existing && !resetCursor) return existing;
  const fresh = emptyMeta(platform, username);
  if (existing) {
    fresh.lastAccessed = existing.lastAccessed;
    fresh.workerSeconds = existing.workerSeconds ?? 0;
  }
  return fresh;
}

interface ContextLike {
  getRemainingTimeInMillis(): number;
}

export const handler = async (
  event: IngestEvent,
  context: ContextLike
): Promise<{ status: string; gamesLoaded: number }> => {
  const { platform, username } = event;
  if (!platform || !username) {
    throw new Error("ingest-worker: platform and username are required");
  }

  let meta = await loadOrInit(platform, username, Boolean(event.resetCursor));
  meta = withStatus(meta, "ingesting", { error: undefined });
  await putMeta(meta);

  const startedMs = Date.now();

  try {
    while (true) {
      if (meta.gamesLoaded >= MAX_GAMES_PER_USER) {
        meta = withStatus(meta, "ready", {
          lastFetchedAt: new Date().toISOString(),
        });
        await putMeta(meta);
        break;
      }

      // Fetch one batch using whatever cursor is in Dynamo.
      let nextCursor: PlatformCursor | null = null;
      let batchLen = 0;

      if (platform === "chesscom") {
        const { games, nextCursor: nc } = await fetchChessComGamesPage(
          username,
          PER_BATCH,
          chesscomCursorOf(meta),
          event.since
        );
        batchLen = games.length;
        nextCursor = { kind: "chesscom", cursor: nc };
        if (games.length > 0) {
          const manifest = await writeShardsForBatch(platform, username, games);
          meta = {
            ...meta,
            shardCount: manifest.shards.length,
            gamesLoaded: manifest.totalGames,
          };
        }
        if (nc == null) {
          meta = withStatus(withCursor(meta, null), "ready", {
            lastFetchedAt: new Date().toISOString(),
          });
          await putMeta(meta);
          break;
        }
      } else {
        const sinceMs = event.since ? new Date(event.since).getTime() : undefined;
        const { games, nextUntil } = await fetchLichessGamesPage(
          username,
          PER_BATCH,
          lichessUntilOf(meta),
          sinceMs
        );
        batchLen = games.length;
        nextCursor = { kind: "lichess", until: nextUntil };
        if (games.length > 0) {
          const manifest = await writeShardsForBatch(platform, username, games);
          meta = {
            ...meta,
            shardCount: manifest.shards.length,
            gamesLoaded: manifest.totalGames,
          };
        }
        if (nextUntil == null) {
          meta = withStatus(withCursor(meta, null), "ready", {
            lastFetchedAt: new Date().toISOString(),
          });
          await putMeta(meta);
          break;
        }
      }

      // Persist progress every batch.
      meta = withCursor(meta, nextCursor);
      await putMeta(meta);

      // Empty batch with a non-null cursor is a sign of nothing-mappable in a
      // month — keep going, but break the loop after a few empty batches to
      // avoid infinite spin if a remote API is misbehaving.
      if (batchLen === 0) {
        // The platform fetchers advance the cursor on empty months, so this is
        // safe; just keep looping.
      }

      // Time check: if we're getting close to the Lambda timeout, hand off to
      // a fresh invocation. Cursor is already in Dynamo so we resume cleanly.
      if (context.getRemainingTimeInMillis() < SAFETY_MARGIN_MS) {
        meta = {
          ...meta,
          workerSeconds:
            (meta.workerSeconds ?? 0) + Math.round((Date.now() - startedMs) / 1000),
        };
        await putMeta(meta);
        await selfInvoke({ platform, username, since: event.since });
        return { status: "handoff", gamesLoaded: meta.gamesLoaded };
      }
    }

    return { status: "ready", gamesLoaded: meta.gamesLoaded };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    meta = withStatus(meta, "error", { error: message });
    await putMeta(meta);
    return { status: "error", gamesLoaded: meta.gamesLoaded };
  }
};
