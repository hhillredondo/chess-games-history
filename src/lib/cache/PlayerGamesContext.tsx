import { createContext, useContext } from "react";

import type { DerivedFilterOptions } from "@/lib/filters/game-filters";
import type { UnifiedGame } from "@/lib/types/unified-game";

import type { UseCachedGamesResult } from "./useCachedGames";

export interface PlayerGamesContextValue extends UseCachedGamesResult {
  /** Trimmed Chess.com username from the URL (empty string if not provided). */
  chesscom: string;
  /** Trimmed Lichess username from the URL (empty string if not provided). */
  lichess: string;
  /**
   * All games merged and sorted newest-first. Pre-computed once in the layout
   * so switching between Analytics and Games tabs never re-merges the array.
   */
  allGames: UnifiedGame[];
  /**
   * Filter options derived from the full unfiltered game set. Pre-computed once
   * in the layout — avoids re-running `terminationBucketForGame` × N on every
   * tab switch.
   */
  filterOptions: DerivedFilterOptions;
}

export const PlayerGamesContext =
  createContext<PlayerGamesContextValue | null>(null);

/** Consume shared game-load state. Must be used inside PlayerGamesProvider. */
export function usePlayerGames(): PlayerGamesContextValue {
  const ctx = useContext(PlayerGamesContext);
  if (!ctx) {
    throw new Error("usePlayerGames must be called inside <PlayerGamesProvider>");
  }
  return ctx;
}
