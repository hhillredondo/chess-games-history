import { getPiecesPlacementFromFEN } from "@/app/core/fenInterpreter";
import ChessBoardSquare from "../../atomic/ChessBoardSquare/ChessBoardSquare";

export interface IChessBoardProps {
  position: string;
}

export default function ChessBoard(props: Readonly<IChessBoardProps>) {
  const { position } = props;
  console.log("position: ", position);

  const squares: JSX.Element[] = [];
  const chessPieces = getPiecesPlacementFromFEN(position);

  for (let i = 0; i < 64; i++) {
    const row = Math.floor(i / 8);
    const col = i % 8;

    const color = (row + col) % 2 === 0 ? "light" : "dark";
    const pieceIcon = chessPieces.hasOwnProperty(i) ? chessPieces[i] : "";

    squares.push(
      <ChessBoardSquare key={i} colour={color} pieceIcon={pieceIcon} />
    );
  }

  return (
    <div className="grid grid-cols-8 w-fit border-solid border-2 border-[-var(--foreground)]">
      {squares}
    </div>
  );
}
