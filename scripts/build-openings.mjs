/**
 * Merges lichess-org/chess-openings TSV snapshots into a compact JSON file
 * consumed by src/lib/openings/classify.ts (longest-prefix SAN trie).
 *
 * Source: https://github.com/lichess-org/chess-openings (CC0-1.0)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dataDir = path.join(root, "src/lib/openings/data");
const outFile = path.join(root, "src/lib/openings/lichess-openings.json");

const FILES = ["a.tsv", "b.tsv", "c.tsv", "d.tsv", "e.tsv"];

function tokenizeMoveLine(moveText) {
  return moveText
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0 && !/^\d+\.?$/.test(t));
}

const rows = [];
for (const file of FILES) {
  const text = fs.readFileSync(path.join(dataDir, file), "utf8");
  const lines = text.split(/\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || i === 0) continue;
    const tab = line.indexOf("\t");
    if (tab < 0) continue;
    const eco = line.slice(0, tab).trim();
    const rest = line.slice(tab + 1);
    const tab2 = rest.indexOf("\t");
    if (tab2 < 0) continue;
    const name = rest.slice(0, tab2).trim();
    const pgnMoves = rest.slice(tab2 + 1).trim();
    if (!eco || !name || !pgnMoves) continue;
    const moves = tokenizeMoveLine(pgnMoves);
    if (moves.length === 0) continue;
    rows.push({ e: eco, n: name, m: moves });
  }
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(rows), "utf8");
console.log(`Wrote ${rows.length} openings → ${path.relative(root, outFile)}`);
