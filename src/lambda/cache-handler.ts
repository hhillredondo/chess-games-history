import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";

import {
  emptyMeta,
  getMeta,
  putMeta,
  touchAccess,
  withStatus,
} from "../lib/cache/dynamo";
import { deleteAllShards, readManifest, readShard } from "../lib/cache/s3-shards";
import type { CacheManifest, CacheMeta } from "../lib/cache/types";
import type { GameSource } from "../lib/types/unified-game";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

const REGION = process.env.AWS_REGION ?? "us-east-1";
const WORKER_NAME = process.env.WORKER_FUNCTION_NAME;

let _lambda: LambdaClient | null = null;
function lambda(): LambdaClient {
  if (!_lambda) _lambda = new LambdaClient({ region: REGION });
  return _lambda;
}

function jsonResponse(body: unknown, status = 200): APIGatewayProxyResultV2 {
  return {
    statusCode: status,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

async function startWorker(
  platform: GameSource,
  username: string,
  resetCursor: boolean,
  since?: string
): Promise<void> {
  if (!WORKER_NAME) {
    throw new Error("WORKER_FUNCTION_NAME env var not set");
  }
  await lambda().send(
    new InvokeCommand({
      FunctionName: WORKER_NAME,
      InvocationType: "Event",
      Payload: Buffer.from(JSON.stringify({ platform, username, resetCursor, since })),
    })
  );
}

interface PlatformResult {
  meta: CacheMeta | null;
  manifest: CacheManifest | null;
  startedJob: boolean;
}

async function handlePlatform(
  platform: GameSource,
  username: string | null,
  action: "read" | "refresh" | "rebuild"
): Promise<PlatformResult> {
  if (!username) return { meta: null, manifest: null, startedJob: false };

  let meta = await getMeta(platform, username);

  if (action === "rebuild") {
    await deleteAllShards(platform, username);
    meta = emptyMeta(platform, username);
    await putMeta(withStatus(meta, "ingesting"));
    await startWorker(platform, username, true);
    return { meta, manifest: null, startedJob: true };
  }

  if (!meta) {
    const fresh = emptyMeta(platform, username);
    await putMeta(withStatus(fresh, "ingesting"));
    await startWorker(platform, username, false);
    return { meta: fresh, manifest: null, startedJob: true };
  }

  await touchAccess(platform, username);

  if (action === "refresh" && meta.status !== "ingesting") {
    await putMeta(withStatus(meta, "ingesting"));
    await startWorker(platform, username, false, meta.lastFetchedAt);
    const manifest = await readManifest(platform, username);
    return { meta, manifest, startedJob: true };
  }

  if (meta.status === "error") {
    // Auto-recover: clear the error and restart the worker so the user
    // doesn't get stuck in a permanent error state after a transient failure.
    await putMeta(withStatus(meta, "ingesting", { error: undefined }));
    await startWorker(platform, username, false);
    return { meta: { ...meta, status: "ingesting", error: undefined }, manifest: null, startedJob: true };
  }

  const manifest = await readManifest(platform, username);
  return { meta, manifest, startedJob: false };
}

function metaPayload(meta: CacheMeta | null) {
  if (!meta) return null;
  return {
    status: meta.status,
    gamesLoaded: meta.gamesLoaded,
    lastFetchedAt: meta.lastFetchedAt,
    error: meta.error,
  };
}

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  if (event.requestContext.http.method === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  const p = event.queryStringParameters ?? {};

  // ── Shard fetch path ────────────────────────────────────────────────────
  // GET /api/cache?shard=1&platform=chesscom&username=X&month=2025-03
  // Returns the contents of one monthly shard. Used by the client to page
  // around Lambda's 6 MB sync response limit.
  if (p.shard === "1") {
    const platform = p.platform as GameSource | undefined;
    const username = (p.username ?? "").trim();
    const month = (p.month ?? "").trim();
    if (!platform || !username || !month) {
      return jsonResponse(
        { error: "shard=1 requires platform, username, month." },
        400
      );
    }
    if (platform !== "chesscom" && platform !== "lichess") {
      return jsonResponse({ error: "Invalid platform." }, 400);
    }
    try {
      const games = await readShard(platform, username, month);
      return jsonResponse({ games });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Shard read failed";
      return jsonResponse({ error: message }, 500);
    }
  }

  // ── Manifest path ───────────────────────────────────────────────────────
  // GET /api/cache?chesscom=X&lichess=Y[&action=read|refresh|rebuild]
  // Returns per-platform status + manifest (list of months + counts). Never
  // returns games inline.
  const chesscom = (p.chesscom ?? "").trim() || null;
  const lichess = (p.lichess ?? "").trim() || null;

  if (!chesscom && !lichess) {
    return jsonResponse(
      { error: "Provide query params chesscom and/or lichess (username)." },
      400
    );
  }

  const action = (p.action ?? "read") as "read" | "refresh" | "rebuild";
  if (!["read", "refresh", "rebuild"].includes(action)) {
    return jsonResponse({ error: "Invalid action." }, 400);
  }

  try {
    const [cc, li] = await Promise.all([
      handlePlatform("chesscom", chesscom, action),
      handlePlatform("lichess", lichess, action),
    ]);

    return jsonResponse({
      status: {
        chesscom: metaPayload(cc.meta),
        lichess: metaPayload(li.meta),
      },
      manifest: {
        chesscom: cc.manifest,
        lichess: li.manifest,
      },
      startedJob: cc.startedJob || li.startedJob,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Cache handler failed";
    return jsonResponse({ error: message }, 500);
  }
};
