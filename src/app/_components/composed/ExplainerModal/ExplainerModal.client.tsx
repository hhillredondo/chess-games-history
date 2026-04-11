"use client";

import { useEffect, useState, type ReactNode } from "react";

interface ExplainerModalProps {
  title: string;
  children: ReactNode;
  /** Label for the trigger button (screen reader + tooltip). Defaults to `Explain "{title}"`. */
  triggerLabel?: string;
}

export default function ExplainerModal({
  title,
  children,
  triggerLabel,
}: Readonly<ExplainerModalProps>) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = triggerLabel ?? `Explain "${title}"`;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--foreground)] text-xs font-mono opacity-70 hover:opacity-100"
        aria-label={label}
        title={label}
      >
        i
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="explainer-modal-title"
          onClick={() => setOpen(false)}
        >
          <div
            className="absolute inset-0 bg-[color-mix(in_srgb,var(--foreground)_25%,transparent)]"
            aria-hidden
          />
          <div
            className="relative z-10 flex max-h-[calc(100dvh-2rem)] w-full max-w-[min(92vw,40rem)] flex-col gap-4 overflow-hidden rounded-xl border-2 border-[var(--foreground)] bg-[var(--background)] p-5 shadow-lg sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-4">
              <h2
                id="explainer-modal-title"
                className="min-w-0 text-lg font-semibold leading-tight sm:text-xl"
              >
                {title}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-lg border-2 border-[var(--foreground)] px-3 py-1.5 font-mono text-base hover:opacity-80"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="min-h-0 overflow-y-auto text-sm leading-relaxed [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:mb-3 [&_ul:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1">
              {children}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
