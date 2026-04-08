"use client";

import { chessFromFen } from "@/app/core/fenInterpreter";
import ChessBoardSquare from "../../atomic/ChessBoardSquare/ChessBoardSquare";

export interface IChessBoardProps {
  position: string;
  /** Smaller board for lists so text + board don’t collide in narrow columns. */
  compact?: boolean;
  /** Black’s view: ranks/files flipped. */
  orientation?: "white" | "black";
  /** Large responsive board (~2× default) for replay modal. */
  large?: boolean;
}

export default function ChessBoard(props: Readonly<IChessBoardProps>) {
  const { position, compact, orientation = "white", large } = props;

  const chess = chessFromFen(position);
  const board = chess?.board() ?? null;

  const squares: React.ReactNode[] = [];

  for (let i = 0; i < 64; i++) {
    const row = Math.floor(i / 8);
    const col = i % 8;
    const color = (row + col) % 2 === 0 ? "light" : "dark";
    const br = orientation === "black" ? 7 - row : row;
    const bc = orientation === "black" ? 7 - col : col;
    const cell = board ? board[br]?.[bc] : null;
    const piece = cell ? { color: cell.color, type: cell.type } : null;

    squares.push(
      <ChessBoardSquare
        key={i}
        colour={color}
        piece={piece}
        compact={compact}
        large={large}
      />
    );
  }

  if (large) {
    /** Side length capped so board + modal chrome fits in viewport without scrolling. */
    return (
      <div className="aspect-square w-[min(90vw,48rem,calc(100dvh-17rem))] max-w-full shrink-0 border-2 border-solid border-[var(--foreground)]">
        <div className="grid h-full w-full grid-cols-8 grid-rows-8">{squares}</div>
      </div>
    );
  }

  return (
    <div className="grid w-fit shrink-0 grid-cols-8 border-2 border-solid border-[var(--foreground)]">
      {squares}
    </div>
  );
}
