import { Chess } from "chess.js";

/** Returns a `Chess` instance for a valid FEN, or null. */
export function chessFromFen(fen: string): Chess | null {
  try {
    return new Chess(fen);
  } catch {
    return null;
  }
}
