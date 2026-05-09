import { describe, expect, it } from "vitest";

import { computeTimeOfDayStats } from "@/lib/analytics/time-of-day";

import { makeGame } from "../../fixtures/games";

// These tests rely on TZ=UTC (set in the npm script). All endAt values are
// interpreted in UTC because of that.

describe("computeTimeOfDayStats", () => {
  it("returns four buckets even when input is empty", () => {
    const rows = computeTimeOfDayStats([]);
    expect(rows.map((r) => r.id)).toEqual([
      "morning",
      "afternoon",
      "evening",
      "night",
    ]);
    expect(rows.every((r) => r.games === 0 && r.winRate === null)).toBe(true);
  });

  it("places games in the correct bucket based on local hour", () => {
    const games = [
      makeGame({ endAt: "2026-01-01T08:00:00.000Z", result: "win" }), // morning
      makeGame({ endAt: "2026-01-01T13:00:00.000Z", result: "loss" }), // afternoon
      makeGame({ endAt: "2026-01-01T19:00:00.000Z", result: "win" }), // evening
      makeGame({ endAt: "2026-01-01T19:30:00.000Z", result: "draw" }), // evening
      makeGame({ endAt: "2026-01-01T03:00:00.000Z", result: "loss" }), // night
    ];
    const rows = computeTimeOfDayStats(games);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId.morning!.games).toBe(1);
    expect(byId.afternoon!.games).toBe(1);
    expect(byId.evening!.games).toBe(2);
    expect(byId.night!.games).toBe(1);
    // Evening: 1 win + 1 draw → (1 + 0.5) / 2 = 0.75
    expect(byId.evening!.winRate).toBeCloseTo(0.75, 4);
  });

  it("respects bucket boundaries (6, 12, 18)", () => {
    const games = [
      makeGame({ endAt: "2026-01-01T06:00:00.000Z" }), // morning starts at 6
      makeGame({ endAt: "2026-01-01T11:59:59.999Z" }), // still morning
      makeGame({ endAt: "2026-01-01T12:00:00.000Z" }), // afternoon starts at 12
      makeGame({ endAt: "2026-01-01T18:00:00.000Z" }), // evening starts at 18
      makeGame({ endAt: "2026-01-01T05:59:59.999Z" }), // night
    ];
    const rows = computeTimeOfDayStats(games);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId.morning!.games).toBe(2);
    expect(byId.afternoon!.games).toBe(1);
    expect(byId.evening!.games).toBe(1);
    expect(byId.night!.games).toBe(1);
  });
});
