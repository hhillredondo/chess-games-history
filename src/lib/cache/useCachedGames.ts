"use client";

import { useEffect, useState } from "react";

import type { ChessComCursor } from "@/lib/fetch/chesscom";
import type { UnifiedGame } from "@/lib/types/unified-game";

import type { CacheManifest } from "./types";

export type PlatformStatus = "empty" | "ingesting" | "ready" | "error";

export interface PlatformState {
  games: UnifiedGame[];
  loaded: number;
  done: boolean;
  status: PlatformStatus | null;
  error?: string;
  /**
   * Games the server worker has ingested so far (from Dynamo). Defined only
   * while the server is actively running; cleared once we start reading shards.
   */
  serverGamesLoaded?: number;
}

const EMPTY_STATE: PlatformState = {
  games: [],
  loaded: 0,
  done: false,
  status: null,
};

const POLL_MS = 4000;

interface ManifestResponse {
  status?: {
    chesscom?: {
      status: PlatformStatus;
      gamesLoaded: number;
      lastFetchedAt?: string;
      error?: string;
    } | null;
    lichess?: {
      status: PlatformStatus;
      gamesLoaded: number;
      lastFetchedAt?: string;
      error?: string;
    } | null;
  };
  manifest?: {
    chesscom?: CacheManifest | null;
    lichess?: CacheManifest | null;
  };
  startedJob?: boolean;
  error?: string;
}

interface ShardResponse {
  games?: UnifiedGame[];
  error?: string;
}

async function fetchManifest(
  chesscom: string | null,
  lichess: string | null,
  action: "read" | "refresh" | "rebuild",
  signal: AbortSignal
): Promise<ManifestResponse> {
  const q = new URLSearchParams();
  if (chesscom) q.set("chesscom", chesscom);
  if (lichess) q.set("lichess", lichess);
  if (action !== "read") q.set("action", action);
  const r = await fetch(`/api/cache?${q}`, { signal });
  if (!r.ok) {
    const body = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? r.statusText);
  }
  return (await r.json()) as ManifestResponse;
}

async function fetchShard(
  platform: "chesscom" | "lichess",
  username: string,
  month: string,
  signal: AbortSignal
): Promise<UnifiedGame[]> {
  const q = new URLSearchParams();
  q.set("shard", "1");
  q.set("platform", platform);
  q.set("username", username);
  q.set("month", month);
  const r = await fetch(`/api/cache?${q}`, { signal });
  if (!r.ok) {
    const body = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? r.statusText);
  }
  const data = (await r.json()) as ShardResponse;
  return data.games ?? [];
}

async function loadAllShards(
  platform: "chesscom" | "lichess",
  username: string,
  manifest: CacheManifest,
  onProgress: (count: number) => void,
  signal: AbortSignal
): Promise<UnifiedGame[]> {
  const all: UnifiedGame[] = [];
  let loaded = 0;
  await Promise.all(
    manifest.shards.map(async (month) => {
      const games = await fetchShard(platform, username, month, signal);
      if (signal.aborted) return;
      all.push(...games);
      loaded += games.length;
      onProgress(loaded);
    })
  );
  all.sort((a, b) => new Date(b.endAt).getTime() - new Date(a.endAt).getTime());
  return all;
}

// Fallback: direct loop against /api/games when the cache endpoint is
// unavailable (not deployed, network error, etc.).
async function fetchAllDirect(
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
        if (cursor != null) q.set("lichessUntil", String(cursor as number));
      }
      const r = await fetch(`/api/games?${q}`, { signal });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? r.statusText);
      }
      const data = (await r.json()) as {
        games?: UnifiedGame[];
        cursors?: { chesscom?: ChessComCursor | null; lichessUntil?: number | null };
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
    if (e instanceof DOMException && e.name === "AbortError") return { games: all };
    return { games: all, error: e instanceof Error ? e.message : "Fetch failed" };
  }
}

