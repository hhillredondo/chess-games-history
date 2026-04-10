import type { Move } from "chess.js";

import openingsData from "./lichess-openings.json";

/**
 * Opening names / ECO codes from lichess-org/chess-openings (CC0-1.0).
 * @see https://github.com/lichess-org/chess-openings
 */

type OpeningRow = { e: string; n: string; m: string[] };

interface TrieNode {
  children: Map<string, TrieNode>;
  opening?: { eco: string; name: string };
}

let trieRoot: TrieNode | null = null;

function buildTrie(): TrieNode {
  const root: TrieNode = { children: new Map() };
  for (const row of openingsData as OpeningRow[]) {
    let n = root;
    for (const mv of row.m) {
      let next = n.children.get(mv);
      if (!next) {
        next = { children: new Map() };
        n.children.set(mv, next);
      }
      n = next;
    }
    n.opening = { eco: row.e, name: row.n };
  }
  return root;
}

function getTrieRoot(): TrieNode {
  if (!trieRoot) trieRoot = buildTrie();
  return trieRoot;
}

/** Longest-prefix match using SANs from an already-loaded game (avoids a second `loadPgn`). */
export function classifyOpeningFromVerboseHistory(
  hist: readonly Pick<Move, "san">[]
): { eco: string; name: string } | null {
  if (hist.length === 0) return null;
  const root = getTrieRoot();
  let n = root;
  let last: { eco: string; name: string } | undefined;
  for (const move of hist) {
    const next = n.children.get(move.san);
    if (!next) break;
    n = next;
    if (next.opening) last = next.opening;
  }
  return last ?? null;
}

/**
 * Prefer Lichess-book classification; fall back to PGN / API hints when no prefix matches
 * (variants, transpositions, or very new lines).
 */
export function resolveOpeningFromLoadedGame(
  hist: readonly Pick<Move, "san">[],
  hints?: { eco?: string; name?: string }
): { eco?: string; name?: string } | undefined {
  const hit = classifyOpeningFromVerboseHistory(hist);
  if (hit) return { eco: hit.eco, name: hit.name };
  const eco = hints?.eco?.trim();
  const name = hints?.name?.trim();
  if (!eco && !name) return undefined;
  return {
    ...(eco ? { eco } : {}),
    ...(name ? { name } : {}),
  };
}
