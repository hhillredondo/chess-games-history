import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";

import {
  classifyOpeningFromVerboseHistory,
  fenForOpening,
  resolveOpeningFromLoadedGame,
} from "@/lib/openings/classify";

function sansFor(moves: string[]): { san: string }[] {
  const c = new Chess();
  for (const m of moves) c.move(m);
  return c.history({ verbose: true }).map(({ san }) => ({ san }));
}

describe("classifyOpeningFromVerboseHistory", () => {
  it("returns null for an empty history", () => {
    expect(classifyOpeningFromVerboseHistory([])).toBeNull();
  });

  it("returns an opening with a valid ECO code for a known sequence", () => {
    const out = classifyOpeningFromVerboseHistory(sansFor(["e4", "e5", "Nf3", "Nc6", "Bb5"]));
    expect(out).not.toBeNull();
    expect(out!.eco).toMatch(/^[A-E]\d{2}$/);
    expect(out!.name.length).toBeGreaterThan(0);
  });

  it("matches a longer opening prefix when more moves are available", () => {
    const short = classifyOpeningFromVerboseHistory(sansFor(["e4"]));
    const long = classifyOpeningFromVerboseHistory(
      sansFor(["e4", "e5", "Nf3", "Nc6", "Bb5"])
    );
    expect(short).not.toBeNull();
    expect(long).not.toBeNull();
    expect(long!.name).not.toBe(short!.name);
  });
});

describe("fenForOpening", () => {
  it("returns null for an unknown opening", () => {
    expect(fenForOpening(undefined, "Total Nonsense Opening 9000")).toBeNull();
  });

  it("returns a valid 6-field FEN for an opening derived via classify", () => {
    const hit = classifyOpeningFromVerboseHistory(sansFor(["e4", "e5"]));
    expect(hit).not.toBeNull();
    const fen = fenForOpening(hit!.eco, hit!.name);
    expect(fen).not.toBeNull();
    expect(fen!.split(" ")).toHaveLength(6);
  });
});

describe("resolveOpeningFromLoadedGame", () => {
  it("prefers the lichess-book hit over hints", () => {
    const out = resolveOpeningFromLoadedGame(sansFor(["e4", "e5"]), {
      eco: "Z99",
      name: "Some Custom Hint",
    });
    expect(out).toBeDefined();
    expect(out!.eco).not.toBe("Z99");
  });

  it("falls back to hints when no prefix matches", () => {
    const out = resolveOpeningFromLoadedGame([], {
      eco: "Z99",
      name: "Some Custom Hint",
    });
    expect(out).toEqual({ eco: "Z99", name: "Some Custom Hint" });
  });

  it("returns undefined when neither classify nor hints yield anything", () => {
    expect(resolveOpeningFromLoadedGame([], undefined)).toBeUndefined();
    expect(resolveOpeningFromLoadedGame([], {})).toBeUndefined();
  });
});
