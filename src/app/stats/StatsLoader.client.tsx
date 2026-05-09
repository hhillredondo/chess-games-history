import {
  useDeferredValue,
  useMemo,
  useState,
  useTransition,
} from "react";
import { Link } from "react-router-dom";

import FetchActions from "@/app/_components/composed/FetchActions/FetchActions.client";
import FilterPanel from "@/app/_components/composed/FilterPanel/FilterPanel.client";
import IngestingLoader from "@/app/_components/composed/IngestingLoader/IngestingLoader.client";
import ViewTabs from "@/app/_components/composed/ViewTabs/ViewTabs.client";
import { usePlayerGames } from "@/lib/cache/PlayerGamesContext";
import {
  EMPTY_FILTERS,
  applyFilters,
  type DerivedFilterOptions,
  type GameFilters,
} from "@/lib/filters/game-filters";
import type { UnifiedGame } from "@/lib/types/unified-game";

import StatsView from "./StatsView.client";

export default function StatsLoader() {
  const {
    chesscom,
    lichess,
    ccState,
    liState,
    allDone,
    allGames,
    filterOptions,
    refresh,
    rebuild,
  } = usePlayerGames();
  const hasCc = Boolean(chesscom);
  const hasLi = Boolean(lichess);

  const [committed, setCommitted] = useState<GameFilters>(EMPTY_FILTERS);
  const [isPending, startTransition] = useTransition();

  // Analytics charts want oldest-first; context provides newest-first.
  const allGamesAsc = useMemo(
    () => [...allGames].sort(
      (a, b) => new Date(a.endAt).getTime() - new Date(b.endAt).getTime()
    ),
    [allGames]
  );

  if (!hasCc && !hasLi) {
    return (
      <div className="p-8 text-center max-w-lg mx-auto">
        <p className="mb-4">No usernames in the URL.</p>
        <Link to="/" className="underline">
          Back to search
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[min(100%,92rem)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <ViewTabs current="analytics" />
      </div>

      {/* Server-side ingest in progress: show polling UI with Dynamo counter */}
      {!allDone && (ccState.serverGamesLoaded !== undefined || liState.serverGamesLoaded !== undefined) && (
        <IngestingLoader
          platforms={[
            ...(hasCc && ccState.serverGamesLoaded !== undefined
              ? [{ label: "Chess.com", username: chesscom, gamesLoaded: ccState.serverGamesLoaded, error: ccState.error }]
              : []),
            ...(hasLi && liState.serverGamesLoaded !== undefined
              ? [{ label: "Lichess", username: lichess, gamesLoaded: liState.serverGamesLoaded, error: liState.error }]
              : []),
          ]}
          onRebuild={rebuild}
        />
      )}

      {/* Client-side shard / direct fetch in progress */}
      {!allDone && ccState.serverGamesLoaded === undefined && liState.serverGamesLoaded === undefined && (
        <div className="flex flex-col gap-3 max-w-sm mb-8">
          <p className="font-mono text-sm">Loading all games for analysis…</p>
          {hasCc && (
            <p className="text-sm">
              Chess.com:{" "}
              {ccState.done
                ? `${ccState.loaded} games`
                : `${ccState.loaded} games…`}
              {ccState.error && (
                <span className="text-red-500 ml-2">{ccState.error}</span>
              )}
            </p>
          )}
          {hasLi && (
            <p className="text-sm">
              Lichess:{" "}
              {liState.done
                ? `${liState.loaded} games`
                : `${liState.loaded} games…`}
              {liState.error && (
                <span className="text-red-500 ml-2">{liState.error}</span>
              )}
            </p>
          )}
        </div>
      )}

      {allDone && (
        <StatsViewWithFilter
          allGames={allGamesAsc}
          filterOptions={filterOptions}
          committed={committed}
          isPending={isPending}
          onApply={(f) => startTransition(() => setCommitted(f))}
          chesscomCount={ccState.games.length}
          lichessCount={liState.games.length}
          errors={{ chesscom: ccState.error, lichess: liState.error }}
          onRefresh={refresh}
          onRebuild={rebuild}
        />
      )}
    </div>
  );
}

function StatsViewWithFilter({
  allGames,
  filterOptions,
  committed,
  isPending,
  onApply,
  chesscomCount,
  lichessCount,
  errors,
  onRefresh,
  onRebuild,
}: Readonly<{
  allGames: UnifiedGame[];
  filterOptions: DerivedFilterOptions;
  committed: GameFilters;
  isPending: boolean;
  onApply: (f: GameFilters) => void;
  chesscomCount: number;
  lichessCount: number;
  errors: { chesscom?: string; lichess?: string };
  onRefresh: () => void;
  onRebuild: () => void;
}>) {
  const deferredCommitted = useDeferredValue(committed);
  const filteredGames = useMemo(
    () => applyFilters(allGames, deferredCommitted),
    [allGames, deferredCommitted]
  );

  return (
    <div className="flex flex-col gap-8">
      <FilterPanel
        committed={committed}
        options={filterOptions}
        applying={isPending}
        onApply={onApply}
        fields={["timeControl", "dateRange", "color"]}
        storageKey="analytics"
      />
      <FetchActions onRefresh={onRefresh} onRebuild={onRebuild} />
      <StatsView
        games={filteredGames}
        totalCount={allGames.length}
        chesscomCount={chesscomCount}
        lichessCount={lichessCount}
        errors={errors}
      />
    </div>
  );
}
