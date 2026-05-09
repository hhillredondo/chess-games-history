import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";

import {
  clocksAtEachPly,
  extractTimeControlFromPgn,
  formatWallClockDuration,
  parseClkStringsFromPgn,
} from "@/lib/pgn/clock-info";

import { PGN_WITH_CLOCKS } from "../../fixtures/pgns";

describe("extractTimeControlFromPgn", () => {
  it("extracts the TimeControl value", () => {
    expect(extractTimeControlFromPgn(PGN_WITH_CLOCKS)).toBe("180+2");
  });

  it("returns undefined when missing", () => {
    expect(extractTimeControlFromPgn("[Event \"?\"]\n\n*\n")).toBeUndefined();
  });

  it("returns undefined for an empty TimeControl tag", () => {
    expect(extractTimeControlFromPgn('[TimeControl ""]\n')).toBeUndefined();
  });
});

describe("parseClkStringsFromPgn", () => {
  it("returns each %clk value in PGN order", () => {
    expect(parseClkStringsFromPgn(PGN_WITH_CLOCKS)).toEqual([
      "0:03:00",
      "0:03:00",
      "0:02:58",
      "0:02:59",
      "0:02:55",
    ]);
  });

  it("returns an empty array when no %clk annotations exist", () => {
    expect(parseClkStringsFromPgn("1. e4 e5 *")).toEqual([]);
  });
});

describe("clocksAtEachPly", () => {
  it("produces N+1 entries for N half-moves and tracks last-known clock per side", () => {
    const chess = new Chess();
    chess.loadPgn(PGN_WITH_CLOCKS, { newlineChar: "\n" });
    const hist = chess.history({ verbose: true });
    const pairs = clocksAtEachPly(PGN_WITH_CLOCKS, hist);

    expect(pairs).toHaveLength(hist.length + 1);
    expect(pairs[0]).toEqual({ white: null, black: null });
    expect(pairs.at(-1)).toEqual({ white: "0:02:55", black: "0:02:59" });
  });
});

describe("formatWallClockDuration", () => {
  it("returns seconds-only format for sub-minute durations", () => {
    expect(
      formatWallClockDuration(
        "2026-01-01T12:00:00.000Z",
        "2026-01-01T12:00:42.000Z"
      )
    ).toBe("42s");
  });

  it("returns minutes-and-seconds for sub-hour durations", () => {
    expect(
      formatWallClockDuration(
        "2026-01-01T12:00:00.000Z",
        "2026-01-01T12:05:30.000Z"
      )
    ).toBe("5m 30s");
  });

  it("returns hours-and-minutes for multi-hour durations", () => {
    expect(
      formatWallClockDuration(
        "2026-01-01T12:00:00.000Z",
        "2026-01-01T14:30:00.000Z"
      )
    ).toBe("2h 30m");
  });

  it("returns em-dash for inverted or invalid timestamps", () => {
    expect(
      formatWallClockDuration(
        "2026-01-01T12:05:00.000Z",
        "2026-01-01T12:00:00.000Z"
      )
    ).toBe("—");
    expect(formatWallClockDuration("not-a-date", "also-not")).toBe("—");
  });
});
