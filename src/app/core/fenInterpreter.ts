import { ChessPieceIcon } from "../globalTypes";
export interface IPiecesFromFEN {
  [key: number]: ChessPieceIcon;
}

export function getPiecesPlacementFromFEN(fen: string): IPiecesFromFEN {
  if (!validateFENString(fen)) {
    return {};
  }
  return {};
}

// Regex to ensure valid FEN string
function validateFENString(fen: string): boolean {
  if (!fen) return false;
  return true;
}

/*
Each / indicates a new row
Lowercase letters = black pieces
Uppercase letters = white pieces
Numbers indicate empty squares
*/
