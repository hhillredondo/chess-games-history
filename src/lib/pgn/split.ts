/** Split a file or blob that may contain multiple PGN games. */
export function splitPgnGames(blob: string): string[] {
  const t = blob.trim();
  if (!t) return [];

  const parts = t.split(/\n\n(?=\[)/);
  const out = parts.map((p) => p.trim()).filter(Boolean);
  return out.length > 0 ? out : [t];
}
