import {
  TERMINATION_BUCKETS,
  terminationBucketForGame,
  terminationLabel,
  type TerminationBucket,
} from "@/lib/filters/game-filters";
import type { UnifiedGame } from "@/lib/types/unified-game";

export interface TerminationRow {
  bucket: TerminationBucket;
  label: string;
  wins: number;
  losses: number;
  draws: number;
  total: number;
}

export function computeTerminationStats(games: UnifiedGame[]): TerminationRow[] {
  const map = new Map<
    TerminationBucket,
    { wins: number; losses: number; draws: number }
  >();

  for (const g of games) {
    const bucket = terminationBucketForGame(g);
    const prev = map.get(bucket) ?? { wins: 0, losses: 0, draws: 0 };
    if (g.result === "win") prev.wins++;
    else if (g.result === "loss") prev.losses++;
    else if (g.result === "draw") prev.draws++;
    map.set(bucket, prev);
  }

  return TERMINATION_BUCKETS.filter((b) => map.has(b))
    .map((b) => {
      const { wins, losses, draws } = map.get(b)!;
      return {
        bucket: b,
        label: terminationLabel(b),
        wins,
        losses,
        draws,
        total: wins + losses + draws,
      };
    })
    .sort((a, b) => b.total - a.total);
}
