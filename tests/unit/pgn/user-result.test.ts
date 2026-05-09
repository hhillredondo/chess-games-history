import { describe, expect, it } from "vitest";

import { resultFromPgnHeaders } from "@/lib/pgn/user-result";

describe("resultFromPgnHeaders", () => {
  it("returns null when the user is not in either player slot", () => {
    expect(
      resultFromPgnHeaders("alice", "bob", "carol", "1-0")
    ).toBeNull();
  });

  it("identifies the user as White and maps 1-0 to a win", () => {
    expect(
      resultFromPgnHeaders("alice", "bob", "alice", "1-0")
    ).toEqual({ userColor: "white", result: "win" });
  });

  it("identifies the user as Black and maps 1-0 to a loss", () => {
    expect(
      resultFromPgnHeaders("alice", "bob", "bob", "1-0")
    ).toEqual({ userColor: "black", result: "loss" });
  });

  it("maps 0-1 correctly for both colours", () => {
    expect(
      resultFromPgnHeaders("alice", "bob", "alice", "0-1")
    ).toEqual({ userColor: "white", result: "loss" });
    expect(
      resultFromPgnHeaders("alice", "bob", "bob", "0-1")
    ).toEqual({ userColor: "black", result: "win" });
  });

  it("maps both draw notations to draw", () => {
    expect(
      resultFromPgnHeaders("alice", "bob", "alice", "1/2-1/2")?.result
    ).toBe("draw");
    expect(
      resultFromPgnHeaders("alice", "bob", "alice", "½-½")?.result
    ).toBe("draw");
  });

  it("falls back to unknown for an in-progress or missing result", () => {
    expect(
      resultFromPgnHeaders("alice", "bob", "alice", "*")?.result
    ).toBe("unknown");
    expect(
      resultFromPgnHeaders("alice", "bob", "alice", undefined)?.result
    ).toBe("unknown");
  });

  it("matches usernames case-insensitively and trims whitespace", () => {
    expect(
      resultFromPgnHeaders("  ALICE ", "bob", "alice", "1-0")?.userColor
    ).toBe("white");
  });
});
