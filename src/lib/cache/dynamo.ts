import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  DeleteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

import type { GameSource } from "@/lib/types/unified-game";

import { metaPk, normalizeUsername } from "./keys";
import type { CacheMeta, CacheStatus, PlatformCursor } from "./types";

const REGION = process.env.AWS_REGION ?? "us-east-1";
const TABLE = process.env.CACHE_TABLE;

let _doc: DynamoDBDocumentClient | null = null;
function doc(): DynamoDBDocumentClient {
  if (!_doc) {
    _doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return _doc;
}

function requireTable(): string {
  if (!TABLE) throw new Error("CACHE_TABLE env var not set");
  return TABLE;
}

export async function getMeta(
  platform: GameSource,
  username: string
): Promise<CacheMeta | null> {
  const res = await doc().send(
    new GetCommand({
      TableName: requireTable(),
      Key: { pk: metaPk(platform, username) },
    })
  );
  return (res.Item as CacheMeta | undefined) ?? null;
}

export async function putMeta(meta: CacheMeta): Promise<void> {
  await doc().send(
    new PutCommand({ TableName: requireTable(), Item: meta })
  );
}

export async function deleteMeta(
  platform: GameSource,
  username: string
): Promise<void> {
  await doc().send(
    new DeleteCommand({
      TableName: requireTable(),
      Key: { pk: metaPk(platform, username) },
    })
  );
}

/** Bump `lastAccessed` to now without rewriting the rest of the record. */
export async function touchAccess(
  platform: GameSource,
  username: string
): Promise<void> {
  try {
    await doc().send(
      new UpdateCommand({
        TableName: requireTable(),
        Key: { pk: metaPk(platform, username) },
        UpdateExpression: "SET lastAccessed = :now",
        ExpressionAttributeValues: { ":now": new Date().toISOString() },
        ConditionExpression: "attribute_exists(pk)",
      })
    );
  } catch {
    // No-op if the row doesn't exist yet — putMeta will set it on first write.
  }
}

export async function scanAllMeta(): Promise<CacheMeta[]> {
  const out: CacheMeta[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const res = await doc().send(
      new ScanCommand({
        TableName: requireTable(),
        ExclusiveStartKey: lastKey,
      })
    );
    if (res.Items) out.push(...(res.Items as CacheMeta[]));
    lastKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);
  return out;
}

/** Construct an empty meta record for a fresh user. */
export function emptyMeta(
  platform: GameSource,
  username: string
): CacheMeta {
  const now = new Date().toISOString();
  return {
    pk: metaPk(platform, username),
    platform,
    username: normalizeUsername(username),
    status: "empty",
    lastAccessed: now,
    shardCount: 0,
    gamesLoaded: 0,
    cursor: null,
    workerSeconds: 0,
  };
}

export function withStatus(
  meta: CacheMeta,
  status: CacheStatus,
  patch: Partial<CacheMeta> = {}
): CacheMeta {
  return { ...meta, status, ...patch };
}

export function withCursor(
  meta: CacheMeta,
  cursor: PlatformCursor | null
): CacheMeta {
  return { ...meta, cursor };
}
