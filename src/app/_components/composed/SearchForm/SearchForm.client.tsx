"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import Button from "../../atomic/Button/Button";

export default function SearchForm() {
  const router = useRouter();
  const [chesscom, setChesscom] = useState("");
  const [lichess, setLichess] = useState("");

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    if (chesscom.trim()) params.set("chesscom", chesscom.trim());
    if (lichess.trim()) params.set("lichess", lichess.trim());
    return params.toString();
  }, [chesscom, lichess]);

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const q = buildParams();
      router.push(q ? `/stats?${q}` : "/stats");
    },
    [buildParams, router]
  );

  const onGames = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const q = buildParams();
      router.push(q ? `/games?${q}` : "/games");
    },
    [buildParams, router]
  );

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 max-w-md w-full p-8 border border-[var(--foreground)] rounded"
    >
      <label className="flex flex-col gap-1 text-sm">
        <span>Chess.com username (optional)</span>
        <input
          className="border border-[var(--foreground)] bg-[var(--background)] px-2 py-1 rounded"
          value={chesscom}
          onChange={(e) => setChesscom(e.target.value)}
          placeholder="e.g. erik"
          autoComplete="off"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span>Lichess username (optional)</span>
        <input
          className="border border-[var(--foreground)] bg-[var(--background)] px-2 py-1 rounded"
          value={lichess}
          onChange={(e) => setLichess(e.target.value)}
          placeholder="e.g. lichess"
          autoComplete="off"
        />
      </label>
      <p className="text-xs opacity-80">
        Provide at least one username. Games from both sites are merged when both
        are set.
      </p>
      <div className="flex gap-2">
        <Button type="submit" text="Analyze" />
        <Button type="button" text="Browse games" onClick={onGames} />
      </div>
    </form>
  );
}
