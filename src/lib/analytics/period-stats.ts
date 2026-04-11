import type { UnifiedGame } from "@/lib/types/unified-game";

export type PeriodBucket = "year" | "month" | "week" | "day";

export const PERIOD_BUCKET_LABELS: Record<PeriodBucket, string> = {
  year: "By year",
  month: "By month",
  week: "By week",
  day: "By day",
};

export interface PeriodRow {
  /** Sortable string key, e.g. "2024-03" for month. */
  key: string;
  /** Human-readable label, e.g. "Mar 2024". */
  label: string;
  games: number;
  wins: number;
  losses: number;
  draws: number;
}

function getWeekSundayKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // roll back to Sunday
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getKey(date: Date, bucket: PeriodBucket): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  if (bucket === "year") return String(y);
  if (bucket === "month") return `${y}-${m}`;
  if (bucket === "week") return getWeekSundayKey(date);
  return `${y}-${m}-${d}`;
}

function getLabel(key: string, bucket: PeriodBucket): string {
  if (bucket === "year") return key;
  if (bucket === "month") {
    const [y, mo] = key.split("-").map(Number);
    return new Date(y!, mo! - 1, 1).toLocaleDateString(undefined, {
      month: "short",
      year: "numeric",
    });
  }
  if (bucket === "week") {
    const [y, mo, d] = key.split("-").map(Number);
    const start = new Date(y!, mo! - 1, d!);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const startStr = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const endStr = end.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `${startStr}–${endStr}`;
  }
  // day
  const [y, mo, d] = key.split("-").map(Number);
  return new Date(y!, mo! - 1, d!).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function computePeriodStats(
  games: UnifiedGame[],
  bucket: PeriodBucket
): PeriodRow[] {
  const map = new Map<
    string,
    { games: number; wins: number; losses: number; draws: number }
  >();

  for (const g of games) {
    const date = new Date(g.endAt);
    const key = getKey(date, bucket);
    const prev = map.get(key) ?? { games: 0, wins: 0, losses: 0, draws: 0 };
    prev.games++;
    if (g.result === "win") prev.wins++;
    else if (g.result === "loss") prev.losses++;
    else if (g.result === "draw") prev.draws++;
    map.set(key, prev);
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => ({ key, label: getLabel(key, bucket), ...v }));
}
