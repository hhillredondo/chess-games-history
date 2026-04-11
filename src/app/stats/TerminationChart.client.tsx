"use client";

import { useState } from "react";
import type { TerminationRow } from "@/lib/analytics/termination-stats";

const W = 960;
const H = 420;
const PAD = { top: 20, right: 16, bottom: 60, left: 44 };
const plotW = W - PAD.left - PAD.right;
const plotH = H - PAD.top - PAD.bottom;

type Mode = "stacked" | "grouped";

export default function TerminationChart({
  rows,
}: Readonly<{ rows: TerminationRow[] }>) {
  const [mode, setMode] = useState<Mode>("stacked");
  const [tooltip, setTooltip] = useState<{
    row: TerminationRow;
    left: number;
    top: number;
  } | null>(null);

  if (rows.length === 0)
    return <p className="text-sm opacity-60">No termination data.</p>;

  const maxTotal = Math.max(...rows.map((r) => r.total), 1);
  const maxStacked = maxTotal;
  const maxGrouped = Math.max(...rows.flatMap((r) => [r.wins, r.losses, r.draws]), 1);
  const yMax = mode === "stacked" ? maxStacked : maxGrouped;

  const slotW = plotW / rows.length;
  const barW = mode === "stacked" ? slotW * 0.55 : (slotW * 0.55) / 3;
  const yTickCount = 4;
  const yStep = Math.ceil(yMax / yTickCount) || 1;
  const yAxisMax = yStep * yTickCount;
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => i * yStep);

  function sy(v: number) {
    return PAD.top + (1 - Math.min(v, yAxisMax) / yAxisMax) * plotH;
  }

  function barX(rowIdx: number, subIdx = 0) {
    const slotStart = PAD.left + rowIdx * slotW;
    if (mode === "stacked") return slotStart + (slotW - barW) / 2;
    const groupW = barW * 3 + 2;
    return slotStart + (slotW - groupW) / 2 + subIdx * (barW + 1);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {(["stacked", "grouped"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded border px-2.5 py-1 font-mono text-xs transition-colors ${
              mode === m
                ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                : "border-[var(--foreground)]/40 opacity-70 hover:opacity-100"
            }`}
          >
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>

      <div
        className="relative w-full"
        onMouseLeave={() => setTooltip(null)}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ maxHeight: H }}
          aria-label="Game termination breakdown bar chart"
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

          {/* Axis */}
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
            if (mode === "stacked") {
              const x = barX(i);
              const wH = sy(0) - sy(row.wins);
              const dH = sy(0) - sy(row.draws);
              const lH = sy(0) - sy(row.losses);
              const wY = sy(row.wins + row.losses + row.draws);
              const dY = sy(row.losses + row.draws);
              const lY = sy(row.losses);
              return (
                <g
                  key={row.bucket}
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
                      x={x}
                      y={lY}
                      width={barW}
                      height={lH}
                      fill="#d45555"
                      opacity={0.75}
                      rx={2}
                    />
                  )}
                  {row.draws > 0 && (
                    <rect
                      x={x}
                      y={dY}
                      width={barW}
                      height={dH}
                      fill="currentColor"
                      opacity={0.3}
                      rx={2}
                    />
                  )}
                  {row.wins > 0 && (
                    <rect
                      x={x}
                      y={wY}
                      width={barW}
                      height={wH}
                      fill="#4caf72"
                      opacity={0.75}
                      rx={2}
                    />
                  )}
                </g>
              );
            }
            // grouped
            return (
              <g key={row.bucket}>
                {/* Wins */}
                {row.wins > 0 && (
                  <rect
                    x={barX(i, 0)}
                    y={sy(row.wins)}
                    width={barW}
                    height={sy(0) - sy(row.wins)}
                    fill="#4caf72"
                    opacity={0.75}
                    rx={2}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={(e) => {
                      const rect2 = (
                        e.currentTarget.ownerSVGElement!
                          .parentElement as HTMLElement
                      ).getBoundingClientRect();
                      setTooltip({
                        row,
                        left: e.clientX - rect2.left + 10,
                        top: e.clientY - rect2.top - 10,
                      });
                    }}
                  />
                )}
                {/* Draws */}
                {row.draws > 0 && (
                  <rect
                    x={barX(i, 1)}
                    y={sy(row.draws)}
                    width={barW}
                    height={sy(0) - sy(row.draws)}
                    fill="currentColor"
                    opacity={0.3}
                    rx={2}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={(e) => {
                      const rect2 = (
                        e.currentTarget.ownerSVGElement!
                          .parentElement as HTMLElement
                      ).getBoundingClientRect();
                      setTooltip({
                        row,
                        left: e.clientX - rect2.left + 10,
                        top: e.clientY - rect2.top - 10,
                      });
                    }}
                  />
                )}
                {/* Losses */}
                {row.losses > 0 && (
                  <rect
                    x={barX(i, 2)}
                    y={sy(row.losses)}
                    width={barW}
                    height={sy(0) - sy(row.losses)}
                    fill="#d45555"
                    opacity={0.75}
                    rx={2}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={(e) => {
                      const rect2 = (
                        e.currentTarget.ownerSVGElement!
                          .parentElement as HTMLElement
                      ).getBoundingClientRect();
                      setTooltip({
                        row,
                        left: e.clientX - rect2.left + 10,
                        top: e.clientY - rect2.top - 10,
                      });
                    }}
                  />
                )}
              </g>
            );
          })}

          {/* X labels */}
          {rows.map((row, i) => (
            <text
              key={`label-${row.bucket}`}
              x={PAD.left + i * slotW + slotW / 2}
              y={H - PAD.bottom + 14}
              textAnchor="middle"
              fontSize={9}
              fill="currentColor"
              opacity={0.7}
            >
              {row.label}
            </text>
          ))}

          {/* Legend */}
          {[
            { fill: "#4caf72", label: "Win" },
            { fill: "currentColor", label: "Draw", opacity: 0.3 },
            { fill: "#d45555", label: "Loss" },
          ].map(({ fill, label, opacity = 0.75 }, idx) => (
            <g key={label} transform={`translate(${PAD.left + idx * 60}, ${H - 14})`}>
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
              minWidth: 140,
            }}
            className="absolute z-10 rounded-md border border-[var(--foreground)] bg-[var(--background)] px-3 py-2 text-xs shadow-lg opacity-90"
          >
            <div className="mb-1 font-semibold opacity-80">{tooltip.row.label}</div>
            <div className="flex justify-between gap-3">
              <span className="opacity-60">Total</span>
              <span>{tooltip.row.total}</span>
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
