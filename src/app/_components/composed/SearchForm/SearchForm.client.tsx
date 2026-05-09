import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";

import Button from "../../atomic/Button/Button";

export default function SearchForm() {
  const navigate = useNavigate();
  const [chesscom, setChesscom] = useState("");
  const [lichess, setLichess] = useState("");
  const [sameUsername, setSameUsername] = useState(true);

  const handleChesscomChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setChesscom(val);
      if (sameUsername) setLichess(val);
    },
    [sameUsername]
  );

  const handleLichessChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setLichess(e.target.value);
    },
    []
  );

  const handleSameToggle = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const checked = e.target.checked;
      setSameUsername(checked);
      if (checked) setLichess(chesscom);
    },
    [chesscom]
  );

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const params = new URLSearchParams();
      if (chesscom.trim()) params.set("chesscom", chesscom.trim());
      const li = sameUsername ? chesscom.trim() : lichess.trim();
      if (li) params.set("lichess", li);
      const q = params.toString();
      navigate(q ? `/stats?${q}` : "/stats");
    },
    [chesscom, lichess, sameUsername, navigate]
  );

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 max-w-md w-full p-8 border border-[var(--foreground)] rounded"
    >
      <label className="flex flex-col gap-1 text-sm">
        <span>{sameUsername ? "Username" : "Chess.com username"}</span>
        <input
          className="border border-[var(--foreground)] bg-[var(--background)] px-2 py-1 rounded"
          value={chesscom}
          onChange={handleChesscomChange}
          placeholder={sameUsername ? "e.g. hikaru" : "e.g. erik"}
          autoComplete="off"
        />
      </label>
      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
        <input
          type="checkbox"
          checked={sameUsername}
          onChange={handleSameToggle}
          className="accent-[var(--foreground)]"
        />
        Same username on both sites
      </label>
      {!sameUsername && (
        <label className="flex flex-col gap-1 text-sm">
          <span>Lichess username</span>
          <input
            className="border border-[var(--foreground)] bg-[var(--background)] px-2 py-1 rounded"
            value={lichess}
            onChange={handleLichessChange}
            placeholder="e.g. DrNykterstein"
            autoComplete="off"
          />
        </label>
      )}
      <p className="text-xs opacity-80">
        {sameUsername
          ? "Games from both Chess.com and Lichess will be merged."
          : "Provide at least one username. Games from both sites are merged when both are set."}
      </p>
      <Button type="submit" text="Search" />
    </form>
  );
}
