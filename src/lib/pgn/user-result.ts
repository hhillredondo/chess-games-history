import type { UserResult } from "@/lib/types/unified-game";

function normalizeName(s: string): string {
  return s.trim().toLowerCase();
}

/** Map PGN [Result "…"] to outcome for the given player color. */
export function resultFromPgnHeaders(
  whiteName: string,
  blackName: string,
  userUsername: string,
  resultTag: string | undefined
): { userColor: "white" | "black"; result: UserResult } | null {
  const u = normalizeName(userUsername);
  const w = normalizeName(whiteName);
  const b = normalizeName(blackName);

  let userColor: "white" | "black";
  if (u === w) userColor = "white";
  else if (u === b) userColor = "black";
  else return null;

  const r = (resultTag ?? "*").trim();

  let outcome: UserResult = "unknown";
  if (r === "1-0") outcome = userColor === "white" ? "win" : "loss";
  else if (r === "0-1") outcome = userColor === "black" ? "win" : "loss";
  else if (r === "1/2-1/2" || r === "½-½") outcome = "draw";

  return { userColor, result: outcome };
}
