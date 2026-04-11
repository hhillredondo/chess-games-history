import type { UnifiedGame } from "@/lib/types/unified-game";

export type TimeOfDayBucket = "morning" | "afternoon" | "evening" | "night";

/** Ordered for display: morning → afternoon → evening → night */
export const TIME_OF_DAY_BUCKETS: {
  id: TimeOfDayBucket;
  label: string;
  range: string;
}[] = [
  { id: "morning", label: "Morning", range: "6 – 12" },
  { id: "afternoon", label: "Afternoon", range: "12 – 18" },
  { id: "evening", label: "Evening", range: "18 – 24" },
  { id: "night", label: "Night", range: "0 – 6" },
];

function getBucket(localHour: number): TimeOfDayBucket {
  if (localHour >= 6 && localHour < 12) return "morning";
  if (localHour >= 12 && localHour < 18) return "afternoon";
  if (localHour >= 18) return "evening";
  return "night";
}

export interface TimeOfDayRow {
  id: TimeOfDayBucket;
  label: string;
  range: string;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  /** (wins + 0.5 * draws) / decided. Null if no decided games. */
  winRate: number | null;
}

export function computeTimeOfDayStats(games: UnifiedGame[]): TimeOfDayRow[] {
  const counts = new Map<
    TimeOfDayBucket,
    { games: number; wins: number; losses: number; draws: number }
  >(
    TIME_OF_DAY_BUCKETS.map(({ id }) => [
      id,
      { games: 0, wins: 0, losses: 0, draws: 0 },
    ])
  );

  for (const g of games) {
    const hour = new Date(g.endAt).getHours(); // local browser time
    const bucket = getBucket(hour);
    const c = counts.get(bucket)!;
    c.games++;
    if (g.result === "win") c.wins++;
    else if (g.result === "loss") c.losses++;
    else if (g.result === "draw") c.draws++;
  }

  return TIME_OF_DAY_BUCKETS.map(({ id, label, range }) => {
    const c = counts.get(id)!;
    const decided = c.wins + c.losses + c.draws;
    return {
      id,
      label,
      range,
      ...c,
      winRate: decided === 0 ? null : (c.wins + 0.5 * c.draws) / decided,
    };
  });
}
