import { useMemo, useState } from "react";

import {
  PERIOD_BUCKET_LABELS,
  computePeriodStats,
  type PeriodBucket,
  type PeriodRow,
} from "@/lib/analytics/period-stats";
import type { UnifiedGame } from "@/lib/types/unified-game";

const W = 1020;
const H = 390;
const PAD = { top: 20, right: 16, bottom: 52, left: 44 };
const plotW = W - PAD.left - PAD.right;
const plotH = H - PAD.top - PAD.bottom;

const BUCKETS: PeriodBucket[] = ["year", "month", "week", "day"];

/** Clamp labels so they don't overlap (show every Nth tick label). */
function labelStep(count: number): number {
  if (count <= 12) return 1;
  if (count <= 24) return 2;
  if (count <= 52) return 4;
  if (count <= 104) return 8;
  return Math.ceil(count / 12);
}

export default function PeriodChart({
  games,
}: Readonly<{ games: UnifiedGame[] }>) {
  const [bucket, setBucket] = useState<PeriodBucket>("month");
  const [tooltip, setTooltip] = useState<{
    row: PeriodRow;
    left: number;
    top: number;
  } | null>(null);

  const rows = useMemo(() => computePeriodStats(games, bucket), [games, bucket]);

  if (rows.length === 0)
    return <p className="text-sm opacity-60">No data for this period.</p>;

  const maxGames = Math.max(...rows.map((r) => r.games), 1);
  const yTickCount = 4;
  const yStep = Math.ceil(maxGames / yTickCount) || 1;
  const yAxisMax = yStep * yTickCount;
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => i * yStep);

  const slotW = plotW / rows.length;
  const barW = Math.max(2, slotW * 0.7);
  const step = labelStep(rows.length);

  function sy(v: number) {
    return PAD.top + (1 - Math.min(v, yAxisMax) / yAxisMax) * plotH;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {BUCKETS.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => setBucket(b)}
            className={`rounded border px-2.5 py-1 font-mono text-xs transition-colors ${
              bucket === b
                ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                : "border-[var(--foreground)]/40 opacity-70 hover:opacity-100"
            }`}
          >
            {PERIOD_BUCKET_LABELS[b]}
          </button>
        ))}
      </div>

      <div className="relative w-full" onMouseLeave={() => setTooltip(null)}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ maxHeight: H }}
          aria-label={`Games per ${bucket} bar chart`}
        >
          {/* Y gridlines + labels */}
          {yTicks.map((v) => (
            <g key={v}>
              <line
                x1={PAD.left}
                y1={sy(v)}
                x2={W - PAD.right}
                y2={sy(v)}
                stroke="currentColor"
                strokeOpacity={v === 0 ? 0.25 : 0.1}
                strokeWidth={1}
                strokeDasharray={v === 0 ? undefined : "3 3"}
              />
              <text
                x={PAD.left - 5}
                y={sy(v) + 4}
                textAnchor="end"
                fontSize={10}
                fill="currentColor"
                opacity={0.6}
              >
                {v}
              </text>
            </g>
          ))}

          {/* Axes */}
          <line
            x1={PAD.left}
            y1={PAD.top}
            x2={PAD.left}
            y2={H - PAD.bottom}
            stroke="currentColor"
            strokeOpacity={0.3}
            strokeWidth={1}
          />
          <line
            x1={PAD.left}
            y1={H - PAD.bottom}
            x2={W - PAD.right}
            y2={H - PAD.bottom}
            stroke="currentColor"
            strokeOpacity={0.3}
            strokeWidth={1}
          />

          {/* Bars */}
          {rows.map((row, i) => {
            const bx = PAD.left + i * slotW + (slotW - barW) / 2;
            const wH = sy(0) - sy(row.wins);
            const dH = sy(0) - sy(row.draws);
            const lH = sy(0) - sy(row.losses);
            return (
              <g
                key={row.key}
                style={{ cursor: "pointer" }}
                onMouseEnter={(e) => {
                  const rect = (
                    e.currentTarget.ownerSVGElement!
                      .parentElement as HTMLElement
                  ).getBoundingClientRect();
                  setTooltip({
                    row,
                    left: e.clientX - rect.left + 10,
                    top: e.clientY - rect.top - 10,
                  });
                }}
              >
                {row.losses > 0 && (
                  <rect
                    x={bx}
                    y={sy(row.losses)}
                    width={barW}
                    height={lH}
                    fill="#d45555"
                    opacity={0.65}
                    rx={Math.min(2, barW / 2)}
                  />
                )}
                {row.draws > 0 && (
                  <rect
                    x={bx}
                    y={sy(row.losses + row.draws)}
                    width={barW}
                    height={dH}
                    fill="currentColor"
                    opacity={0.25}
                    rx={Math.min(2, barW / 2)}
                  />
                )}
                {row.wins > 0 && (
                  <rect
                    x={bx}
                    y={sy(row.wins + row.draws + row.losses)}
                    width={barW}
                    height={wH}
                    fill="#4caf72"
                    opacity={0.7}
                    rx={Math.min(2, barW / 2)}
                  />
                )}
              </g>
            );
          })}

          {/* X tick labels (thinned out for dense data) */}
          {rows.map((row, i) => {
            if (i % step !== 0) return null;
            return (
              <text
                key={`x-${row.key}`}
                x={PAD.left + i * slotW + slotW / 2}
                y={H - PAD.bottom + 13}
                textAnchor="middle"
                fontSize={9}
                fill="currentColor"
                opacity={0.65}
              >
                {row.label}
              </text>
            );
          })}

          {/* Legend */}
          {[
            { fill: "#4caf72", label: "Win" },
            { fill: "currentColor", label: "Draw", opacity: 0.25 },
            { fill: "#d45555", label: "Loss" },
          ].map(({ fill, label, opacity = 0.65 }, idx) => (
            <g
              key={label}
              transform={`translate(${PAD.left + idx * 60}, ${H - 14})`}
            >
              <rect width={10} height={10} fill={fill} opacity={opacity} rx={2} />
              <text x={14} y={9} fontSize={9} fill="currentColor" opacity={0.65}>
                {label}
              </text>
            </g>
          ))}
        </svg>

        {tooltip && (
          <div
            style={{
              left: tooltip.left,
              top: tooltip.top,
              pointerEvents: "none",
              minWidth: 148,
            }}
            className="absolute z-10 rounded-md border border-[var(--foreground)] bg-[var(--background)] px-3 py-2 text-xs shadow-lg opacity-90"
          >
            <div className="mb-1 font-semibold opacity-80">{tooltip.row.label}</div>
            <div className="flex justify-between gap-3">
              <span className="opacity-60">Games</span>
              <span>{tooltip.row.games}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span style={{ color: "#4caf72" }}>Wins</span>
              <span>{tooltip.row.wins}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="opacity-60">Draws</span>
              <span>{tooltip.row.draws}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span style={{ color: "#d45555" }}>Losses</span>
              <span>{tooltip.row.losses}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