/** Waits `ms` milliseconds, honouring the AbortSignal. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true });
  });
}

export interface UseCachedGamesResult {
  ccState: PlatformState;
  liState: PlatformState;
  allDone: boolean;
  refresh: () => void;
  rebuild: () => void;
}

export function useCachedGames(
  chesscom: string,
  lichess: string
): UseCachedGamesResult {
  const [ccState, setCcState] = useState<PlatformState>(EMPTY_STATE);
  const [liState, setLiState] = useState<PlatformState>(EMPTY_STATE);
  const [refreshTick, setRefreshTick] = useState(0);
  const [actionOverride, setActionOverride] = useState<
    "refresh" | "rebuild" | null
  >(null);

  useEffect(() => {
    const cc = chesscom.trim();
    const li = lichess.trim();
    if (!cc && !li) return;

    const ac = new AbortController();

    const loadPlatform = async (
      platform: "chesscom" | "lichess",
      username: string,
      manifest: CacheManifest | null,
      setState: (updater: (prev: PlatformState) => PlatformState) => void
    ) => {
      if (manifest && manifest.shards.length > 0) {
        // Clear serverGamesLoaded: we're now loading from S3, not polling Dynamo.
        setState((prev) => ({ ...prev, status: "ingesting", serverGamesLoaded: undefined }));
        try {
          const games = await loadAllShards(
            platform,
            username,
            manifest,
            (count) =>
              setState((prev) => ({ ...prev, loaded: count, status: "ingesting" })),
            ac.signal
          );
          if (ac.signal.aborted) return;
          setState(() => ({
            games,
            loaded: games.length,
            done: true,
            status: "ready",
          }));
        } catch (e) {
          if (ac.signal.aborted) return;
          const msg = e instanceof Error ? e.message : "Shard fetch failed";
          setState((prev) => ({ ...prev, done: true, status: "error", error: msg }));
        }
        return;
      }

      // No manifest — fall back to direct client-side fetching. This path is
      // taken when the cache endpoint is entirely unavailable (not deployed,
      // network error). When the server is actively ingesting but we haven't
      // started shards yet, we reach here after polling finishes (status will
      // be "ready" but manifest is empty) — fetchAllDirect picks up the slack.
      setState((prev) => ({ ...prev, status: "ingesting", serverGamesLoaded: undefined }));
      const { games, error } = await fetchAllDirect(
        platform,
        username,
        (count) =>
          setState((prev) => ({ ...prev, loaded: count, status: "ingesting" })),
        ac.signal
      );
      if (ac.signal.aborted) return;
      setState(() => ({
        games,
        loaded: games.length,
        done: true,
        status: error ? "error" : "ready",
        error,
      }));
    };

    /* eslint-disable react-hooks/set-state-in-effect -- resetting per-platform state on username change */
    if (cc) setCcState({ ...EMPTY_STATE, status: "ingesting" });
    else setCcState({ ...EMPTY_STATE, done: true });
    if (li) setLiState({ ...EMPTY_STATE, status: "ingesting" });
    else setLiState({ ...EMPTY_STATE, done: true });
    /* eslint-enable react-hooks/set-state-in-effect */

    const action = actionOverride ?? "read";

    (async () => {
      let resp: ManifestResponse | null = null;
      try {
        resp = await fetchManifest(cc || null, li || null, action, ac.signal);
      } catch (e) {
        if (ac.signal.aborted) return;
        // Manifest endpoint failed entirely (not deployed) — skip to direct fetch.
        // eslint-disable-next-line no-console
        console.warn("[useCachedGames] manifest fetch failed, falling back to direct fetch", e);
      }

      if (ac.signal.aborted) return;

      const ccSrvStatus = resp?.status?.chesscom?.status ?? null;
      const liSrvStatus = resp?.status?.lichess?.status ?? null;

      // Determine which platforms have a server-side worker running.
      // "empty" → worker just kicked off (first visit); "ingesting" → mid-run.
      let ccPolling = Boolean(cc && (ccSrvStatus === "ingesting" || ccSrvStatus === "empty"));
      let liPolling = Boolean(li && (liSrvStatus === "ingesting" || liSrvStatus === "empty"));

      if (ccPolling || liPolling) {
        // Show the server progress counter in the UI.
        if (cc && ccPolling) {
          setCcState((prev) => ({
            ...prev,
            status: "ingesting",
            serverGamesLoaded: resp?.status?.chesscom?.gamesLoaded ?? 0,
          }));
        }
        if (li && liPolling) {
          setLiState((prev) => ({
            ...prev,
            status: "ingesting",
            serverGamesLoaded: resp?.status?.lichess?.gamesLoaded ?? 0,
          }));
        }

        // Poll until all platforms have finished (ready or error).
        while (!ac.signal.aborted && (ccPolling || liPolling)) {
          await sleep(POLL_MS, ac.signal);
          if (ac.signal.aborted) return;

          try {
            resp = await fetchManifest(cc || null, li || null, "read", ac.signal);
          } catch {
            // Transient network error — keep polling.
            continue;
          }
          if (ac.signal.aborted) return;

          const newCcStatus = resp.status?.chesscom?.status ?? null;
          const newLiStatus = resp.status?.lichess?.status ?? null;

          if (cc && ccPolling) {
            setCcState((prev) => ({
              ...prev,
              serverGamesLoaded: resp?.status?.chesscom?.gamesLoaded ?? prev.serverGamesLoaded ?? 0,
            }));
            if (newCcStatus !== "ingesting" && newCcStatus !== "empty") {
              ccPolling = false;
            }
          }
          if (li && liPolling) {
            setLiState((prev) => ({
              ...prev,
              serverGamesLoaded: resp?.status?.lichess?.gamesLoaded ?? prev.serverGamesLoaded ?? 0,
            }));
            if (newLiStatus !== "ingesting" && newLiStatus !== "empty") {
              liPolling = false;
            }
          }
        }

        if (ac.signal.aborted) return;
      }

      // All platforms are now ready, errored, or the endpoint was unavailable.
      // Kick off per-platform shard loading (or surface the error).
      if (cc) {
        const finalStatus = resp?.status?.chesscom?.status ?? null;
        const manifest = resp?.manifest?.chesscom ?? null;

        if (finalStatus === "error") {
          setCcState((prev) => ({
            ...prev,
            done: true,
            status: "error",
            error: resp?.status?.chesscom?.error ?? "Server ingestion failed",
            serverGamesLoaded: undefined,
          }));
        } else {
          void loadPlatform("chesscom", cc, manifest, setCcState);
        }
      }
      if (li) {
        const finalStatus = resp?.status?.lichess?.status ?? null;
        const manifest = resp?.manifest?.lichess ?? null;

        if (finalStatus === "error") {
          setLiState((prev) => ({
            ...prev,
            done: true,
            status: "error",
            error: resp?.status?.lichess?.error ?? "Server ingestion failed",
            serverGamesLoaded: undefined,
          }));
        } else {
          void loadPlatform("lichess", li, manifest, setLiState);
        }
      }
    })();

    return () => {
      ac.abort();
    };
  }, [chesscom, lichess, refreshTick, actionOverride]);

  const allDone = ccState.done && liState.done;

  return {
    ccState,
    liState,
    allDone,
    refresh: () => {
      setActionOverride("refresh");
      setRefreshTick((t) => t + 1);
    },
    rebuild: () => {
      setActionOverride("rebuild");
      setRefreshTick((t) => t + 1);
    },
  };
}
