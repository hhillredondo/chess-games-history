import Image from "next/image";

export interface IChessSquareProps {
  colour: ChessSquareColour;
  pieceIcon: string;
}

export type ChessSquareColour = "dark" | "light";

export default function ChessBoardSquare(props: Readonly<IChessSquareProps>) {
  const { colour, pieceIcon } = props;

  const backgroundColour =
    colour === "dark" ? "bg-[var(--background)]" : "bg-[var(--foreground)]";

  return (
    <div className={"flex w-12 h-12 place-items-center " + backgroundColour}>
      <Image src={pieceIcon} alt="My Icon" width={32} height={32} />
    </div>
  );
}
