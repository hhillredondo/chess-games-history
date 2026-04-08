"use client";

import { Chess, type Move } from "chess.js";
import { useCallback, useEffect, useMemo, useState } from "react";

import { clocksAtEachPly } from "@/lib/pgn/clock-info";
import type { UnifiedGame } from "@/lib/types/unified-game";

import ChessBoard from "../_components/composed/ChessBoard/ChessBoard.client";

const NO_MOVES: Move[] = [];

function parseMovesFromPgn(
  pgn: string
): { ok: true; moves: Move[] } | { ok: false; error: string } {
  try {
    const c = new Chess();
    c.loadPgn(pgn.trim(), { newlineChar: "\n" });
    const moves = c.history({ verbose: true });
    return { ok: true, moves };
  } catch {
    return { ok: false, error: "Could not read moves from this game’s PGN." };
  }
}

function fenAfterMoves(moves: Move[], ply: number): string {
  const c = new Chess();
  for (let i = 0; i < ply && i < moves.length; i++) {
    const m = moves[i]!;
    c.move({ from: m.from, to: m.to, promotion: m.promotion });
  }
  return c.fen();
}

export default function GameReplayModal({
  game,
  onClose,
}: Readonly<{
  game: UnifiedGame;
  onClose: () => void;
}>) {
  const parsed = useMemo(() => parseMovesFromPgn(game.pgn), [game.pgn]);
  const moves = parsed.ok ? parsed.moves : NO_MOVES;

  const [ply, setPly] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const fen = useMemo(() => {
    if (!parsed.ok) return game.finalFen;
    if (moves.length === 0) return new Chess().fen();
    return fenAfterMoves(moves, ply);
  }, [parsed, moves, ply, game.finalFen]);

  const clocksByPly = useMemo(() => {
    if (!parsed.ok || moves.length === 0) return null;
    return clocksAtEachPly(game.pgn, moves);
  }, [parsed.ok, moves, game.pgn]);

  const goBack = useCallback(() => {
    setPly((p) => Math.max(0, p - 1));
  }, []);

  const goForward = useCallback(() => {
    setPly((p) => Math.min(moves.length, p + 1));
  }, [moves.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goBack();
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goForward();
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, goBack, goForward]);

  const orientation = flipped ? "black" : "white";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-replay-title"
    >
      <div
        className="absolute inset-0 bg-[color-mix(in_srgb,var(--foreground)_25%,transparent)]"
        aria-hidden
      />
      <div
        className="relative z-10 flex max-h-[calc(100dvh-2rem)] w-full max-w-[min(96vw,52rem)] flex-col gap-4 overflow-hidden rounded-xl border-2 border-[var(--foreground)] bg-[var(--background)] p-4 shadow-lg sm:gap-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4">
          <h2
            id="game-replay-title"
            className="min-w-0 text-lg font-semibold leading-tight sm:text-xl lg:text-2xl"
          >
            {game.whiteName} ({game.whiteRating ?? "?"}) —{" "}
            {game.blackName} ({game.blackRating ?? "?"})
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border-2 border-[var(--foreground)] px-3 py-1.5 font-mono text-base hover:opacity-80 sm:px-4 sm:py-2 sm:text-lg"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {!parsed.ok && (
          <p className="shrink-0 text-sm text-red-600 dark:text-red-400 sm:text-base">
            {parsed.error}
          </p>
        )}

        {parsed.ok && moves.length === 0 && (
          <p className="shrink-0 text-sm opacity-80 sm:text-base">
            No moves in PGN — showing the starting position only.
          </p>
        )}

        <div className="flex min-h-0 w-full min-w-0 shrink justify-center overflow-hidden px-1">
          <ChessBoard large position={fen} orientation={orientation} />
        </div>

        {parsed.ok && moves.length > 0 && (
          <div className="shrink-0 space-y-1 text-center font-mono text-sm opacity-80 sm:text-base">
            <p>
              Half-move {ply} / {moves.length}
              <span
                className="mt-0.5 block min-h-[1.35em] truncate text-xs normal-case leading-snug sm:text-sm"
                aria-live="polite"
              >
                {ply > 0 && ply <= moves.length
                  ? `Last: ${moves[ply - 1]!.san}`
                  : "\u00a0"}
              </span>
            </p>
            {clocksByPly && (
              <div
                className="min-h-[2.8em] space-y-0.5 text-[13.2px] leading-tight sm:text-xs"
                aria-live="polite"
              >
                <div className="truncate">
                  White: {clocksByPly[ply]?.white ?? "—"}
                </div>
                <div className="truncate">
                  Black: {clocksByPly[ply]?.black ?? "—"}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex shrink-0 flex-wrap items-center justify-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={goBack}
            disabled={ply <= 0}
            className="rounded-xl border-2 border-[var(--foreground)] px-6 py-2.5 font-mono text-lg disabled:opacity-40 sm:px-8 sm:py-3 sm:text-xl"
            aria-label="Previous move"
          >
            ←
          </button>
          <button
            type="button"
            onClick={goForward}
            disabled={ply >= moves.length}
            className="rounded-xl border-2 border-[var(--foreground)] px-6 py-2.5 font-mono text-lg disabled:opacity-40 sm:px-8 sm:py-3 sm:text-xl"
            aria-label="Next move"
          >
            →
          </button>
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            className={`rounded-xl border-2 border-[var(--foreground)] px-5 py-2.5 font-mono text-sm sm:px-6 sm:py-3 sm:text-base ${
              flipped ? "bg-[var(--foreground)] text-[var(--background)]" : ""
            }`}
            aria-pressed={flipped}
            aria-label="Flip board"
          >
            Flip board
          </button>
        </div>

        <p className="shrink-0 text-center text-xs opacity-70 sm:text-sm">
          Esc to close · ← → keys or buttons step through the game
        </p>
      </div>
    </div>
  );
}
