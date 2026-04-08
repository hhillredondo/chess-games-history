import type { Color, PieceSymbol } from "chess.js";
import Image from "next/image";

export interface IChessSquareProps {
  colour: ChessSquareColour;
  piece: { color: Color; type: PieceSymbol } | null;
  /** Smaller cells for dense layouts (e.g. game lists). */
  compact?: boolean;
  /** Fills one cell of a fixed aspect-square 8×8 grid (replay modal). */
  large?: boolean;
}

export type ChessSquareColour = "dark" | "light";

function pieceSrc(color: Color, type: PieceSymbol): string {
  return `/${color}${type}.png`;
}

export default function ChessBoardSquare(props: Readonly<IChessSquareProps>) {
  const { colour, piece, compact, large } = props;

  const backgroundColour =
    colour === "dark" ? "bg-[var(--background)]" : "bg-[var(--foreground)]";

  const sizeClass = large
    ? "relative min-h-0 min-w-0 h-full w-full"
    : compact
      ? "size-10 sm:size-10"
      : "size-10 sm:size-12";

  return (
    <div
      className={`flex select-none items-center justify-center overflow-hidden ${sizeClass} ${backgroundColour}`}
    >
      {piece != null && !large && (
        <Image
          src={pieceSrc(piece.color, piece.type)}
          alt=""
          width={64}
          height={64}
          draggable={false}
          className="pointer-events-none h-[88%] w-[88%] object-contain"
        />
      )}
      {piece != null && large && (
        <Image
          src={pieceSrc(piece.color, piece.type)}
          alt=""
          fill
          draggable={false}
          sizes="(max-width: 640px) 12vw, (max-width: 1024px) 9vw, 128px"
          className="pointer-events-none object-contain p-[5%]"
        />
      )}
    </div>
  );
}
