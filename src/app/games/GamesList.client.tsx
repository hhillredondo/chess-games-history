"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import Link from "next/link";
import {
  useDeferredValue,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import FetchActions from "@/app/_components/composed/FetchActions/FetchActions.client";
import FilterPanel from "@/app/_components/composed/FilterPanel/FilterPanel.client";
import IngestingLoader from "@/app/_components/composed/IngestingLoader/IngestingLoader.client";
import QuickStatsBar from "@/app/_components/composed/QuickStatsBar/QuickStatsBar.client";
import ViewTabs from "@/app/_components/composed/ViewTabs/ViewTabs.client";
import { computeQuickStats } from "@/lib/analytics/quick-stats";
import { usePlayerGames } from "@/lib/cache/PlayerGamesContext";
import {
  EMPTY_FILTERS,
  applyFilters,
  type DerivedFilterOptions,
  type GameFilters,
} from "@/lib/filters/game-filters";
import { formatWallClockDuration } from "@/lib/pgn/clock-info";
import type { UnifiedGame } from "@/lib/types/unified-game";

import ChessBoard from "../_components/composed/ChessBoard/ChessBoard.client";

import GameReplayModal from "./GameReplayModal.client";

function gameKey(g: UnifiedGame): string {
  return `${g.source}:${g.id}`;
}

function MergedGamesView({
  games,
  filterOptions,
  errors,
  onRefresh,
  onRebuild,
}: Readonly<{
  games: UnifiedGame[];
  filterOptions: DerivedFilterOptions;
  errors: { chesscom?: string; lichess?: string };
  onRefresh: () => void;
  onRebuild: () => void;
}>) {
  const [committed, setCommitted] = useState<GameFilters>(EMPTY_FILTERS);
  const [isPending, startTransition] = useTransition();
  const [replayGame, setReplayGame] = useState<UnifiedGame | null>(null);
  const deferredFilters = useDeferredValue(committed);
  const filtered = useMemo(
    () => applyFilters(games, deferredFilters),
    [games, deferredFilters]
  );
  const stats = useMemo(() => computeQuickStats(filtered), [filtered]);

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 500,
    overscan: 6,
  });

  return (
    <div className="flex flex-col gap-6">
      {replayGame && (
        <GameReplayModal
          key={gameKey(replayGame)}
          game={replayGame}
          onClose={() => setReplayGame(null)}
        />
      )}

      <FilterPanel
        committed={committed}
        options={filterOptions}
        applying={isPending}
        onApply={(next) => startTransition(() => setCommitted(next))}
        storageKey="games"
      />

      {(errors.chesscom || errors.lichess) && (
        <div className="rounded-lg border border-amber-600 p-3 text-sm">
          {errors.chesscom && (
            <p>
              <strong>Chess.com:</strong> {errors.chesscom}
            </p>
          )}
          {errors.lichess && (
            <p>
              <strong>Lichess:</strong> {errors.lichess}
            </p>
          )}
        </div>
      )}

      <FetchActions onRefresh={onRefresh} onRebuild={onRebuild} />

      <QuickStatsBar stats={stats} totalCount={games.length} />

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-[var(--foreground)] p-6 text-center text-sm opacity-80">
          No games match the current filters.
        </p>
      ) : (
        <div
          ref={parentRef}
          className="games-game-list-scroll h-[clamp(22rem,calc(100dvh-10rem),min(56rem,calc(100dvh-8rem)))] overflow-auto rounded-lg border border-[var(--foreground)] bg-[var(--background)]"
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
              paddingBottom: "1rem",
            }}
          >
            {virtualizer.getVirtualItems().map((v) => {
              const g = filtered[v.index];
              if (!g) return null;
              return (
                <div
                  key={gameKey(g)}
                  ref={virtualizer.measureElement}
                  data-index={v.index}
                  className="absolute top-0 left-0 w-full border-b border-[var(--foreground)] px-4 pt-4 pb-12 sm:px-5 sm:pt-5"
                  style={{ transform: `translateY(${v.start}px)` }}
                >
                  <div className="flex min-w-0 flex-col gap-4">
                    <div className="flex min-w-0 flex-col gap-1.5 text-sm leading-snug">
                      <span className="flex flex-wrap items-center gap-2 break-words">
                        <span className="rounded border border-[var(--foreground)]/50 px-1.5 py-0.5 font-mono text-[10.5px] uppercase opacity-80">
                          {g.source === "chesscom" ? "Chess.com" : "Lichess"}
                        </span>
                        <span>
                          {new Date(g.endAt).toLocaleString()} ·{" "}
                          <strong>{g.result}</strong> as {g.userColor}
                        </span>
                      </span>
                      <span className="break-words text-[var(--foreground)]/95">
                        {g.whiteName} ({g.whiteRating ?? "?"}) —{" "}
                        {g.blackName} ({g.blackRating ?? "?"})
                      </span>
                      {g.opening?.name && (
                        <span className="break-words text-xs opacity-80">
                          {g.opening.eco ? `${g.opening.eco} ` : ""}
                          {g.opening.name}
                        </span>
                      )}
                      <span className="break-words text-xs opacity-80">
                        {g.timeControl && (
                          <>
                            Time control:{" "}
                            <span className="font-mono">{g.timeControl}</span>
                            {" · "}
                          </>
                        )}
                        Reported span:{" "}
                        <span className="font-mono">
                          {formatWallClockDuration(g.playedAt, g.endAt)}
                        </span>
                      </span>
                      {(g.endClockWhite != null || g.endClockBlack != null) && (
                        <span className="break-words text-xs opacity-80">
                          Clocks at end — White:{" "}
                          <span className="font-mono">
                            {g.endClockWhite ?? "—"}
                          </span>
                          {" · Black: "}
                          <span className="font-mono">
                            {g.endClockBlack ?? "—"}
                          </span>
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-center gap-5">
                      <button
                        type="button"
                        onClick={() => setReplayGame(g)}
                        className="cursor-pointer rounded-md border-0 bg-transparent p-0 transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--foreground)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
                        aria-label="Open full game replay"
                      >
                        <ChessBoard compact position={g.finalFen} />
                      </button>
                      {g.gameUrl && (
                        <a
                          href={g.gameUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg border-2 border-[var(--foreground)] px-4 py-2 font-mono text-sm transition-opacity hover:opacity-70"
                        >
                          View on {g.source === "chesscom" ? "Chess.com" : "Lichess"} ↗
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function GamesList() {
  const { chesscom, lichess, ccState, liState, allDone, allGames, filterOptions, refresh, rebuild } =
    usePlayerGames();
  const hasCc = Boolean(chesscom);
  const hasLi = Boolean(lichess);

  if (!hasCc && !hasLi) {
    return (
      <div className="p-8 text-center max-w-lg mx-auto">
        <p className="mb-4">No usernames in the URL.</p>
        <Link href="/" className="underline">
          Back to search
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[min(100%,92rem)] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <ViewTabs current="games" />

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
        <div className="flex max-w-sm flex-col gap-3">
          <p className="font-mono text-sm">Loading all games…</p>
          {hasCc && (
            <p className="text-sm">
              Chess.com:{" "}
              {ccState.done
                ? `${ccState.loaded} games`
                : `${ccState.loaded} games…`}
              {ccState.error && (
                <span className="ml-2 text-red-500">{ccState.error}</span>
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
                <span className="ml-2 text-red-500">{liState.error}</span>
              )}
            </p>
          )}
        </div>
      )}

      {allDone && (
        <MergedGamesView
          games={allGames}
          filterOptions={filterOptions}
          errors={{ chesscom: ccState.error, lichess: liState.error }}
          onRefresh={refresh}
          onRebuild={rebuild}
        />
      )}
    </div>
  );
}
