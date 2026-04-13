import { terminationBucketForGame } from "@/lib/filters/game-filters";
import type { UnifiedGame } from "@/lib/types/unified-game";

/* ── Material helpers (cheap FEN scan, no chess.js) ──────────────────── */

type MaterialBucket = "ahead" | "equal" | "behind";

function materialDiffFromFen(fen: string, userColor: "white" | "black"): number {
  const placement = fen.split(" ")[0] ?? "";
  const VALUES: Record<string, number> = {
    P: 1, N: 3, B: 3, R: 5, Q: 9,
    p: 1, n: 3, b: 3, r: 5, q: 9,
  };
  let white = 0;
  let black = 0;
  for (const ch of placement) {
    const v = VALUES[ch];
    if (v == null) continue;
    if (ch === ch.toUpperCase()) white += v;
    else black += v;
  }
  const diff = white - black;
  return userColor === "white" ? diff : -diff;
}

function toMaterialBucket(diff: number): MaterialBucket {
  if (diff > 0) return "ahead";
  if (diff < 0) return "behind";
  return "equal";
}

/* ── Types ───────────────────────────────────────────────────────────── */

export interface MaterialBreakdown {
  ahead: number;
  equal: number;
  behind: number;
  total: number;
}

export interface LongestBreak {
  days: number;
  from: Date;
  to: Date;
}

export interface GameInsights {
  longestBreak: LongestBreak | null;
  avgMovesPerGame: number;
  resignMaterial: MaterialBreakdown;
  drawMaterial: MaterialBreakdown;
}

/* ── Computation (single pass where possible) ────────────────────────── */

export function computeGameInsights(games: UnifiedGame[]): GameInsights {
  const resignMaterial: MaterialBreakdown = { ahead: 0, equal: 0, behind: 0, total: 0 };
  const drawMaterial: MaterialBreakdown = { ahead: 0, equal: 0, behind: 0, total: 0 };
  let totalPly = 0;

  for (const g of games) {
    totalPly += g.plyCount;

    if (!g.finalFen) continue;

    // Resign material analysis
    if (
      (g.result === "win" || g.result === "loss") &&
      terminationBucketForGame(g) === "resign"
    ) {
      const bucket = toMaterialBucket(materialDiffFromFen(g.finalFen, g.userColor));
      resignMaterial[bucket]++;
      resignMaterial.total++;
    }

    // Draw material analysis
    if (g.result === "draw") {
      const bucket = toMaterialBucket(materialDiffFromFen(g.finalFen, g.userColor));
      drawMaterial[bucket]++;
      drawMaterial.total++;
    }
  }

  // Longest break — games are expected to be sorted ascending by date
  let longestBreak: LongestBreak | null = null;
  if (games.length >= 2) {
    for (let i = 1; i < games.length; i++) {
      const prev = new Date(games[i - 1]!.endAt).getTime();
      const curr = new Date(games[i]!.endAt).getTime();
      const diffMs = curr - prev;
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (!longestBreak || diffDays > longestBreak.days) {
        longestBreak = {
          days: diffDays,
          from: new Date(prev),
          to: new Date(curr),
        };
      }
    }
  }

  return {
    longestBreak,
    avgMovesPerGame: games.length > 0 ? totalPly / games.length / 2 : 0,
    resignMaterial,
    drawMaterial,
  };
}
