"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, type ReactNode } from "react";

import { PlayerGamesContext } from "@/lib/cache/PlayerGamesContext";
import { useCachedGames } from "@/lib/cache/useCachedGames";
import { deriveFilterOptions } from "@/lib/filters/game-filters";

export default function PlayerGamesProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const searchParams = useSearchParams();
  const chesscom = searchParams.get("chesscom")?.trim() ?? "";
  const lichess = searchParams.get("lichess")?.trim() ?? "";

  const result = useCachedGames(chesscom, lichess);

  // Merge and sort once here so both tabs share the same reference.
  const allGames = useMemo(
    () =>
      [...result.ccState.games, ...result.liState.games].sort(
        (a, b) => new Date(b.endAt).getTime() - new Date(a.endAt).getTime()
      ),
    [result.ccState.games, result.liState.games]
  );

  // Pre-compute filter options once per data load. This is the expensive call
  // (runs terminationBucketForGame × N via chess.js) — doing it here means
  // switching tabs never re-triggers it.
  const filterOptions = useMemo(() => deriveFilterOptions(allGames), [allGames]);

  return (
    <PlayerGamesContext.Provider
      value={{ ...result, chesscom, lichess, allGames, filterOptions }}
    >
      {children}
    </PlayerGamesContext.Provider>
  );
}
