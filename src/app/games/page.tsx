import ChessBoard from "../_components/composed/ChessBoard/ChessBoard.client";

// Games page
export default function Games() {
  // Replace with chessboards
  const items = [1, 2, 3, 4, 5, 6];
  return (
    <div className="grid grid-cols-3 w-full items-center gap-20 p-8">
      {items.map((item: number) => (
        <ChessBoard key={item} position={"123231323131"} />
      ))}
    </div>
  );
}
