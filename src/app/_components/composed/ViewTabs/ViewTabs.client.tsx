"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

type View = "analytics" | "games" | "coach";

interface ViewTabsProps {
  current: View;
}

const TABS: { id: View; label: string; href: string }[] = [
  { id: "analytics", label: "Analytics", href: "/stats" },
  { id: "games", label: "Games", href: "/games" },
  { id: "coach", label: "Coach", href: "/coach" },
];

export default function ViewTabs({ current }: Readonly<ViewTabsProps>) {
  const searchParams = useSearchParams();
  const chesscom = searchParams.get("chesscom")?.trim() ?? "";
  const lichess = searchParams.get("lichess")?.trim() ?? "";

  const query = new URLSearchParams();
  if (chesscom) query.set("chesscom", chesscom);
  if (lichess) query.set("lichess", lichess);
  const suffix = query.toString();

  return (
    <div className="flex flex-col gap-2">
      <Link
        href="/"
        className="font-mono text-sm opacity-60 hover:opacity-100 transition-opacity w-fit"
      >
        ← Search
      </Link>
      <nav
        className="flex w-full items-center gap-1 rounded-xl border-2 border-[var(--foreground)] p-1"
        role="tablist"
        aria-label="View"
      >
        {TABS.map((tab) => {
          const active = tab.id === current;
          const href = suffix ? `${tab.href}?${suffix}` : tab.href;
          return (
            <Link
              key={tab.id}
              href={href}
              role="tab"
              aria-selected={active}
              className={`flex-1 rounded-lg px-4 py-2 text-center font-mono text-sm transition-colors ${
                active
                  ? "bg-[var(--foreground)] text-[var(--background)]"
                  : "opacity-70 hover:opacity-100"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
