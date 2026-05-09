import { describe, expect, it } from "vitest";

import { buildCoachContext } from "@/lib/analytics/coach-context";

import { makeGame } from "../../fixtures/games";

describe("buildCoachContext", () => {
  it("returns the empty-dataset placeholder when no games", () => {
    expect(buildCoachContext([])).toBe("No games in the filtered dataset.");
  });

  it("returns a multi-section summary string for non-empty input", () => {
    const games = [
      makeGame({ result: "win", userColor: "white" }),
      makeGame({ result: "loss", userColor: "black" }),
      makeGame({ result: "draw", userColor: "white" }),
    ];
    const out = buildCoachContext(games);
    expect(out).toContain("Dataset covers");
    expect(out).toContain("Overall:");
    // Section markers from various analytics modules
    expect(out).toContain("Openings as White");
    expect(out).toContain("Openings as Black");
    expect(out).toContain("Activity by year");
  });

  it("includes provided usernames in the player line", () => {
    const games = [makeGame({})];
    const out = buildCoachContext(games, {
      chesscomUsername: "alice",
      lichessUsername: "alice_l",
    });
    expect(out).toContain("Chess.com: alice");
    expect(out).toContain("Lichess: alice_l");
  });

  it("omits the player line when no usernames are provided", () => {
    const out = buildCoachContext([makeGame({})]);
    expect(out).not.toContain("Chess.com:");
    expect(out).not.toContain("Lichess:");
  });
});
