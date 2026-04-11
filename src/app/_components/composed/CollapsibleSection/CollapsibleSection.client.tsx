"use client";

import { useEffect, useState, type ReactNode } from "react";

interface CollapsibleSectionProps {
  /** Stable id used as the localStorage key (`section-open:${id}`). */
  id: string;
  title: string;
  /** Default open state when no persisted value exists. */
  defaultOpen?: boolean;
  /** Optional node rendered next to the title (e.g. an ExplainerModal trigger). */
  explainer?: ReactNode;
  children: ReactNode;
}

const STORAGE_PREFIX = "section-open:";

export default function CollapsibleSection({
  id,
  title,
  defaultOpen = true,
  explainer,
  children,
}: Readonly<CollapsibleSectionProps>) {
  const [open, setOpen] = useState<boolean>(defaultOpen);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one-shot localStorage read on mount; the rule's "no setState in effect" guidance does not apply to mount-time hydration of external storage */
    try {
      const stored = window.localStorage.getItem(STORAGE_PREFIX + id);
      if (stored === "1") setOpen(true);
      else if (stored === "0") setOpen(false);
    } catch {
      // ignore
    }
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [id]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_PREFIX + id, open ? "1" : "0");
    } catch {
      // ignore
    }
  }, [id, open, hydrated]);

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--foreground)] pb-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span
            aria-hidden
            className={`inline-block font-mono text-sm opacity-70 transition-transform ${
              open ? "rotate-90" : ""
            }`}
          >
            ▶
          </span>
          <h2 className="min-w-0 truncate text-lg font-semibold">{title}</h2>
        </button>
        {explainer && <div className="shrink-0">{explainer}</div>}
      </header>
      {open && <div className="flex flex-col gap-6">{children}</div>}
    </section>
  );
}
