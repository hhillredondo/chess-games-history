import type { UnifiedGame } from "@/lib/types/unified-game";

let _autoId = 0;
export function nextId(prefix = "g"): string {
  _autoId += 1;
  return `${prefix}-${_autoId}`;
}

const STARTPOS_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export function makeGame(overrides: Partial<UnifiedGame> = {}): UnifiedGame {
  return {
    source: overrides.source ?? "chesscom",
    id: overrides.id ?? nextId(),
    playedAt: "2026-01-01T12:00:00.000Z",
    endAt: "2026-01-01T12:05:00.000Z",
    whiteName: "alice",
    blackName: "bob",
    whiteRating: 1500,
    blackRating: 1500,
    result: "win",
    userColor: "white",
    pgn: "",
    finalFen: STARTPOS_FEN,
    plyCount: 20,
    timeControl: "180+2",
    ...overrides,
  };
}
