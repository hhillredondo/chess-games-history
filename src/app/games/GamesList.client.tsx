"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import type { ChessComCursor } from "@/lib/fetch/chesscom";
import { formatWallClockDuration } from "@/lib/pgn/clock-info";
import type { UnifiedGame } from "@/lib/types/unified-game";

import ChessBoard from "../_components/composed/ChessBoard/ChessBoard.client";

import GameReplayModal from "./GameReplayModal.client";

function gameKey(g: UnifiedGame): string {
  return `${g.source}:${g.id}`;
}

function mergeDedupeSortDesc(
  prev: UnifiedGame[],
  incoming: UnifiedGame[]
): UnifiedGame[] {
  const m = new Map<string, UnifiedGame>();
  for (const g of prev) {
    m.set(gameKey(g), g);
  }
  for (const g of incoming) {
    m.set(gameKey(g), g);
  }
  return [...m.values()].sort(
    (a, b) =>
      new Date(b.endAt).getTime() - new Date(a.endAt).getTime()
  );
}

type Platform = "chesscom" | "lichess";

type GamesApiResponse = {
  games: UnifiedGame[];
  cursors: {
    chesscom?: ChessComCursor | null;
    lichessUntil?: number | null;
  };
  hasMore?: boolean;
  errors?: Record<string, string>;
};

