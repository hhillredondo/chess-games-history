import { describe, expect, it } from "vitest";

import {
  applyFilters,
  deriveFilterOptions,
  fullMoveCount,
  isFilterActive,
  opponentName,
  opponentRating,
  terminationBucketForGame,
  timeControlCategory,
  userRating,
  wallClockMinutes,
} from "@/lib/filters/game-filters";

import { makeGame, nextId } from "../../fixtures/games";

describe("timeControlCategory", () => {
  it("returns unknown for missing or '-' input", () => {
    expect(timeControlCategory(undefined)).toBe("unknown");
    expect(timeControlCategory("")).toBe("unknown");
    expect(timeControlCategory("-")).toBe("unknown");
  });

  it("classifies live time controls by base + 40·increment formula", () => {
    expect(timeControlCategory("60+0")).toBe("bullet"); // 60s
    expect(timeControlCategory("180+2")).toBe("blitz"); // 260s
    expect(timeControlCategory("600+5")).toBe("rapid"); // 800s
    expect(timeControlCategory("1800+10")).toBe("classical"); // 2200s
  });

  it("classifies daily/correspondence by 1/N format", () => {
    expect(timeControlCategory("1/86400")).toBe("correspondence");
  });

  it("returns unknown for malformed strings", () => {
    expect(timeControlCategory("nope")).toBe("unknown");
  });
});

describe("terminationBucketForGame", () => {
  it("matches resignation hints in the termination string", () => {
    const g = makeGame({
      id: nextId("tb-resign"),
      termination: "alice won by resignation",
      result: "win",
    });
    expect(terminationBucketForGame(g)).toBe("resign");
  });

  it("detects timeout from various phrasings", () => {
    expect(
      terminationBucketForGame(
        makeGame({ id: nextId("tb-t1"), termination: "Time forfeit", result: "loss" })
      )
    ).toBe("timeout");
    expect(
      terminationBucketForGame(
        makeGame({ id: nextId("tb-t2"), termination: "won on time", result: "win" })
      )
    ).toBe("timeout");
  });

  it("falls back to unknown when no signal exists", () => {
    expect(
      terminationBucketForGame(
        makeGame({
          id: nextId("tb-unk"),
          termination: undefined,
          result: "unknown",
          finalFen: "8/8/8/8/8/8/8/8 w - - 0 1", // empty board, parse may fail
        })
      )
    ).toBe("unknown");
  });
});

describe("isFilterActive", () => {
  it("is false for an empty filter", () => {
    expect(isFilterActive({})).toBe(false);
  });

  it("is true when any filter property is set", () => {
    expect(isFilterActive({ color: "white" })).toBe(true);
    expect(isFilterActive({ results: ["win"] })).toBe(true);
    expect(isFilterActive({ eloDiffMin: 100 })).toBe(true);
    expect(isFilterActive({ opening: "  sicilian  " })).toBe(true);
  });

  it("treats whitespace-only strings as inactive", () => {
    expect(isFilterActive({ opening: "   ", opponent: "" })).toBe(false);
  });
});

describe("applyFilters", () => {
  const games = [
    makeGame({
      source: "chesscom",
      userColor: "white",
      result: "win",
      timeControl: "180+2",
      whiteRating: 1600,
      blackRating: 1500,
      endAt: "2026-01-01T12:00:00.000Z",
      opening: { eco: "B20", name: "Sicilian Defense" },
    }),
    makeGame({
      source: "lichess",
      userColor: "black",
      result: "loss",
      timeControl: "60+0",
      whiteRating: 1500,
      blackRating: 1400,
      endAt: "2026-02-01T12:00:00.000Z",
      opening: { eco: "C20", name: "King's Pawn" },
    }),
    makeGame({
      source: "chesscom",
      userColor: "white",
      result: "draw",
      timeControl: "600+5",
      endAt: "2026-03-01T12:00:00.000Z",
      opening: { eco: "B20", name: "Sicilian Najdorf" },
    }),
  ];

  it("returns the input unchanged when no filter is active", () => {
    expect(applyFilters(games, {})).toBe(games);
  });

  it("filters by source", () => {
    expect(applyFilters(games, { sources: ["lichess"] })).toHaveLength(1);
  });

  it("filters by time control category", () => {
    expect(applyFilters(games, { timeControls: ["bullet"] })).toHaveLength(1);
    expect(applyFilters(games, { timeControls: ["blitz", "rapid"] })).toHaveLength(2);
  });

  it("filters by date range (inclusive on both ends)", () => {
    const out = applyFilters(games, {
      dateFrom: "2026-02-01",
      dateUntil: "2026-02-28",
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.source).toBe("lichess");
  });

  it("filters by opening substring (case-insensitive)", () => {
    expect(applyFilters(games, { opening: "sicilian" })).toHaveLength(2);
    expect(applyFilters(games, { opening: "najdorf" })).toHaveLength(1);
  });

  it("filters by Elo diff range", () => {
    // Game 1: user (white) 1600 vs opp 1500 → +100
    // Game 2: user (black) 1400 vs opp 1500 → -100
    // Game 3: factory defaults 1500/1500 → 0
    expect(applyFilters(games, { eloDiffMin: 50 })).toHaveLength(1);
    expect(applyFilters(games, { eloDiffMax: -50 })).toHaveLength(1);
  });
});

describe("game-level helpers", () => {
  const g = makeGame({
    userColor: "black",
    whiteName: "alice",
    blackName: "bob",
    whiteRating: 1700,
    blackRating: 1600,
    plyCount: 41,
    playedAt: "2026-01-01T12:00:00.000Z",
    endAt: "2026-01-01T12:07:30.000Z",
  });

  it("returns user/opponent rating from the right colour", () => {
    expect(userRating(g)).toBe(1600);
    expect(opponentRating(g)).toBe(1700);
  });

  it("returns the opponent name for the user's colour", () => {
    expect(opponentName(g)).toBe("alice");
  });

  it("computes full moves from ply count (rounded up)", () => {
    expect(fullMoveCount(g)).toBe(21); // ceil(41/2)
  });

  it("computes wall-clock minutes", () => {
    expect(wallClockMinutes(g)).toBe(7.5);
  });

  it("returns null for inverted timestamps", () => {
    expect(
      wallClockMinutes(
        makeGame({
          playedAt: "2026-01-01T12:10:00.000Z",
          endAt: "2026-01-01T12:00:00.000Z",
        })
      )
    ).toBeNull();
  });
});

describe("deriveFilterOptions", () => {
  it("returns empty/sentinel options for empty input", () => {
    const o = deriveFilterOptions([]);
    expect(o.sources).toEqual([]);
    expect(o.minDate).toBeNull();
    expect(o.maxDate).toBeNull();
    expect(o.minutesFilterAvailable).toBe(false);
  });

  it("collects unique time-control categories, sources, and a date span", () => {
    const games = [
      makeGame({ source: "chesscom", timeControl: "60+0", endAt: "2025-01-01T00:00:00.000Z" }),
      makeGame({ source: "lichess", timeControl: "1/86400", endAt: "2026-06-15T00:00:00.000Z" }),
    ];
    const o = deriveFilterOptions(games);
    expect(o.sources).toContain("chesscom");
    expect(o.sources).toContain("lichess");
    expect(o.timeControls).toContain("bullet");
    expect(o.timeControls).toContain("correspondence");
    expect(o.minDate).toBe("2025-01-01");
    expect(o.maxDate).toBe("2026-06-15");
    expect(o.minutesFilterAvailable).toBe(true); // at least one non-correspondence
  });
});
