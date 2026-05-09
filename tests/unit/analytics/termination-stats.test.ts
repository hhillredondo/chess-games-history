import { describe, expect, it } from "vitest";

import { computeTerminationStats } from "@/lib/analytics/termination-stats";

import { makeGame, nextId } from "../../fixtures/games";

const SCHOLARS_MATE_FEN =
  "r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4";

describe("computeTerminationStats", () => {
  it("returns an empty array for no games", () => {
    expect(computeTerminationStats([])).toEqual([]);
  });

  it("buckets games by termination string", () => {
    const games = [
      makeGame({
        id: nextId("term-timeout"),
        termination: "alice won on time",
        result: "win",
      }),
      makeGame({
        id: nextId("term-timeout"),
        termination: "Time forfeit",
        result: "loss",
      }),
      makeGame({
        id: nextId("term-resign"),
        termination: "won by resignation",
        result: "win",
      }),
    ];
    const out = computeTerminationStats(games);
    const buckets = Object.fromEntries(out.map((r) => [r.bucket, r]));
    expect(buckets.timeout).toBeDefined();
    expect(buckets.timeout!.total).toBe(2);
    expect(buckets.timeout!.wins).toBe(1);
    expect(buckets.timeout!.losses).toBe(1);
    expect(buckets.resign).toBeDefined();
    expect(buckets.resign!.total).toBe(1);
  });

  it("uses final-position FEN to detect checkmate when termination is ambiguous", () => {
    const game = makeGame({
      id: nextId("term-mate"),
      termination: "Normal",
      finalFen: SCHOLARS_MATE_FEN,
      result: "win",
    });
    const out = computeTerminationStats([game]);
    expect(out).toHaveLength(1);
    expect(out[0]!.bucket).toBe("checkmate");
  });

  it("sorts results by descending total count", () => {
    const games = [
      ...Array(3)
        .fill(0)
        .map(() =>
          makeGame({
            id: nextId("term-resign"),
            termination: "resignation",
            result: "win",
          })
        ),
      makeGame({
        id: nextId("term-timeout"),
        termination: "time forfeit",
        result: "loss",
      }),
    ];
    const out = computeTerminationStats(games);
    expect(out[0]!.bucket).toBe("resign");
    expect(out[1]!.bucket).toBe("timeout");
  });
});
