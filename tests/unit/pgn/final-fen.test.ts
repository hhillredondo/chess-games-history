import { describe, expect, it } from "vitest";

import { pgnToFinalFen } from "@/lib/pgn/final-fen";

import { SCHOLARS_MATE_PGN, TWO_GAMES_BLOB } from "../../fixtures/pgns";

describe("pgnToFinalFen", () => {
  it("returns the final FEN of a checkmating game", () => {
    const fen = pgnToFinalFen(SCHOLARS_MATE_PGN);
    expect(fen).toMatch(/ b /); // Black to move (mated)
    // Scholar's mate: Qxf7#, white queen on f7
    const placement = fen!.split(" ")[0];
    expect(placement).toContain("Q");
  });

  it("returns null for empty input", () => {
    expect(pgnToFinalFen("")).toBeNull();
    expect(pgnToFinalFen("   ")).toBeNull();
  });

  it("returns null for unparseable PGN", () => {
    expect(pgnToFinalFen("this is not a pgn")).toBeNull();
  });

  it("uses the last game when given a multi-game blob", () => {
    const fen = pgnToFinalFen(TWO_GAMES_BLOB);
    expect(fen).not.toBeNull();
  });
});
