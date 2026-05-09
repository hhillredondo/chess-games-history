export const SCHOLARS_MATE_PGN = `[Event "?"]
[Site "?"]
[White "alice"]
[Black "bob"]
[Result "1-0"]
[TimeControl "180+2"]

1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0
`;

export const PGN_WITH_CLOCKS = `[Event "?"]
[Site "?"]
[White "alice"]
[Black "bob"]
[Result "1-0"]
[TimeControl "180+2"]

1. e4 {[%clk 0:03:00]} e5 {[%clk 0:03:00]} 2. Nf3 {[%clk 0:02:58]} Nc6 {[%clk 0:02:59]} 3. Bb5 {[%clk 0:02:55]} 1-0
`;

export const RUY_LOPEZ_PGN = `[Event "?"]
[Site "?"]
[White "alice"]
[Black "bob"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 *
`;

export const TWO_GAMES_BLOB = `${SCHOLARS_MATE_PGN}\n${PGN_WITH_CLOCKS}`;
