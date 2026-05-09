import { describe, expect, it } from "vitest";

import { aggregateOpenings } from "@/lib/analytics/openings";

import { makeGame } from "../../fixtures/games";

describe("aggregateOpenings", () => {
  it("returns empty arrays for an empty input", () => {
    expect(aggregateOpenings([])).toEqual({ asWhite: [], asBlack: [] });
  });

  it("groups games by ECO + name and computes win rate / avg moves", () => {
    const sicilian = { eco: "B20", name: "Sicilian Defense" };
    const games = [
      makeGame({ userColor: "black", opening: sicilian, result: "win", plyCount: 60 }),
      makeGame({ userColor: "black", opening: sicilian, result: "win", plyCount: 80 }),
      makeGame({ userColor: "black", opening: sicilian, result: "loss", plyCount: 40 }),
    ];
    const out = aggregateOpenings(games, 3);
    expect(out.asWhite).toEqual([]);
    expect(out.asBlack).toHaveLength(1);
    const e = out.asBlack[0]!;
    expect(e.key).toBe("B20: Sicilian Defense");
    expect(e.games).toBe(3);
    expect(e.wins).toBe(2);
    expect(e.losses).toBe(1);
    expect(e.winRate).toBeCloseTo(2 / 3, 4);
    expect(e.avgMoves).toBe(30); // (60+80+40)/3 = 60 ply = 30 moves
  });

  it("filters out openings below the minGames threshold", () => {
    const games = [
      makeGame({ userColor: "white", opening: { eco: "C20", name: "King's Pawn" } }),
      makeGame({ userColor: "white", opening: { eco: "C20", name: "King's Pawn" } }),
    ];
    expect(aggregateOpenings(games, 3).asWhite).toEqual([]);
    expect(aggregateOpenings(games, 2).asWhite).toHaveLength(1);
  });

  it("splits stats by colour", () => {
    const op = { eco: "B20", name: "Sicilian" };
    const games = [
      ...Array(3).fill(0).map(() =>
        makeGame({ userColor: "white", opening: op, result: "win" })
      ),
      ...Array(3).fill(0).map(() =>
        makeGame({ userColor: "black", opening: op, result: "loss" })
      ),
    ];
    const out = aggregateOpenings(games, 3);
    expect(out.asWhite).toHaveLength(1);
    expect(out.asBlack).toHaveLength(1);
    expect(out.asWhite[0]!.winRate).toBe(1);
    expect(out.asBlack[0]!.winRate).toBe(0);
  });

  it("sorts openings by descending game count", () => {
    const a = { eco: "A00", name: "Ape Opening" };
    const b = { eco: "B00", name: "Bear Opening" };
    const games = [
      ...Array(2).fill(0).map(() => makeGame({ userColor: "white", opening: a })),
      ...Array(5).fill(0).map(() => makeGame({ userColor: "white", opening: b })),
    ];
    const out = aggregateOpenings(games, 2);
    expect(out.asWhite.map((e) => e.eco)).toEqual(["B00", "A00"]);
  });
});