function PlatformGamesColumn({
  platform,
  title,
  username,
}: Readonly<{
  platform: Platform;
  title: string;
  username: string;
}>) {
  const [games, setGames] = useState<UnifiedGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [replayGame, setReplayGame] = useState<UnifiedGame | null>(null);

  const cursorRef = useRef<ChessComCursor | number | null>(null);
  const gamesRef = useRef<UnifiedGame[]>([]);
  gamesRef.current = games;

  const fetchPage = useCallback(
    async (append: boolean) => {
      const u = username.trim();
      if (!u) throw new Error("Missing username");

      const q = new URLSearchParams();
      q.set("perPlatform", "100");
      if (platform === "chesscom") {
        q.set("chesscom", u);
        q.set("noLichess", "1");
        if (append) {
          const cur = cursorRef.current as ChessComCursor | null;
          if (cur == null) {
            throw new Error("No Chess.com cursor (nothing more to load)");
          }
          q.set("ccMonth", String(cur.monthIdx));
          q.set("ccSkip", String(cur.gameSkip));
        }
      } else {
        q.set("lichess", u);
        q.set("noChesscom", "1");
        if (append) {
          const until = cursorRef.current as number | null;
          if (until == null) {
            throw new Error("No Lichess cursor (nothing more to load)");
          }
          q.set("lichessUntil", String(until));
        }
      }

      const r = await fetch(`/api/games?${q}`);
      const data = (await r.json().catch(() => ({}))) as GamesApiResponse & {
        error?: string;
      };
      if (!r.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : r.statusText
        );
      }
      return data;
    },
    [platform, username]
  );

  useEffect(() => {
    if (!username.trim()) {
      setGames([]);
      setError(null);
      setApiError(null);
      setHasMore(false);
      cursorRef.current = null;
      setLoading(false);
      return;
    }

    const ac = new AbortController();
    cursorRef.current = null;
    setLoading(true);
    setError(null);
    setApiError(null);
    setGames([]);
    setHasMore(false);

    fetchPage(false)
      .then((data) => {
        if (ac.signal.aborted) return;
        const list = data.games ?? [];
        setGames(list);
        if (platform === "chesscom") {
          cursorRef.current = data.cursors?.chesscom ?? null;
        } else {
          cursorRef.current = data.cursors?.lichessUntil ?? null;
        }
        setHasMore(Boolean(data.hasMore));
        const errKey = platform === "chesscom" ? "chesscom" : "lichess";
        setApiError(data.errors?.[errKey] ?? null);
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Request failed");
        setGames([]);
        setHasMore(false);
        cursorRef.current = null;
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });

    return () => ac.abort();
  }, [fetchPage, platform, username]);

  const onLoadMore = useCallback(async () => {
    if (loading || !hasMore || loadingMore) return;

    setLoadingMore(true);
    setError(null);
    try {
      const data = await fetchPage(true);
      const merged = mergeDedupeSortDesc(gamesRef.current, data.games ?? []);
      setGames(merged);
      if (platform === "chesscom") {
        cursorRef.current = data.cursors?.chesscom ?? null;
      } else {
        cursorRef.current = data.cursors?.lichessUntil ?? null;
      }
      setHasMore(Boolean(data.hasMore));
      const errKey = platform === "chesscom" ? "chesscom" : "lichess";
      if (data.errors?.[errKey]) {
        setApiError(data.errors[errKey] ?? null);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, hasMore, loading, loadingMore, platform]);

  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: games.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 680,
    overscan: 6,
  });

  return (
    <section className="flex flex-col gap-3 min-w-0 flex-1">
      {replayGame && (
        <GameReplayModal
          key={gameKey(replayGame)}
          game={replayGame}
          onClose={() => setReplayGame(null)}
        />
      )}
      <h2 className="text-lg font-semibold font-mono border-b border-[var(--foreground)] pb-2">
        {title}
      </h2>

      <p className="text-sm opacity-80">
        {loading
          ? "Loading…"
          : `${games.length} game${games.length === 1 ? "" : "s"} loaded (newest first)`}
      </p>

      {apiError && (
        <p className="text-sm border border-amber-600 p-2 rounded">
          <strong>API:</strong> {apiError}
        </p>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {!loading && !error && games.length === 0 && (
        <p className="text-sm opacity-80">No games returned for this user.</p>
      )}

      {games.length > 0 && (
        <div
          ref={parentRef}
          className="games-game-list-scroll h-[clamp(22rem,calc(100dvh-10rem),min(56rem,calc(100dvh-8rem)))] overflow-auto rounded-lg border border-[var(--foreground)] bg-[var(--background)]"
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((v) => {
              const g = games[v.index];
              if (!g) return null;
              return (
                <div
                  key={gameKey(g)}
                  className="absolute top-0 left-0 w-full border-b border-[var(--foreground)] p-4 sm:p-5"
                  style={{ transform: `translateY(${v.start}px)` }}
                >
                  <div className="flex min-w-0 flex-col gap-4">
                    <div className="flex min-w-0 flex-col gap-1.5 text-sm leading-snug">
                      <span className="break-words">
                        {new Date(g.endAt).toLocaleString()} ·{" "}
                        <strong>{g.result}</strong> as {g.userColor}
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
                            Time control: <span className="font-mono">{g.timeControl}</span>
                            {" · "}
                          </>
                        )}
                        Duration:{" "}
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
                    <div className="flex shrink-0 justify-center">
                      <button
                        type="button"
                        onClick={() => setReplayGame(g)}
                        className="cursor-pointer rounded-md border-0 bg-transparent p-0 transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--foreground)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
                        aria-label="Open full game replay"
                      >
                        <ChessBoard compact position={g.finalFen} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {hasMore && (
            <div className="border-t border-[var(--foreground)] bg-[var(--background)] px-4 py-8 sm:py-10">
              <div className="flex justify-center">
                <button
                  type="button"
                  disabled={loadingMore || loading}
                  onClick={() => void onLoadMore()}
                  className="rounded-xl border-2 border-[var(--foreground)] px-5 py-2.5 font-mono text-sm bg-[var(--background)] text-[var(--foreground)] disabled:opacity-50"
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default function GamesList() {
  const searchParams = useSearchParams();
  const chesscom = searchParams.get("chesscom") ?? "";
  const lichess = searchParams.get("lichess") ?? "";

  const hasCc = Boolean(chesscom.trim());
  const hasLi = Boolean(lichess.trim());
  const hasBoth = hasCc && hasLi;

  const [mobileTab, setMobileTab] = useState<"chesscom" | "lichess">(
    () => (hasCc ? "chesscom" : "lichess")
  );

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
      <div className="flex flex-wrap gap-4 justify-between items-baseline">
        <Link href="/" className="text-sm underline">
          ← Search
        </Link>
        <Link
          href={`/stats?${new URLSearchParams(
            Object.fromEntries(
              [
                hasCc ? ["chesscom", chesscom] : null,
                hasLi ? ["lichess", lichess] : null,
              ].filter((x): x is [string, string] => x !== null)
            )
          ).toString()}`}
          className="text-sm underline"
        >
          Stats →
        </Link>
      </div>

      {hasBoth && (
        <div
          className="lg:hidden flex rounded-xl border-2 border-[var(--foreground)] p-1 gap-1"
          role="tablist"
          aria-label="Game source"
        >
          <button
            type="button"
            role="tab"
            id="tab-chesscom"
            aria-selected={mobileTab === "chesscom"}
            aria-controls="panel-chesscom"
            tabIndex={mobileTab === "chesscom" ? 0 : -1}
            onClick={() => setMobileTab("chesscom")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-mono transition-colors ${
              mobileTab === "chesscom"
                ? "bg-[var(--foreground)] text-[var(--background)]"
                : "opacity-80 hover:opacity-100"
            }`}
          >
            Chess.com
          </button>
          <button
            type="button"
            role="tab"
            id="tab-lichess"
            aria-selected={mobileTab === "lichess"}
            aria-controls="panel-lichess"
            tabIndex={mobileTab === "lichess" ? 0 : -1}
            onClick={() => setMobileTab("lichess")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-mono transition-colors ${
              mobileTab === "lichess"
                ? "bg-[var(--foreground)] text-[var(--background)]"
                : "opacity-80 hover:opacity-100"
            }`}
          >
            Lichess.org
          </button>
        </div>
      )}

      <div
        className={
          hasBoth
            ? "grid grid-cols-1 items-start gap-8 lg:grid-cols-2 lg:gap-12 xl:gap-14"
            : "flex flex-col gap-6"
        }
      >
        {hasCc && (
          <div
            id="panel-chesscom"
            role={hasBoth ? "tabpanel" : undefined}
            aria-labelledby={hasBoth ? "tab-chesscom" : undefined}
            className={
              hasBoth && mobileTab !== "chesscom"
                ? "min-w-0 hidden lg:block"
                : "min-w-0"
            }
          >
            <PlatformGamesColumn
              platform="chesscom"
              title="Chess.com"
              username={chesscom}
            />
          </div>
        )}
        {hasLi && (
          <div
            id="panel-lichess"
            role={hasBoth ? "tabpanel" : undefined}
            aria-labelledby={hasBoth ? "tab-lichess" : undefined}
            className={
              hasBoth && mobileTab !== "lichess"
                ? "min-w-0 hidden lg:block"
                : "min-w-0"
            }
          >
            <PlatformGamesColumn
              platform="lichess"
              title="Lichess.org"
              username={lichess}
            />
          </div>
        )}
      </div>
    </div>
  );
}
