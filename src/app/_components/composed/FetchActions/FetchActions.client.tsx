"use client";

import { useEffect, useState } from "react";

type PendingAction = "refresh" | "rebuild";

const ACTION_META: Record<
  PendingAction,
  { title: string; description: string; confirmLabel: string; destructive: boolean }
> = {
  refresh: {
    title: "Fetch more games?",
    description:
      "Checks for games played since your last sync and adds them to your history. Your existing cached games are not affected.",
    confirmLabel: "Fetch",
    destructive: false,
  },
  rebuild: {
    title: "Re-fetch all games?",
    description:
      "Deletes your entire cached game history and re-downloads everything from scratch. This can take several minutes. You will see a loading screen while it runs.",
    confirmLabel: "Re-fetch all",
    destructive: true,
  },
};

interface FetchActionsProps {
  onRefresh: () => void;
  onRebuild: () => void;
}

export default function FetchActions({ onRefresh, onRebuild }: Readonly<FetchActionsProps>) {
  const [pending, setPending] = useState<PendingAction | null>(null);

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPending(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending]);

  function confirm() {
    if (!pending) return;
    if (pending === "refresh") onRefresh();
    else onRebuild();
    setPending(null);
  }

  const meta = pending ? ACTION_META[pending] : null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          onClick={() => setPending("refresh")}
          className="rounded border border-[var(--foreground)] px-3 py-1 hover:opacity-80"
        >
          Fetch more games
        </button>
        <button
          type="button"
          onClick={() => setPending("rebuild")}
          className="rounded border border-[var(--foreground)] px-3 py-1 hover:opacity-80"
        >
          Re-fetch all
        </button>
      </div>

      {meta && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={meta.title}
          onClick={() => setPending(null)}
        >
          <div
            className="absolute inset-0 bg-[color-mix(in_srgb,var(--foreground)_25%,transparent)]"
            aria-hidden
          />
          <div
            className="relative z-10 flex w-full max-w-sm flex-col gap-4 rounded-xl border-2 border-[var(--foreground)] bg-[var(--background)] p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold">{meta.title}</h2>
            <p className="text-sm opacity-75 leading-relaxed">{meta.description}</p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPending(null)}
                className="rounded-lg border border-[var(--foreground)] px-4 py-1.5 font-mono text-sm hover:opacity-80"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirm}
                className={`rounded-lg border-2 px-4 py-1.5 font-mono text-sm ${
                  meta.destructive
                    ? "border-[#d45555] bg-[#d45555] text-white hover:opacity-80"
                    : "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)] hover:opacity-80"
                }`}
              >
                {meta.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
