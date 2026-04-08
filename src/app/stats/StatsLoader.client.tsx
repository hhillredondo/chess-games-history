"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import type { ChessComCursor } from "@/lib/fetch/chesscom";
import type { UnifiedGame } from "@/lib/types/unified-game";

import StatsView from "./StatsView.client";

interface PlatformState {
  games: UnifiedGame[];
  loaded: number;
  done: boolean;
  error?: string;
}

async function fetchAllForPlatform(
  platform: "chesscom" | "lichess",
  username: string,
  onProgress: (count: number) => void,
  signal: AbortSignal
): Promise<{ games: UnifiedGame[]; error?: string }> {
  const all: UnifiedGame[] = [];
  let cursor: ChessComCursor | number | null = null;
  let hasMore = true;

  try {
    while (hasMore) {
      if (signal.aborted) return { games: all };

      const q = new URLSearchParams();
      q.set("perPlatform", "100");
      if (platform === "chesscom") {
        q.set("chesscom", username);
        q.set("noLichess", "1");
        if (cursor != null) {
          const cc = cursor as ChessComCursor;
          q.set("ccMonth", String(cc.monthIdx));
          q.set("ccSkip", String(cc.gameSkip));
        }
      } else {
        q.set("lichess", username);
        q.set("noChesscom", "1");
        if (cursor != null) {
          q.set("lichessUntil", String(cursor as number));
        }
      }

      const r = await fetch(`/api/games?${q}`, { signal });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? r.statusText);
      }
      const data = (await r.json()) as {
        games?: UnifiedGame[];
        cursors?: {
          chesscom?: ChessComCursor | null;
          lichessUntil?: number | null;
        };
        hasMore?: boolean;
      };

      all.push(...(data.games ?? []));
      onProgress(all.length);

      cursor =
        platform === "chesscom"
          ? (data.cursors?.chesscom ?? null)
          : (data.cursors?.lichessUntil ?? null);
      hasMore = Boolean(data.hasMore) && cursor != null;
    }
    return { games: all };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError")
      return { games: all };
    return {
      games: all,
      error: e instanceof Error ? e.message : "Fetch failed",
    };
  }
}

export default function StatsLoader() {
  const searchParams = useSearchParams();
  const chesscom = searchParams.get("chesscom") ?? "";
  const lichess = searchParams.get("lichess") ?? "";
  const hasCc = Boolean(chesscom.trim());
  const hasLi = Boolean(lichess.trim());

  const [ccState, setCcState] = useState<PlatformState>({
    games: [],
    loaded: 0,
    done: false,
  });
  const [liState, setLiState] = useState<PlatformState>({
    games: [],
    loaded: 0,
    done: false,
  });

  useEffect(() => {
    const cc = chesscom.trim();
    const li = lichess.trim();
    if (!cc && !li) return;

    const ac = new AbortController();

    if (cc) {
      setCcState({ games: [], loaded: 0, done: false });
      fetchAllForPlatform(
        "chesscom",
        cc,
        (count) => setCcState((prev) => ({ ...prev, loaded: count })),
        ac.signal
      ).then(({ games, error }) => {
        if (!ac.signal.aborted)
          setCcState({ games, loaded: games.length, done: true, error });
      });
    } else {
      setCcState({ games: [], loaded: 0, done: true });
    }

    if (li) {
      setLiState({ games: [], loaded: 0, done: false });
      fetchAllForPlatform(
        "lichess",
        li,
        (count) => setLiState((prev) => ({ ...prev, loaded: count })),
        ac.signal
      ).then(({ games, error }) => {
        if (!ac.signal.aborted)
          setLiState({ games, loaded: games.length, done: true, error });
      });
    } else {
      setLiState({ games: [], loaded: 0, done: true });
    }

    return () => ac.abort();
  }, [chesscom, lichess]);

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

  const gamesParams = new URLSearchParams();
  if (hasCc) gamesParams.set("chesscom", chesscom.trim());
  if (hasLi) gamesParams.set("lichess", lichess.trim());
  const gamesHref = `/games?${gamesParams.toString()}`;

  const allDone = ccState.done && liState.done;

  const allGames = [...ccState.games, ...liState.games].sort(
    (a, b) => new Date(a.endAt).getTime() - new Date(b.endAt).getTime()
  );

  return (
    <div className="mx-auto w-full max-w-[min(100%,92rem)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap gap-4 items-baseline mb-6">
        <Link href={gamesHref} className="text-sm underline">
          ← Games
        </Link>
      </div>

      {!allDone && (
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
        <StatsView
          games={allGames}
          chesscomCount={ccState.games.length}
          lichessCount={liState.games.length}
          errors={{ chesscom: ccState.error, lichess: liState.error }}
        />
      )}
    </div>
  );
}
