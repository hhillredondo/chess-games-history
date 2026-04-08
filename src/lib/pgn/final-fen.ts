import { Chess } from "chess.js";

import { splitPgnGames } from "./split";

/** Returns FEN of the final position, or null if the PGN cannot be replayed. */
export function pgnToFinalFen(pgn: string): string | null {
  const trimmed = pgn.trim();
  if (!trimmed) return null;

  const games = splitPgnGames(trimmed);
  const main = games[games.length - 1] ?? trimmed;

  try {
    const chess = new Chess();
    chess.loadPgn(main, { newlineChar: "\n" });
    return chess.fen();
  } catch {
    return null;
  }
}
