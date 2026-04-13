"use client";

import { useDeferredValue, useMemo } from "react";

import { computeCheckmateStats, PIECE_LABELS } from "@/lib/analytics/checkmates";
import type { UnifiedGame } from "@/lib/types/unified-game";

const PIECE_COLORS: Record<string, string> = {
  q: "#a855f7",
  r: "#3b82f6",
  b: "#f59e0b",
  n: "#10b981",
  p: "#6b7280",
  k: "#ef4444",
};

const MAT_COLORS: Record<string, string> = {
  ahead: "#4caf72",
  equal: "#6b7280",
  behind: "#d45555",
};

type PieSlice = { label: string; value: number; color: string };

function PieChart({
  slices,
  size = 120,
}: Readonly<{ slices: PieSlice[]; size?: number }>) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total === 0) return <p className="text-sm opacity-60">—</p>;

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;

  // Pre-compute cumulative start angles to avoid mutation inside map
  const cumulative = slices.reduce<number[]>((acc, s) => {
    const prev = acc.length > 0 ? acc[acc.length - 1]! : -Math.PI / 2;
    return [...acc, prev + (s.value / total) * 2 * Math.PI];
  }, []);

  const arcs = slices.map((s, idx) => {
    const startAngle = idx === 0 ? -Math.PI / 2 : cumulative[idx - 1]!;
    const endAngle = cumulative[idx]!;
    const sweep = endAngle - startAngle;
    const large = sweep > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    return { ...s, d, pct: Math.round((s.value / total) * 100) };
  });

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="w-full"
      style={{ maxWidth: size }}
      aria-label="Pie chart"
    >
      {arcs.map((arc, i) => (
        <path key={i} d={arc.d} fill={arc.color} opacity={0.8} />
      ))}
    </svg>
  );
}

function Legend({
  slices,
  total,
}: Readonly<{ slices: PieSlice[]; total: number }>) {
  return (
    <div className="flex flex-col gap-1">
      {slices
        .filter((s) => s.value > 0)
        .map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-xs">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm flex-shrink-0"
              style={{ background: s.color, opacity: 0.8 }}
            />
            <span className="flex-1 opacity-80">{s.label}</span>
            <span className="font-mono tabular-nums opacity-70">
              {s.value}{" "}
              <span className="opacity-60">
                ({total > 0 ? Math.round((s.value / total) * 100) : 0}%)
              </span>
            </span>
          </div>
        ))}
    </div>
  );
}

