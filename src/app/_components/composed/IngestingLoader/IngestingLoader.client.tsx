"use client";

interface PlatformRow {
  label: string;
  username: string;
  gamesLoaded: number;
  error?: string;
}

interface IngestingLoaderProps {
  /** Pass per-platform data only for platforms the user actually searched. */
  platforms: PlatformRow[];
  onRebuild: () => void;
}

export default function IngestingLoader({
  platforms,
  onRebuild,
}: Readonly<IngestingLoaderProps>) {
  const hasError = platforms.some((p) => Boolean(p.error));
  const totalLoaded = platforms.reduce((sum, p) => sum + p.gamesLoaded, 0);

  return (
    <div className="flex flex-col items-center gap-6 py-16 max-w-md mx-auto text-center">
      {/* Spinner / error icon */}
      {hasError ? (
        <div
          className="h-10 w-10 flex items-center justify-center rounded-full border-2 border-[var(--foreground)] font-mono text-xl"
          aria-hidden
        >
          !
        </div>
      ) : (
        <span
          className="block h-10 w-10 rounded-full border-4 border-[var(--foreground)] border-t-transparent animate-spin"
          role="status"
          aria-label="Loading"
        />
      )}

      {/* Headline */}
      {hasError ? (
        <h2 className="text-xl font-semibold">Something went wrong</h2>
      ) : (
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">Fetching your games&hellip;</h2>
          <p className="font-mono text-2xl font-bold tabular-nums">
            {totalLoaded.toLocaleString()}
            <span className="text-base font-normal opacity-70 ml-2">games loaded</span>
          </p>
        </div>
      )}

      {/* Per-platform breakdown */}
      <div className="w-full rounded-xl border-2 border-[var(--foreground)] divide-y divide-[var(--foreground)] text-sm font-mono">
        {platforms.map((p) => (
          <div key={p.label} className="flex items-center justify-between gap-4 px-4 py-3">
            <span className="truncate opacity-80">
              {p.label}
              <span className="opacity-60 ml-1">({p.username})</span>
            </span>
            {p.error ? (
              <span className="shrink-0 text-red-500">error</span>
            ) : (
              <span className="shrink-0 tabular-nums">{p.gamesLoaded.toLocaleString()}</span>
            )}
          </div>
        ))}
      </div>

      {/* Contextual message or error detail */}
      {!hasError && (
        <p className="text-sm opacity-60 leading-relaxed">
          Running on our servers &mdash; safe to close this tab.
          <br />
          Come back any time; your games will be ready.
        </p>
      )}

      {hasError && (
        <div className="flex flex-col gap-3 w-full text-left">
          {platforms
            .filter((p) => p.error)
            .map((p) => (
              <p key={p.label} className="text-sm text-red-500 font-mono">
                {p.label}: {p.error}
              </p>
            ))}
          <button
            type="button"
            onClick={onRebuild}
            className="w-full rounded-xl border-2 border-[var(--foreground)] px-4 py-2 font-mono text-sm hover:opacity-80 transition-opacity"
          >
            Try re-fetch all
          </button>
        </div>
      )}
    </div>
  );
}
