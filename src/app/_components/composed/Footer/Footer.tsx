export default function Footer() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full text-center py-4 border-solid border-t-2 border-[var(--foreground)] text-sm">
      <span>
        Data:{" "}
        <a
          href="https://www.chess.com/news/view/published-data-api"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          Chess.com PubAPI
        </a>
        {" · "}
        <a
          href="https://lichess.org/api"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          Lichess API
        </a>
      </span>
      <span>Chess Playstyle Analyser</span>
      <span>
        <a
          href="https://github.com/AlphaAnimal"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          GitHub
        </a>
      </span>
    </div>
  );
}
