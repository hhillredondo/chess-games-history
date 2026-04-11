import { Chess } from "chess.js";

import type { UnifiedGame } from "@/lib/types/unified-game";

export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";

export const PIECE_LABELS: Record<PieceType, string> = {
  p: "Pawn",
  n: "Knight",
  b: "Bishop",
  r: "Rook",
  q: "Queen",
  k: "King",
};

// Simple material values (excludes king from balance calculation)
const PIECE_VALUES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

/** Ordered by how often each piece delivers checkmate (most to least common). */
const PIECE_ORDER: PieceType[] = ["q", "r", "b", "n", "p", "k"];

export interface DeliveringPieceRow {
  piece: PieceType;
  label: string;
  given: number;
  received: number;
}

export type MaterialBucket = "ahead" | "equal" | "behind";

export interface MaterialBalanceRow {
  bucket: MaterialBucket;
  label: string;
  given: number;
  received: number;
}

export interface CheckmateStats {
  deliveringPiece: DeliveringPieceRow[];
  materialBalance: MaterialBalanceRow[];
  totalGiven: number;
  totalReceived: number;
  /** Checkmates where the delivering piece could not be determined. */
  unknownGiven: number;
  unknownReceived: number;
}

/** Material difference from the user's perspective at the given FEN. */
function materialDiff(fen: string, userColor: "white" | "black"): number | null {
  try {
    const c = new Chess(fen);
    let white = 0;
    let black = 0;
    for (const row of c.board()) {
      for (const sq of row) {
        if (!sq) continue;
        const val = PIECE_VALUES[sq.type] ?? 0;
        if (sq.color === "w") white += val;
        else black += val;
      }
    }
    const diff = white - black;
    return userColor === "white" ? diff : -diff;
  } catch {
    return null;
  }
}

function materialBucket(diff: number | null): MaterialBucket | null {
  if (diff == null) return null;
  if (diff > 0) return "ahead";
  if (diff < 0) return "behind";
  return "equal";
}

/**
 * The piece that made the last move in the PGN (i.e. delivered the check).
 * Uses cheap string parsing instead of replaying the full game via chess.js.
 */
function lastMovePiece(pgn: string): PieceType | null {
  // Strip headers, comments, move numbers, NAG codes, result, and annotations
  const text = pgn
    .replace(/\[[^\]]*\]/g, "")      // [Tag "Value"] headers
    .replace(/\{[^}]*\}/g, "")       // { comment } blocks
    .replace(/\([^)]*\)/g, "")       // (variation) blocks (non-nested)
    .replace(/\d+\.+/g, "")          // move numbers like "1." or "1..."
    .replace(/1-0|0-1|1\/2-1\/2|\*/g, "") // result tokens
    .replace(/[!?]+/g, "")           // annotation glyphs
    .replace(/\$\d+/g, "");          // NAG codes

  const tokens = text.trim().split(/\s+/).filter(Boolean);
  const last = tokens[tokens.length - 1];
  if (!last) return null;

  // Castling = king
  if (last.startsWith("O-O") || last.startsWith("0-0")) return "k";

  const first = last[0];
  if (!first) return null;
  if (first === "N") return "n";
  if (first === "B") return "b";
  if (first === "R") return "r";
  if (first === "Q") return "q";
  if (first === "K") return "k";
  // Lowercase = pawn move
  return "p";
}

export function computeCheckmateStats(games: UnifiedGame[]): CheckmateStats {
  const givenMap = new Map<PieceType, number>();
  const receivedMap = new Map<PieceType, number>();
  const matGiven: Record<MaterialBucket, number> = {
    ahead: 0,
    equal: 0,
    behind: 0,
  };
  const matReceived: Record<MaterialBucket, number> = {
    ahead: 0,
    equal: 0,
    behind: 0,
  };
  let totalGiven = 0;
  let totalReceived = 0;
  let unknownGiven = 0;
  let unknownReceived = 0;

  for (const g of games) {
    try {
      const c = new Chess(g.finalFen);
      if (!c.isCheckmate()) continue;

      // The side to move is the mated side; the previous mover delivered it.
      const matedColor = c.turn() === "w" ? "white" : "black";
      const userGave = matedColor !== g.userColor;

      if (userGave) {
        totalGiven++;
        const piece = lastMovePiece(g.pgn);
        if (piece) {
          givenMap.set(piece, (givenMap.get(piece) ?? 0) + 1);
        } else {
          unknownGiven++;
        }
        const bkt = materialBucket(materialDiff(g.finalFen, g.userColor));
        if (bkt) matGiven[bkt]++;
      } else {
        totalReceived++;
        const piece = lastMovePiece(g.pgn);
        if (piece) {
          receivedMap.set(piece, (receivedMap.get(piece) ?? 0) + 1);
        } else {
          unknownReceived++;
        }
        const bkt = materialBucket(materialDiff(g.finalFen, g.userColor));
        if (bkt) matReceived[bkt]++;
      }
    } catch {
      // skip broken games
    }
  }

  const deliveringPiece: DeliveringPieceRow[] = PIECE_ORDER.filter(
    (p) => givenMap.has(p) || receivedMap.has(p)
  ).map((p) => ({
    piece: p,
    label: PIECE_LABELS[p],
    given: givenMap.get(p) ?? 0,
    received: receivedMap.get(p) ?? 0,
  }));

  const materialBalance: MaterialBalanceRow[] = [
    { bucket: "ahead", label: "Ahead in material", given: matGiven.ahead, received: matReceived.ahead },
    { bucket: "equal", label: "Equal material", given: matGiven.equal, received: matReceived.equal },
    { bucket: "behind", label: "Behind in material", given: matGiven.behind, received: matReceived.behind },
  ];

  return {
    deliveringPiece,
    materialBalance,
    totalGiven,
    totalReceived,
    unknownGiven,
    unknownReceived,
  };
}
