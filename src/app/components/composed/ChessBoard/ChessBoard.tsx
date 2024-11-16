import ChessBoardSquare from "../../atomic/ChessBoardSquare/ChessBoardSquare";

export interface IChessBoardProps {
  position: string;
}

export default function ChessBoard(props: Readonly<IChessBoardProps>) {
  const { position } = props;
  console.log("position: ", position);

  const squares: JSX.Element[] = [];
  for (let i = 0; i < 64; i++) {
    squares.push(
      <ChessBoardSquare
        key={i}
        colour={i % 2 === 0 ? "white" : "black"}
        pieceIcon="bb.png"
      />
    );
  }

  return <div className="grid grid-cols-8 w-full">{squares}</div>;
}
