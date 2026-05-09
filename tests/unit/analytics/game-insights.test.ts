import { describe, expect, it } from "vitest";

import { computeGameInsights } from "@/lib/analytics/game-insights";

import { makeGame, nextId } from "../../fixtures/games";

const STARTPOS_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// White is up a queen vs Black with everyone else equal
const WHITE_UP_A_QUEEN_FEN =
  "rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("computeGameInsights", () => {
  it("returns null longest break and zero average for empty input", () => {
    const out = computeGameInsights([]);
    expect(out.longestBreak).toBeNull();
    expect(out.avgMovesPerGame).toBe(0);
    expect(out.resignMaterial.total).toBe(0);
    expect(out.drawMaterial.total).toBe(0);
  });

  it("computes average full moves per game", () => {
    const games = [
      makeGame({ plyCount: 40 }),
      makeGame({ plyCount: 60 }),
    ];
    // (40+60)/2 = 50 ply / 2 = 25 full moves
    expect(computeGameInsights(games).avgMovesPerGame).toBe(25);
  });

  it("identifies the longest break between consecutive games", () => {
    const games = [
      makeGame({ endAt: "2026-01-01T12:00:00.000Z" }),
      makeGame({ endAt: "2026-01-02T12:00:00.000Z" }), // 1 day gap
      makeGame({ endAt: "2026-01-12T12:00:00.000Z" }), // 10 day gap ← longest
      makeGame({ endAt: "2026-01-15T12:00:00.000Z" }), // 3 day gap
    ];
    const out = computeGameInsights(games);
    expect(out.longestBreak).not.toBeNull();
    expect(out.longestBreak!.days).toBeCloseTo(10, 5);
  });

  it("buckets resigned games by material at the final position", () => {
    const aheadGame = makeGame({
      id: nextId("res-ahead"),
      result: "loss", // resigned despite being up
      termination: "won by resignation",
      finalFen: WHITE_UP_A_QUEEN_FEN,
      userColor: "white",
    });
    const behindGame = makeGame({
      id: nextId("res-behind"),
      result: "loss",
      termination: "resignation",
      finalFen: WHITE_UP_A_QUEEN_FEN, // White ahead, but user is Black → behind
      userColor: "black",
    });
    const out = computeGameInsights([aheadGame, behindGame]);
    expect(out.resignMaterial.total).toBe(2);
    expect(out.resignMaterial.ahead).toBe(1);
    expect(out.resignMaterial.behind).toBe(1);
  });

  it("buckets draws by material at the final position", () => {
    const equalDraw = makeGame({
      id: nextId("draw-eq"),
      result: "draw",
      finalFen: STARTPOS_FEN,
    });
    const aheadDraw = makeGame({
      id: nextId("draw-ahead"),
      result: "draw",
      finalFen: WHITE_UP_A_QUEEN_FEN,
      userColor: "white",
    });
    const out = computeGameInsights([equalDraw, aheadDraw]);
    expect(out.drawMaterial.total).toBe(2);
    expect(out.drawMaterial.equal).toBe(1);
    expect(out.drawMaterial.ahead).toBe(1);
  });
});
