import { describe, expect, it } from "vitest";

import {
  clockStringToMs,
  computeQuickStats,
  formatClockMs,
} from "@/lib/analytics/quick-stats";

import { makeGame } from "../../fixtures/games";

describe("clockStringToMs", () => {
  it("parses H:MM:SS to milliseconds", () => {
    expect(clockStringToMs("0:03:00")).toBe(3 * 60 * 1000);
    expect(clockStringToMs("1:00:00")).toBe(60 * 60 * 1000);
  });

  it("parses MM:SS and SS forms", () => {
    expect(clockStringToMs("2:30")).toBe((2 * 60 + 30) * 1000);
    expect(clockStringToMs("45")).toBe(45 * 1000);
    expect(clockStringToMs("12.3")).toBe(12_300);
  });

  it("returns null for null/empty/garbage input", () => {
    expect(clockStringToMs(undefined)).toBeNull();
    expect(clockStringToMs("")).toBeNull();
    expect(clockStringToMs("not:a:clock")).toBeNull();
    expect(clockStringToMs("-1:00")).toBeNull();
  });
});

describe("formatClockMs", () => {
  it("formats hours, minutes, and seconds", () => {
    expect(formatClockMs(3_600_000)).toBe("1h 0m");
    expect(formatClockMs(150_000)).toBe("2m 30s");
    expect(formatClockMs(45_000)).toBe("45s");
  });

  it("uses em-dash for null", () => {
    expect(formatClockMs(null)).toBe("—");
  });
});

describe("computeQuickStats", () => {
  it("returns zeros and null win rate on empty input", () => {
    expect(computeQuickStats([])).toEqual({
      count: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      unknownResults: 0,
      winRate: null,
      userAvgClockMs: null,
      opponentAvgClockMs: null,
      clockCoverageCount: 0,
      clockCoverageDenominator: 0,
    });
  });

  it("counts results and computes win rate over decided games", () => {
    const games = [
      makeGame({ result: "win" }),
      makeGame({ result: "win" }),
      makeGame({ result: "win" }),
      makeGame({ result: "loss" }),
      makeGame({ result: "draw" }),
      makeGame({ result: "unknown" }),
    ];
    const s = computeQuickStats(games);
    expect(s.count).toBe(6);
    expect(s.wins).toBe(3);
    expect(s.losses).toBe(1);
    expect(s.draws).toBe(1);
    expect(s.unknownResults).toBe(1);
    // (3 + 0.5) / 5 = 0.7
    expect(s.winRate).toBeCloseTo(0.7, 4);
  });

  it("averages remaining clock for live games and skips correspondence", () => {
    const liveWhite = makeGame({
      userColor: "white",
      timeControl: "180+2",
      endClockWhite: "0:01:00", // 60s
      endClockBlack: "0:02:00", // 120s
    });
    const liveBlack = makeGame({
      userColor: "black",
      timeControl: "180+2",
      endClockWhite: "0:00:30", // 30s opponent
      endClockBlack: "0:01:00", // 60s user
    });
    const correspondence = makeGame({
      timeControl: "1/259200",
      endClockWhite: "0:01:00",
      endClockBlack: "0:01:00",
    });
    const s = computeQuickStats([liveWhite, liveBlack, correspondence]);
    expect(s.clockCoverageCount).toBe(2);
    expect(s.clockCoverageDenominator).toBe(2);
    expect(s.userAvgClockMs).toBe(60_000); // both users had 60s
    expect(s.opponentAvgClockMs).toBe(75_000); // (120 + 30) / 2 = 75s
  });
});
