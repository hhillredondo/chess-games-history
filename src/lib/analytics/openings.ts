import type { UnifiedGame } from "@/lib/types/unified-game";

export interface OpeningEntry {
  key: string;
  eco?: string;
  name: string;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  avgMoves: number;
}

export interface OpeningStats {
  asWhite: OpeningEntry[];
  asBlack: OpeningEntry[];
}

export function aggregateOpenings(
  games: UnifiedGame[],
  minGames = 3
): OpeningStats {
  function build(color: "white" | "black"): OpeningEntry[] {
    const map = new Map<string, OpeningEntry & { _totalPly: number }>();
    for (const g of games) {
      if (g.userColor !== color) continue;
      const eco = g.opening?.eco;
      const rawName = g.opening?.name ?? "Unknown";
      const key = eco ? `${eco}: ${rawName}` : rawName;
      if (!map.has(key)) {
        map.set(key, {
          key,
          eco,
          name: rawName,
          games: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          winRate: 0,
          avgMoves: 0,
          _totalPly: 0,
        });
      }
      const e = map.get(key)!;
      e.games++;
      e._totalPly += g.plyCount;
      if (g.result === "win") e.wins++;
      else if (g.result === "loss") e.losses++;
      else if (g.result === "draw") e.draws++;
    }
    return [...map.values()]
      .filter((e) => e.games >= minGames)
      .map(({ _totalPly, ...e }) => ({
        ...e,
        winRate: e.wins / e.games,
        avgMoves: Math.round(_totalPly / e.games / 2),
      }))
      .sort((a, b) => b.games - a.games);
  }

  return { asWhite: build("white"), asBlack: build("black") };
}
