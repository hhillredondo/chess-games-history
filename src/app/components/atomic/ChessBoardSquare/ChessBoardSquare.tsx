import Image from "next/image";

export interface IChessSquareProps {
  colour: ChessSquareColour;
  pieceIcon: string;
}

export type ChessSquareColour = "black" | "white";

export default function ChessBoardSquare(props: Readonly<IChessSquareProps>) {
  const { colour, pieceIcon } = props;

  const backgroundColour =
    colour === "black" ? "bg-[var(--background)]" : "bg-[var(--foreground)]";

  return (
    <div className={"w-12 h-12 place-items-center" + backgroundColour}>
      <Image src="/bb.png" alt="My Icon" width={24} height={24} />
    </div>
  );
}
