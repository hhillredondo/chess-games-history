import { describe, expect, it } from "vitest";

import { splitPgnGames } from "@/lib/pgn/split";

import {
  PGN_WITH_CLOCKS,
  SCHOLARS_MATE_PGN,
  TWO_GAMES_BLOB,
} from "../../fixtures/pgns";

describe("splitPgnGames", () => {
  it("returns an empty array for empty input", () => {
    expect(splitPgnGames("")).toEqual([]);
    expect(splitPgnGames("   \n\n  ")).toEqual([]);
  });

  it("returns a single-element array for a single game", () => {
    const out = splitPgnGames(SCHOLARS_MATE_PGN);
    expect(out).toHaveLength(1);
    expect(out[0]).toContain("Qxf7#");
  });

  it("splits a multi-game blob on the blank-line + tag boundary", () => {
    const out = splitPgnGames(TWO_GAMES_BLOB);
    expect(out).toHaveLength(2);
    expect(out[0]).toContain("Qxf7#");
    expect(out[1]).toContain("[%clk");
    expect(out[1]).toBe(PGN_WITH_CLOCKS.trim());
  });

  it("falls back to the whole blob when no boundary is found", () => {
    const weird = "no tags, no boundary, just words";
    expect(splitPgnGames(weird)).toEqual([weird]);
  });
});
