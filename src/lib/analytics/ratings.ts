import type { GameSource, UnifiedGame } from "@/lib/types/unified-game";

export interface RatingPoint {
  date: string;
  rating: number;
  source: GameSource;
}

export function extractRatingHistory(games: UnifiedGame[]): RatingPoint[] {
  return games
    .flatMap((g): RatingPoint[] => {
      const rating = g.userColor === "white" ? g.whiteRating : g.blackRating;
      if (rating == null) return [];
      return [{ date: g.endAt, rating, source: g.source }];
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}
