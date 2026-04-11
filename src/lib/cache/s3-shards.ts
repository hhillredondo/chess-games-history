import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";

import type { GameSource, UnifiedGame } from "@/lib/types/unified-game";

import { manifestKey, shardKey, userPrefix } from "./keys";
import { groupByMonth, mergeShard } from "./merge";
import type { CacheManifest } from "./types";

const REGION = process.env.AWS_REGION ?? "us-east-1";
const BUCKET = process.env.CACHE_BUCKET;

let _client: S3Client | null = null;
function s3(): S3Client {
  if (!_client) _client = new S3Client({ region: REGION });
  return _client;
}

function requireBucket(): string {
  if (!BUCKET) throw new Error("CACHE_BUCKET env var not set");
  return BUCKET;
}

async function streamToString(body: unknown): Promise<string> {
  // Body is a Node Readable in Lambda — collect chunks.
  const chunks: Buffer[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for await (const chunk of body as AsyncIterable<any>) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
}

async function getJson<T>(key: string): Promise<T | null> {
  try {
    const res = await s3().send(
      new GetObjectCommand({ Bucket: requireBucket(), Key: key })
    );
    if (!res.Body) return null;
    const text = await streamToString(res.Body);
    return JSON.parse(text) as T;
  } catch (e: unknown) {
    const code = (e as { name?: string; Code?: string })?.name
      ?? (e as { Code?: string })?.Code;
    if (code === "NoSuchKey" || code === "NotFound") return null;
    throw e;
  }
}

async function putJson(key: string, body: unknown): Promise<void> {
  await s3().send(
    new PutObjectCommand({
      Bucket: requireBucket(),
      Key: key,
      Body: JSON.stringify(body),
      ContentType: "application/json",
    })
  );
}

export async function readManifest(
  platform: GameSource,
  username: string
): Promise<CacheManifest | null> {
  return getJson<CacheManifest>(manifestKey(platform, username));
}

export async function readShard(
  platform: GameSource,
  username: string,
  yearMonth: string
): Promise<UnifiedGame[]> {
  const games = await getJson<UnifiedGame[]>(shardKey(platform, username, yearMonth));
  return games ?? [];
}

/** Read every shard listed in the manifest, sorted newest-first. */
export async function readAllGames(
  platform: GameSource,
  username: string
): Promise<UnifiedGame[]> {
  const manifest = await readManifest(platform, username);
  if (!manifest || manifest.shards.length === 0) return [];

  const shardArrays = await Promise.all(
    manifest.shards.map((m) => readShard(platform, username, m))
  );
  const all: UnifiedGame[] = [];
  for (const arr of shardArrays) all.push(...arr);
  all.sort((a, b) => new Date(b.endAt).getTime() - new Date(a.endAt).getTime());
  return all;
}

/**
 * Merge a fresh batch of games into the on-disk shards. Returns the new
 * manifest so the caller can update Dynamo metadata.
 */
export async function writeShardsForBatch(
  platform: GameSource,
  username: string,
  batch: UnifiedGame[]
): Promise<CacheManifest> {
  const existing = (await readManifest(platform, username)) ?? {
    platform,
    username,
    shards: [],
    shardCounts: [],
    totalGames: 0,
    updatedAt: new Date().toISOString(),
  };

  const grouped = groupByMonth(batch);
  const touched = [...grouped.keys()];

  // Read every touched shard, merge, write back.
  await Promise.all(
    touched.map(async (m) => {
      const prior = await readShard(platform, username, m);
      const merged = mergeShard(prior, grouped.get(m) ?? []);
      await putJson(shardKey(platform, username, m), merged);
    })
  );

  // Recompute manifest by listing shards under the user prefix. Cheap and
  // avoids drift from the in-memory copy.
  const allShards = new Set<string>(existing.shards);
  for (const m of touched) allShards.add(m);
  const sortedShards = [...allShards].sort();

  const shardCounts = await Promise.all(
    sortedShards.map(async (m) => (await readShard(platform, username, m)).length)
  );
  const totalGames = shardCounts.reduce((a, b) => a + b, 0);

  const manifest: CacheManifest = {
    platform,
    username,
    shards: sortedShards,
    shardCounts,
    totalGames,
    updatedAt: new Date().toISOString(),
  };
  await putJson(manifestKey(platform, username), manifest);
  return manifest;
}

/** Delete every object under the user prefix. Used by cleanup + rebuild. */
export async function deleteAllShards(
  platform: GameSource,
  username: string
): Promise<number> {
  const prefix = userPrefix(platform, username);
  let deleted = 0;
  let token: string | undefined;
  do {
    const list = await s3().send(
      new ListObjectsV2Command({
        Bucket: requireBucket(),
        Prefix: prefix,
        ContinuationToken: token,
      })
    );
    const keys = (list.Contents ?? [])
      .map((o) => o.Key)
      .filter((k): k is string => Boolean(k));
    if (keys.length > 0) {
      await s3().send(
        new DeleteObjectsCommand({
          Bucket: requireBucket(),
          Delete: { Objects: keys.map((Key) => ({ Key })) },
        })
      );
      deleted += keys.length;
    }
    token = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (token);
  return deleted;
}
