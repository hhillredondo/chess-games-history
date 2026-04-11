import type { UnifiedGame } from "@/lib/types/unified-game";

import { monthBucketOf } from "./keys";

/** Group a flat array of games by their `endAt` year-month. */
export function groupByMonth(games: UnifiedGame[]): Map<string, UnifiedGame[]> {
  const out = new Map<string, UnifiedGame[]>();
  for (const g of games) {
    const m = monthBucketOf(g.endAt);
    const list = out.get(m);
    if (list) list.push(g);
    else out.set(m, [g]);
  }
  return out;
}

/**
 * Merge `incoming` into `existing` by id, then sort newest-first by `endAt`.
 * Incoming games take precedence on conflict so re-fetched games can correct
 * earlier data.
 */
export function mergeShard(
  existing: UnifiedGame[],
  incoming: UnifiedGame[]
): UnifiedGame[] {
  const byId = new Map<string, UnifiedGame>();
  for (const g of existing) byId.set(g.id, g);
  for (const g of incoming) byId.set(g.id, g);
  return [...byId.values()].sort(
    (a, b) => new Date(b.endAt).getTime() - new Date(a.endAt).getTime()
  );
}
