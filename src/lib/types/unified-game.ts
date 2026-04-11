export type GameSource = "chesscom" | "lichess";

export type UserResult = "win" | "loss" | "draw" | "unknown";

export interface UnifiedGame {
  source: GameSource;
  id: string;
  playedAt: string;
  endAt: string;
  whiteName: string;
  blackName: string;
  whiteRating?: number;
  blackRating?: number;
  result: UserResult;
  userColor: "white" | "black";
  pgn: string;
  finalFen: string;
  opening?: { eco?: string; name?: string };
  /** PGN `[TimeControl "…"]`, e.g. `60+0`, `180+2`. */
  timeControl?: string;
  /** Remaining clock for White after the last move in the PGN, if `%clk` data exists. */
  endClockWhite?: string;
  /** Remaining clock for Black after the last move in the PGN, if `%clk` data exists. */
  endClockBlack?: string;
  /** Total half-move count in the PGN. */
  plyCount: number;
  /** Raw PGN `[Termination "…"]` value, e.g. `Normal`, `Time forfeit`. */
  termination?: string;
  /** Public URL to view the game on its source site, if available. */
  gameUrl?: string;
}
