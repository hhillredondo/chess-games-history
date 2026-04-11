import type { ChessComCursor } from "@/lib/fetch/chesscom";
import type { GameSource } from "@/lib/types/unified-game";

export type CacheStatus = "empty" | "ingesting" | "ready" | "error";

export interface CacheMeta {
  /** Composite primary key, e.g. "chesscom#brainsurgery420". Lowercased. */
  pk: string;
  platform: GameSource;
  username: string;
  status: CacheStatus;
  /** ISO timestamp the cache was last touched by a client read. Drives TTL. */
  lastAccessed: string;
  /** ISO timestamp the most recent successful fetch finished. */
  lastFetchedAt?: string;
  /** Number of monthly shards in S3. */
  shardCount: number;
  /** Total games stored across all shards. */
  gamesLoaded: number;
  /** Resume token for the in-progress fetch (platform-specific shape). */
  cursor?: PlatformCursor | null;
  /** Last error from the worker, if status === "error". */
  error?: string;
  /** Wall-clock seconds the worker has spent on this user, lifetime. */
  workerSeconds?: number;
}

export type PlatformCursor =
  | { kind: "chesscom"; cursor: ChessComCursor | null }
  | { kind: "lichess"; until: number | null };

/** Stored at cache/<platform>/<username>/manifest.json. */
export interface CacheManifest {
  platform: GameSource;
  username: string;
  /** Sorted ascending: ["2024-09", "2024-10", ...]. */
  shards: string[];
  /** Per-shard game counts, parallel to `shards`. */
  shardCounts: number[];
  totalGames: number;
  updatedAt: string;
}
