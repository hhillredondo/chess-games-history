import type { GameSource } from "@/lib/types/unified-game";

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function metaPk(platform: GameSource, username: string): string {
  return `${platform}#${normalizeUsername(username)}`;
}

export function userPrefix(platform: GameSource, username: string): string {
  return `cache/${platform}/${normalizeUsername(username)}/`;
}

export function manifestKey(platform: GameSource, username: string): string {
  return `${userPrefix(platform, username)}manifest.json`;
}

/** `2024-09` → `cache/chesscom/foo/2024-09.json` */
export function shardKey(
  platform: GameSource,
  username: string,
  yearMonth: string
): string {
  return `${userPrefix(platform, username)}${yearMonth}.json`;
}

/** ISO date → `YYYY-MM`. */
export function monthBucketOf(iso: string): string {
  return iso.slice(0, 7);
}
