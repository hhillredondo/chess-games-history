"use client";

import { useEffect, useMemo, useState } from "react";

import {
  EMPTY_FILTERS,
  TIME_CONTROL_CATEGORIES,
  TERMINATION_BUCKETS,
  isFilterActive,
  terminationLabel,
  timeControlLabel,
  type DerivedFilterOptions,
  type GameFilters,
  type TerminationBucket,
} from "@/lib/filters/game-filters";
import type { GameSource, UserResult } from "@/lib/types/unified-game";

// ── Which filter fields can be shown ─────────────────────────────────────────

export type FilterFieldName =
  | "platform"
  | "timeControl"
  | "dateRange"
  | "color"
  | "result"
  | "eloDiff"
  | "opening"
  | "moves"
  | "opponent"
  | "minutesPlayed"
  | "endType";

const ALL_FIELDS: FilterFieldName[] = [
  "platform",
  "timeControl",
  "dateRange",
  "color",
  "result",
  "eloDiff",
  "opening",
  "moves",
  "opponent",
  "minutesPlayed",
  "endType",
];

/** Count how many filter sections (that are currently visible) have a value set. */
function countActive(filters: GameFilters, visible: Set<FilterFieldName>): number {
  let n = 0;
  if (visible.has("platform") && (filters.sources?.length ?? 0) > 0) n++;
  if (visible.has("timeControl") && (filters.timeControls?.length ?? 0) > 0) n++;
  if (visible.has("dateRange") && (filters.dateFrom || filters.dateUntil)) n++;
  if (visible.has("color") && filters.color) n++;
  if (visible.has("result") && (filters.results?.length ?? 0) > 0) n++;
  if (visible.has("eloDiff") && (filters.eloDiffMin != null || filters.eloDiffMax != null)) n++;
  if (visible.has("opening") && filters.opening?.trim()) n++;
  if (visible.has("moves") && (filters.movesMin != null || filters.movesMax != null)) n++;
  if (visible.has("opponent") && filters.opponent?.trim()) n++;
  if (visible.has("minutesPlayed") && (filters.minutesMin != null || filters.minutesMax != null)) n++;
  if (visible.has("endType") && (filters.terminations?.length ?? 0) > 0) n++;
  return n;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface FilterPanelProps {
  /** The filters currently committed to the parent (so we can reset staged state to match). */
  committed: GameFilters;
  /** Unique options derived from the full game set. */
  options: DerivedFilterOptions;
  /** Called when the user clicks Apply. */
  onApply: (filters: GameFilters) => void;
  /** True while the parent is re-running predicates. */
  applying: boolean;
  /**
   * Which filter sections to render. Omit to show all.
   * Pass a subset (e.g. `["timeControl", "dateRange", "color"]`) for a compact variant.
   */
  fields?: FilterFieldName[];
  /**
   * Suffix for the localStorage key used to persist open/collapsed state.
   * Use distinct values per location so analytics and games remember independently.
   */
  storageKey?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type NumericKey =
  | "eloDiffMin"
  | "eloDiffMax"
  | "movesMin"
  | "movesMax"
  | "minutesMin"
  | "minutesMax";

function parseOptionalNumber(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

function toggleInArray<T>(arr: T[] | undefined, value: T): T[] {
  const set = new Set(arr ?? []);
  if (set.has(value)) set.delete(value);
  else set.add(value);
  return [...set];
}

const RESULT_OPTIONS: { id: UserResult; label: string }[] = [
  { id: "win", label: "Win" },
  { id: "loss", label: "Loss" },
  { id: "draw", label: "Draw" },
  { id: "unknown", label: "Unknown" },
];

const SOURCE_OPTIONS: { id: GameSource; label: string }[] = [
  { id: "chesscom", label: "Chess.com" },
  { id: "lichess", label: "Lichess" },
];

const chip = (active: boolean) =>
  `rounded-full border px-3 py-1 text-xs font-mono transition-colors ${
    active
      ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
      : "border-[var(--foreground)]/40 text-[var(--foreground)] opacity-70 hover:opacity-100"
  }`;

// ── Component ─────────────────────────────────────────────────────────────────

export default function FilterPanel({
  committed,
  options,
  onApply,
  applying,
  fields,
  storageKey = "default",
}: Readonly<FilterPanelProps>) {
  const [staged, setStaged] = useState<GameFilters>(committed);
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const lsKey = `filter-panel:${storageKey}`;

  // Hydrate collapsed state from localStorage (one-shot on mount).
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const stored = window.localStorage.getItem(lsKey);
      if (stored === "0") setOpen(false);
      else if (stored === "1") setOpen(true);
    } catch { /* ignore */ }
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [lsKey]);

  // Persist collapsed state.
  useEffect(() => {
    if (!hydrated) return;
    try { window.localStorage.setItem(lsKey, open ? "1" : "0"); } catch { /* ignore */ }
  }, [lsKey, open, hydrated]);

  // Re-sync staged state if parent resets committed filters.
  useEffect(() => { setStaged(committed); }, [committed]);

  const visibleFields = useMemo(() => new Set(fields ?? ALL_FIELDS), [fields]);

  const dirty = useMemo(
    () => JSON.stringify(staged) !== JSON.stringify(committed),
    [staged, committed]
  );

  const activeCount = useMemo(() => countActive(committed, visibleFields), [committed, visibleFields]);
  const hasAny = isFilterActive(staged);
  const minutesOk = options.minutesFilterAvailable;

  const updateNumeric = (key: NumericKey, value: string) =>
    setStaged((s) => ({ ...s, [key]: parseOptionalNumber(value) }));

  const show = (f: FilterFieldName) => visibleFields.has(f);

  return (
    <div className="flex flex-col rounded-xl border-2 border-[var(--foreground)]">
      {/* ── Header (always visible) ──────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span
            aria-hidden
            className={`inline-block font-mono text-sm opacity-70 transition-transform ${open ? "rotate-90" : ""}`}
          >
            ▶
          </span>
          <span className="text-base font-semibold">Filters</span>
          {!open && activeCount > 0 && (
            <span className="ml-1 rounded-full bg-[var(--foreground)] px-2 py-0.5 font-mono text-xs text-[var(--background)]">
              {activeCount} active
            </span>
          )}
        </button>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setStaged(EMPTY_FILTERS)}
            disabled={!hasAny}
            className="rounded-lg border border-[var(--foreground)] px-3 py-1.5 font-mono text-xs disabled:opacity-40"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => {
              const payload = { ...staged };
              if (!minutesOk) { delete payload.minutesMin; delete payload.minutesMax; }
              onApply(payload);
            }}
            disabled={applying || !dirty}
            className="rounded-lg border-2 border-[var(--foreground)] bg-[var(--foreground)] px-4 py-1.5 font-mono text-xs text-[var(--background)] disabled:opacity-40"
          >
            {applying ? "Applying…" : "Apply"}
          </button>
        </div>
      </div>

      {/* ── Body (collapsible) ───────────────────────────────────────────── */}
      {open && (
        <div className="border-t-2 border-[var(--foreground)] p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">

            {/* Platform */}
            {show("platform") && options.sources.length > 1 && (
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-2 text-xs font-semibold uppercase opacity-70">Platform</legend>
                <div className="flex flex-wrap gap-2">
                  {SOURCE_OPTIONS.filter((s) => options.sources.includes(s.id)).map((s) => {
                    const active = (staged.sources ?? []).includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setStaged((cur) => ({ ...cur, sources: toggleInArray(cur.sources, s.id) }))}
                        className={chip(active)}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}

            {/* Time control */}
            {show("timeControl") && (
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-2 text-xs font-semibold uppercase opacity-70">Time control</legend>
                <div className="flex flex-wrap gap-2">
                  {TIME_CONTROL_CATEGORIES.filter((c) => options.timeControls.includes(c)).map((c) => {
                    const active = (staged.timeControls ?? []).includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setStaged((cur) => ({ ...cur, timeControls: toggleInArray(cur.timeControls, c) }))}
                        className={chip(active)}
                      >
                        {timeControlLabel(c)}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}

            {/* Date range */}
            {show("dateRange") && (
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-2 text-xs font-semibold uppercase opacity-70">Date range</legend>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={staged.dateFrom ?? ""}
                    min={options.minDate ?? undefined}
                    max={options.maxDate ?? undefined}
                    onChange={(e) => setStaged((s) => ({ ...s, dateFrom: e.target.value || undefined }))}
                    className="min-w-0 flex-1 rounded border border-[var(--foreground)] bg-[var(--background)] px-2 py-1 font-mono text-xs"
                  />
                  <input
                    type="date"
                    value={staged.dateUntil ?? ""}
                    min={options.minDate ?? undefined}
                    max={options.maxDate ?? undefined}
                    onChange={(e) => setStaged((s) => ({ ...s, dateUntil: e.target.value || undefined }))}
                    className="min-w-0 flex-1 rounded border border-[var(--foreground)] bg-[var(--background)] px-2 py-1 font-mono text-xs"
                  />
                </div>
              </fieldset>
            )}

            {/* Color */}
            {show("color") && (
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-2 text-xs font-semibold uppercase opacity-70">Played as</legend>
                <div className="flex gap-2">
                  {(["white", "black"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setStaged((s) => ({ ...s, color: s.color === c ? undefined : c }))}
                      className={chip(staged.color === c)}
                    >
                      {c === "white" ? "White" : "Black"}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            {/* Result */}
            {show("result") && (
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-2 text-xs font-semibold uppercase opacity-70">Result</legend>
                <div className="flex flex-wrap gap-2">
                  {RESULT_OPTIONS.filter((r) => options.results.includes(r.id)).map((r) => {
                    const active = (staged.results ?? []).includes(r.id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setStaged((cur) => ({ ...cur, results: toggleInArray(cur.results, r.id) }))}
                        className={chip(active)}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}

            {/* Elo diff */}
            {show("eloDiff") && (
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-2 text-xs font-semibold uppercase opacity-70">Elo diff (you − opp)</legend>
                <div className="flex gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="min"
                    value={staged.eloDiffMin ?? ""}
                    onChange={(e) => updateNumeric("eloDiffMin", e.target.value)}
                    className="min-w-0 flex-1 rounded border border-[var(--foreground)] bg-[var(--background)] px-2 py-1 font-mono text-xs"
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="max"
                    value={staged.eloDiffMax ?? ""}
                    onChange={(e) => updateNumeric("eloDiffMax", e.target.value)}
                    className="min-w-0 flex-1 rounded border border-[var(--foreground)] bg-[var(--background)] px-2 py-1 font-mono text-xs"
                  />
                </div>
              </fieldset>
            )}

            {/* Opening */}
            {show("opening") && (
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-2 text-xs font-semibold uppercase opacity-70">Opening</legend>
                <input
                  type="text"
                  placeholder="name or ECO"
                  value={staged.opening ?? ""}
                  onChange={(e) => setStaged((s) => ({ ...s, opening: e.target.value || undefined }))}
                  className="w-full rounded border border-[var(--foreground)] bg-[var(--background)] px-2 py-1 font-mono text-xs"
                />
              </fieldset>
            )}

            {/* Move count */}
            {show("moves") && (
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-2 text-xs font-semibold uppercase opacity-70">Moves</legend>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    placeholder={`min (${options.minMoves})`}
                    value={staged.movesMin ?? ""}
                    onChange={(e) => updateNumeric("movesMin", e.target.value)}
                    className="min-w-0 flex-1 rounded border border-[var(--foreground)] bg-[var(--background)] px-2 py-1 font-mono text-xs"
                  />
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    placeholder={`max (${options.maxMoves})`}
                    value={staged.movesMax ?? ""}
                    onChange={(e) => updateNumeric("movesMax", e.target.value)}
                    className="min-w-0 flex-1 rounded border border-[var(--foreground)] bg-[var(--background)] px-2 py-1 font-mono text-xs"
                  />
                </div>
              </fieldset>
            )}

            {/* Opponent */}
            {show("opponent") && (
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-2 text-xs font-semibold uppercase opacity-70">Opponent</legend>
                <input
                  type="text"
                  placeholder="username contains"
                  value={staged.opponent ?? ""}
                  onChange={(e) => setStaged((s) => ({ ...s, opponent: e.target.value || undefined }))}
                  className="w-full rounded border border-[var(--foreground)] bg-[var(--background)] px-2 py-1 font-mono text-xs"
                />
              </fieldset>
            )}

            {/* Minutes played */}
            {show("minutesPlayed") && (
              <fieldset
                className={`flex flex-col gap-3 ${minutesOk ? "" : "opacity-50"}`}
                disabled={!minutesOk}
              >
                <legend className="mb-2 text-xs font-semibold uppercase opacity-70">
                  Minutes played{" "}
                  <span className="normal-case opacity-60">(reported span)</span>
                </legend>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    inputMode="decimal"
                    placeholder="min"
                    value={staged.minutesMin ?? ""}
                    onChange={(e) => updateNumeric("minutesMin", e.target.value)}
                    disabled={!minutesOk}
                    className="min-w-0 flex-1 rounded border border-[var(--foreground)] bg-[var(--background)] px-2 py-1 font-mono text-xs disabled:cursor-not-allowed"
                  />
                  <input
                    type="number"
                    min={0}
                    inputMode="decimal"
                    placeholder="max"
                    value={staged.minutesMax ?? ""}
                    onChange={(e) => updateNumeric("minutesMax", e.target.value)}
                    disabled={!minutesOk}
                    className="min-w-0 flex-1 rounded border border-[var(--foreground)] bg-[var(--background)] px-2 py-1 font-mono text-xs disabled:cursor-not-allowed"
                  />
                </div>
                <p className="text-[10.5px] opacity-55">
                  Wall-clock between first and last move timestamps. Correspondence
                  games are excluded from results whenever this filter is set.
                  {minutesOk ? "" : " N/A — loaded games are all correspondence."}
                </p>
              </fieldset>
            )}

            {/* End type */}
            {show("endType") && (
              <fieldset className="flex flex-col gap-3 sm:col-span-2 lg:col-span-3">
                <legend className="mb-2 text-xs font-semibold uppercase opacity-70">End type</legend>
                <div className="flex flex-wrap gap-2">
                  {TERMINATION_BUCKETS.filter((b) => options.terminations.includes(b)).map(
                    (b: TerminationBucket) => {
                      const active = (staged.terminations ?? []).includes(b);
                      return (
                        <button
                          key={b}
                          type="button"
                          onClick={() => setStaged((cur) => ({ ...cur, terminations: toggleInArray(cur.terminations, b) }))}
                          className={chip(active)}
                        >
                          {terminationLabel(b)}
                        </button>
                      );
                    }
                  )}
                </div>
                <p className="text-[10.5px] opacity-55">
                  Best-effort bucketing from PGN Termination tag + final position.
                  Some games fall into &ldquo;Other&rdquo; or &ldquo;Unknown&rdquo;.
                </p>
              </fieldset>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