export default function CheckmatesSection({
  games,
}: Readonly<{ games: UnifiedGame[] }>) {
  // Use deferred value so the expensive chess.js computation doesn't block
  // the first paint of the analytics page.
  const deferredGames = useDeferredValue(games);
  const stats = useMemo(
    () => computeCheckmateStats(deferredGames),
    [deferredGames]
  );

  if (stats.totalGiven === 0 && stats.totalReceived === 0) {
    return (
      <p className="text-sm opacity-60">
        No checkmates found in this game set.
      </p>
    );
  }

  const pieceSlicesGiven: PieSlice[] = stats.deliveringPiece
    .filter((r) => r.given > 0)
    .map((r) => ({
      label: PIECE_LABELS[r.piece],
      value: r.given,
      color: PIECE_COLORS[r.piece] ?? "#888",
    }));

  const pieceSlicesReceived: PieSlice[] = stats.deliveringPiece
    .filter((r) => r.received > 0)
    .map((r) => ({
      label: PIECE_LABELS[r.piece],
      value: r.received,
      color: PIECE_COLORS[r.piece] ?? "#888",
    }));

  const matSlicesGiven: PieSlice[] = stats.materialBalance
    .filter((r) => r.given > 0)
    .map((r) => ({
      label: r.label,
      value: r.given,
      color: MAT_COLORS[r.bucket] ?? "#888",
    }));

  const matSlicesReceived: PieSlice[] = stats.materialBalance
    .filter((r) => r.received > 0)
    .map((r) => ({
      label: r.label,
      value: r.received,
      color: MAT_COLORS[r.bucket] ?? "#888",
    }));

  return (
    <div className="flex flex-col gap-6">
      {/* Delivering piece */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Given */}
        {stats.totalGiven > 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium">
              Checkmates given{" "}
              <span className="opacity-55 font-normal">({stats.totalGiven})</span>
            </p>
            <div className="flex items-start gap-4">
              <div className="w-28 flex-shrink-0">
                <PieChart slices={pieceSlicesGiven} />
              </div>
              <Legend slices={pieceSlicesGiven} total={stats.totalGiven - stats.unknownGiven} />
            </div>
            {stats.unknownGiven > 0 && (
              <p className="text-[11px] opacity-50">
                {stats.unknownGiven} game(s) with unknown delivering piece.
              </p>
            )}
          </div>
        )}

        {/* Received */}
        {stats.totalReceived > 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium">
              Checkmates received{" "}
              <span className="opacity-55 font-normal">({stats.totalReceived})</span>
            </p>
            <div className="flex items-start gap-4">
              <div className="w-28 flex-shrink-0">
                <PieChart slices={pieceSlicesReceived} />
              </div>
              <Legend slices={pieceSlicesReceived} total={stats.totalReceived - stats.unknownReceived} />
            </div>
            {stats.unknownReceived > 0 && (
              <p className="text-[11px] opacity-50">
                {stats.unknownReceived} game(s) with unknown delivering piece.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Checkmate move count distribution */}
      {(stats.moveCountsGiven.length > 0 || stats.moveCountsReceived.length > 0) && (() => {
        // Bucket move counts into ranges for the histogram
        const bucketize = (counts: number[]) => {
          const buckets: { label: string; min: number; max: number; count: number }[] = [
            { label: "1–10", min: 1, max: 10, count: 0 },
            { label: "11–20", min: 11, max: 20, count: 0 },
            { label: "21–30", min: 21, max: 30, count: 0 },
            { label: "31–40", min: 31, max: 40, count: 0 },
            { label: "41–50", min: 41, max: 50, count: 0 },
            { label: "51–60", min: 51, max: 60, count: 0 },
            { label: "61+", min: 61, max: Infinity, count: 0 },
          ];
          for (const m of counts) {
            const b = buckets.find((b) => m >= b.min && m <= b.max);
            if (b) b.count++;
          }
          return buckets;
        };

        const givenBuckets = bucketize(stats.moveCountsGiven);
        const receivedBuckets = bucketize(stats.moveCountsReceived);
        const allBuckets = givenBuckets.map((b, i) => ({
          label: b.label,
          given: b.count,
          received: receivedBuckets[i]!.count,
        })).filter((b) => b.given > 0 || b.received > 0);

        if (allBuckets.length === 0) return null;

        const maxCount = Math.max(...allBuckets.flatMap((b) => [b.given, b.received]), 1);
        const W = 700, H = 280;
        const P = { top: 16, right: 16, bottom: 44, left: 44 };
        const plotW = W - P.left - P.right;
        const plotH = H - P.top - P.bottom;
        const barCount = allBuckets.length;
        const slotW = plotW / barCount;
        const barW = slotW * 0.35;
        const yTickCount = 4;
        const yTickStep = Math.ceil(maxCount / yTickCount) || 1;
        const yAxisMax = yTickStep * yTickCount;
        const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => i * yTickStep);
        const sy = (v: number) => P.top + (1 - v / yAxisMax) * plotH;

        return (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium">Checkmate move count</p>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="w-full"
              style={{ maxHeight: H }}
              aria-label="Checkmate move count distribution"
            >
              {/* Y gridlines + labels */}
              {yTicks.map((v) => (
                <g key={v}>
                  <line
                    x1={P.left} y1={sy(v)}
                    x2={W - P.right} y2={sy(v)}
                    stroke="currentColor"
                    strokeOpacity={v === 0 ? 0.25 : 0.1}
                    strokeWidth={1}
                    strokeDasharray={v === 0 ? undefined : "3 3"}
                  />
                  <text
                    x={P.left - 6}
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
                x1={P.left} y1={P.top}
                x2={P.left} y2={H - P.bottom}
                stroke="currentColor" strokeOpacity={0.3} strokeWidth={1}
              />
              <line
                x1={P.left} y1={H - P.bottom}
                x2={W - P.right} y2={H - P.bottom}
                stroke="currentColor" strokeOpacity={0.3} strokeWidth={1}
              />

              {/* Bars */}
              {allBuckets.map((b, i) => {
                const cx = P.left + i * slotW + slotW / 2;
                return (
                  <g key={b.label}>
                    {/* Given bar (left) */}
                    {b.given > 0 && (
                      <rect
                        x={cx - barW - 1}
                        y={sy(b.given)}
                        width={barW}
                        height={H - P.bottom - sy(b.given)}
                        fill="#4caf72"
                        opacity={0.7}
                        rx={2}
                      />
                    )}
                    {b.given > 0 && (
                      <text
                        x={cx - barW / 2 - 1}
                        y={sy(b.given) - 3}
                        textAnchor="middle"
                        fontSize={9}
                        fill="#4caf72"
                        opacity={0.9}
                      >
                        {b.given}
                      </text>
                    )}
                    {/* Received bar (right) */}
                    {b.received > 0 && (
                      <rect
                        x={cx + 1}
                        y={sy(b.received)}
                        width={barW}
                        height={H - P.bottom - sy(b.received)}
                        fill="#d45555"
                        opacity={0.7}
                        rx={2}
                      />
                    )}
                    {b.received > 0 && (
                      <text
                        x={cx + barW / 2 + 1}
                        y={sy(b.received) - 3}
                        textAnchor="middle"
                        fontSize={9}
                        fill="#d45555"
                        opacity={0.9}
                      >
                        {b.received}
                      </text>
                    )}
                    {/* X label */}
                    <text
                      x={cx}
                      y={H - P.bottom + 14}
                      textAnchor="middle"
                      fontSize={10}
                      fill="currentColor"
                      opacity={0.7}
                    >
                      {b.label}
                    </text>
                  </g>
                );
              })}

              {/* X axis label */}
              <text
                x={P.left + plotW / 2}
                y={H - 2}
                textAnchor="middle"
                fontSize={10}
                fill="currentColor"
                opacity={0.5}
              >
                Moves to checkmate
              </text>
            </svg>
            <div className="flex gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#4caf72", opacity: 0.7 }} />
                Given ({stats.moveCountsGiven.length})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#d45555", opacity: 0.7 }} />
                Received ({stats.moveCountsReceived.length})
              </span>
            </div>
          </div>
        );
      })()}

      {/* Material balance at checkmate */}
      {(matSlicesGiven.length > 0 || matSlicesReceived.length > 0) && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">Material balance at checkmate</p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {stats.totalGiven > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs opacity-60">When delivering</p>
                <div className="flex items-start gap-4">
                  <div className="w-28 flex-shrink-0">
                    <PieChart slices={matSlicesGiven} />
                  </div>
                  <Legend slices={matSlicesGiven} total={matSlicesGiven.reduce((s, x) => s + x.value, 0)} />
                </div>
              </div>
            )}
            {stats.totalReceived > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs opacity-60">When receiving</p>
                <div className="flex items-start gap-4">
                  <div className="w-28 flex-shrink-0">
                    <PieChart slices={matSlicesReceived} />
                  </div>
                  <Legend slices={matSlicesReceived} total={matSlicesReceived.reduce((s, x) => s + x.value, 0)} />
                </div>
              </div>
            )}
          </div>
          <p className="text-[11px] opacity-50">
            Material balance uses simple piece values (Q=9 R=5 B=3 N=3 P=1)
            evaluated from the final position.
          </p>
        </div>
      )}
    </div>
  );
}
