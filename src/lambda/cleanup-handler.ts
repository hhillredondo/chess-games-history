import { deleteMeta, scanAllMeta } from "../lib/cache/dynamo";
import { deleteAllShards } from "../lib/cache/s3-shards";

const TTL_DAYS = Number(process.env.CACHE_TTL_DAYS ?? "30");
const MAX_TOTAL_GAMES = Number(process.env.MAX_TOTAL_GAMES ?? "5000000");

interface Result {
  evicted: number;
  reasons: { ttl: number; capacity: number };
  totalGamesAfter: number;
}

export const handler = async (): Promise<Result> => {
  const all = await scanAllMeta();
  const cutoffMs = Date.now() - TTL_DAYS * 24 * 60 * 60 * 1000;

  let ttlEvicted = 0;
  let capacityEvicted = 0;

  // Pass 1 — TTL eviction.
  const survivors = [];
  for (const meta of all) {
    const accessedMs = new Date(meta.lastAccessed).getTime();
    if (Number.isFinite(accessedMs) && accessedMs < cutoffMs) {
      await deleteAllShards(meta.platform, meta.username);
      await deleteMeta(meta.platform, meta.username);
      ttlEvicted += 1;
    } else {
      survivors.push(meta);
    }
  }

  // Pass 2 — capacity cap (LRU eviction by lastAccessed ascending).
  let totalGames = survivors.reduce((s, m) => s + (m.gamesLoaded ?? 0), 0);
  if (totalGames > MAX_TOTAL_GAMES) {
    survivors.sort(
      (a, b) =>
        new Date(a.lastAccessed).getTime() - new Date(b.lastAccessed).getTime()
    );
    for (const meta of survivors) {
      if (totalGames <= MAX_TOTAL_GAMES) break;
      await deleteAllShards(meta.platform, meta.username);
      await deleteMeta(meta.platform, meta.username);
      totalGames -= meta.gamesLoaded ?? 0;
      capacityEvicted += 1;
    }
  }

  return {
    evicted: ttlEvicted + capacityEvicted,
    reasons: { ttl: ttlEvicted, capacity: capacityEvicted },
    totalGamesAfter: totalGames,
  };
};
