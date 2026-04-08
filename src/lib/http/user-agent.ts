/** Identifies this app when calling Chess.com / Lichess public APIs. */
export const PUBLIC_API_USER_AGENT =
  "ChessGamesHistory/1.0 (+https://github.com/AlphaAnimal/chess-games-history)";

export function publicApiHeaders(init?: HeadersInit): Headers {
  const h = new Headers(init);
  h.set("User-Agent", PUBLIC_API_USER_AGENT);
  if (!h.has("Accept")) {
    h.set("Accept", "*/*");
  }
  return h;
}
