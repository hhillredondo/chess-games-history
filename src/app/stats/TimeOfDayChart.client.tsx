"use client";

import type { TimeOfDayRow } from "@/lib/analytics/time-of-day";

const W = 720;
const H = 330;
const PAD = { top: 20, right: 16, bottom: 52, left: 44 };
const plotW = W - PAD.left - PAD.right;
const plotH = H - PAD.top - PAD.bottom;

const BUCKETS = 4;
const slotW = plotW / BUCKETS;
const barW = slotW * 0.55;

export default function TimeOfDayChart({
  rows,
}: Readonly<{ rows: TimeOfDayRow[] }>) {
  const maxGames = Math.max(...rows.map((r) => r.games), 1);
  const yTickCount = 4;
  const yStep = Math.ceil(maxGames / yTickCount) || 1;
  const yAxisMax = yStep * yTickCount;
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => i * yStep);

  function sy(v: number) {
    return PAD.top + (1 - Math.min(v, yAxisMax) / yAxisMax) * plotH;
  }

  return (
    <div className="flex flex-col gap-4">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ maxWidth: W, maxHeight: H }}
        aria-label="Games by time of day bar chart"
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

        {/* Bars (stacked W/D/L) + labels */}
        {rows.map((row, i) => {
          const bx = PAD.left + i * slotW + (slotW - barW) / 2;
          const wH = sy(0) - sy(row.wins);
          const dH = sy(0) - sy(row.draws);
          const lH = sy(0) - sy(row.losses);

          return (
            <g key={row.id}>
              {row.losses > 0 && (
                <rect
                  x={bx}
                  y={sy(row.losses)}
                  width={barW}
                  height={lH}
                  fill="#d45555"
                  opacity={0.7}
                  rx={3}
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
                  rx={3}
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
                  rx={3}
                />
              )}
              {/* Label: name */}
              <text
                x={bx + barW / 2}
                y={H - PAD.bottom + 13}
                textAnchor="middle"
                fontSize={10}
                fill="currentColor"
                opacity={0.75}
              >
                {row.label}
              </text>
              {/* Label: hours */}
              <text
                x={bx + barW / 2}
                y={H - PAD.bottom + 25}
                textAnchor="middle"
                fontSize={9}
                fill="currentColor"
                opacity={0.45}
              >
                {row.range}
              </text>
              {/* Win rate on top */}
              {row.winRate != null && row.games > 0 && (
                <text
                  x={bx + barW / 2}
                  y={sy(row.games) - 5}
                  textAnchor="middle"
                  fontSize={9}
                  fill="currentColor"
                  opacity={0.7}
                >
                  {Math.round(row.winRate * 100)}%
                </text>
              )}
            </g>
          );
        })}

        {/* Legend */}
        {[
          { fill: "#4caf72", label: "Win" },
          { fill: "currentColor", label: "Draw", opacity: 0.25 },
          { fill: "#d45555", label: "Loss" },
        ].map(({ fill, label, opacity = 0.7 }, idx) => (
          <g
            key={label}
            transform={`translate(${PAD.left + idx * 55}, ${H - 10})`}
          >
            <rect width={10} height={10} fill={fill} opacity={opacity} rx={2} />
            <text x={14} y={9} fontSize={9} fill="currentColor" opacity={0.65}>
              {label}
            </text>
          </g>
        ))}
      </svg>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--foreground)]/30">
              {["Period", "Games", "Win%", "W", "D", "L"].map((h) => (
                <th
                  key={h}
                  className={`py-1.5 font-medium text-xs opacity-60 ${h === "Period" ? "text-left pr-4" : "text-right px-2"}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-[var(--foreground)]/10"
              >
                <td className="py-1.5 pr-4 text-xs">
                  {row.label}{" "}
                  <span className="opacity-50">{row.range}</span>
                </td>
                <td className="py-1.5 px-2 text-right font-mono tabular-nums text-xs">
                  {row.games}
                </td>
                <td className="py-1.5 px-2 text-right font-mono tabular-nums text-xs">
                  {row.winRate != null
                    ? `${Math.round(row.winRate * 100)}%`
                    : "—"}
                </td>
                <td className="py-1.5 px-2 text-right font-mono tabular-nums text-xs">
                  {row.wins}
                </td>
                <td className="py-1.5 px-2 text-right font-mono tabular-nums text-xs">
                  {row.draws}
                </td>
                <td className="py-1.5 pl-2 text-right font-mono tabular-nums text-xs">
                  {row.losses}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] opacity-55">
        Buckets use your local browser time at the end of each game.
      </p>
    </div>
  );
}
