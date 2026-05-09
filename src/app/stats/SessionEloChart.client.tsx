import { useRef, useState } from "react";
import type { Session } from "@/lib/analytics/sessions";

type Point = {
  durationMin: number;
  eloGain: number;
  games: number;
  date: Date;
};

const W = 1020;
const H = 780;
const PAD = { top: 20, right: 20, bottom: 52, left: 60 };
const plotW = W - PAD.left - PAD.right;
const plotH = H - PAD.top - PAD.bottom;

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function tukeyFence(values: number[]): { lo: number; hi: number } {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const iqr = q3 - q1;
  return { lo: q1 - 1.5 * iqr, hi: q3 + 1.5 * iqr };
}

const TOOLTIP_WIDTH = 160;

export default function SessionEloChart({ sessions }: { sessions: Session[] }) {
  const [showOutliers, setShowOutliers] = useState(false);
  const [tooltip, setTooltip] = useState<{ point: Point; left: number; top: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  function positionTooltip(clientX: number, clientY: number): { left: number; top: number } {
    const rect = containerRef.current?.getBoundingClientRect();
    const containerWidth = containerRef.current?.offsetWidth ?? W;
    const x = rect ? clientX - rect.left : clientX;
    const y = rect ? clientY - rect.top : clientY;
    const left = x + 12 + TOOLTIP_WIDTH > containerWidth ? x - TOOLTIP_WIDTH - 12 : x + 12;
    return { left, top: y - 8 };
  }

  const allPoints: Point[] = sessions.flatMap((s) =>
    s.eloGain !== undefined
      ? [{ durationMin: s.durationMs / 60_000, eloGain: s.eloGain, games: s.games.length, date: s.startAt }]
      : []
  );

  if (allPoints.length < 3) return null;

  // Tukey's IQR fence on both axes
  const durFence = tukeyFence(allPoints.map((p) => p.durationMin));
  const eloFence = tukeyFence(allPoints.map((p) => p.eloGain));

  const isOutlier = (p: Point) =>
    p.durationMin < durFence.lo ||
    p.durationMin > durFence.hi ||
    p.eloGain < eloFence.lo ||
    p.eloGain > eloFence.hi;

  const inliers = allPoints.filter((p) => !isOutlier(p));
  const outliers = allPoints.filter((p) => isOutlier(p));
  const visiblePoints = showOutliers ? allPoints : inliers;

  const maxDur = Math.max(...visiblePoints.map((p) => p.durationMin));
  const gains = visiblePoints.map((p) => p.eloGain);
  const minGain = Math.min(...gains);
  const maxGain = Math.max(...gains);

  // Always span zero; pad each end slightly
  const yPad = Math.max(15, (maxGain - minGain) * 0.1);
  const yStep = (() => {
    const range = maxGain - minGain + 2 * yPad;
    return range <= 80 ? 20 : range <= 200 ? 50 : range <= 400 ? 100 : 200;
  })();
  const yMin = Math.floor((Math.min(0, minGain) - yPad) / yStep) * yStep;
  const yMax = Math.ceil((Math.max(0, maxGain) + yPad) / yStep) * yStep;
  const yRange = yMax - yMin || 1;

  const xMax = maxDur * 1.06 || 60;

  function sx(dur: number) {
    return PAD.left + (dur / xMax) * plotW;
  }
  function sy(gain: number) {
    return PAD.top + (1 - (gain - yMin) / yRange) * plotH;
  }

  // Y ticks
  const yTicks: number[] = [];
  for (let y = yMin; y <= yMax; y += yStep) yTicks.push(y);

  // X ticks: 5 evenly spaced
  const xTicks: number[] = [];
  const xStep = xMax / 5;
  for (let i = 1; i <= 5; i++) xTicks.push(i * xStep);

  // Linear regression from visible points
  const n = visiblePoints.length;
  const sumX = visiblePoints.reduce((s, p) => s + p.durationMin, 0);
  const sumY = visiblePoints.reduce((s, p) => s + p.eloGain, 0);
  const sumXY = visiblePoints.reduce((s, p) => s + p.durationMin * p.eloGain, 0);
  const sumX2 = visiblePoints.reduce((s, p) => s + p.durationMin * p.durationMin, 0);
  const denom = n * sumX2 - sumX * sumX;
  const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  const intercept = (sumY - slope * sumX) / n;

  function regressionPoint(x: number): { x: number; y: number } | null {
    const yVal = slope * x + intercept;
    if (yVal < yMin || yVal > yMax) return null;
    return { x: sx(x), y: sy(yVal) };
  }
  const regStart = regressionPoint(0);
  const regEnd = regressionPoint(xMax);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const pos = positionTooltip(e.clientX, e.clientY);
    setTooltip((prev) => (prev ? { ...prev, ...pos } : null));
  }

  function handleCircleEnter(e: React.MouseEvent<SVGCircleElement>, point: Point) {
    const pos = positionTooltip(e.clientX, e.clientY);
    setTooltip({ point, ...pos });
  }

  return (
    <div ref={containerRef} className="relative" onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)}>
      <button
        onClick={() => setShowOutliers((v) => !v)}
        className={[
          "absolute top-0 right-0 px-3 py-1 text-xs rounded border transition-colors",
          showOutliers
            ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
            : "border-[var(--foreground)] text-[var(--foreground)] opacity-60 hover:opacity-100",
        ].join(" ")}
      >
        {showOutliers ? "Hide Outliers" : "Show Outliers"}
        {outliers.length > 0 && (
          <span className="ml-1 opacity-70">({outliers.length})</span>
        )}
      </button>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ maxHeight: H }}
        aria-label="Session duration vs ELO gain/loss scatter chart"
      >
        {/* Y gridlines + labels */}
        {yTicks.map((y) => (
          <g key={y}>
            <line
              x1={PAD.left}
              y1={sy(y)}
              x2={W - PAD.right}
              y2={sy(y)}
              stroke="currentColor"
              strokeOpacity={y === 0 ? 0.35 : 0.1}
              strokeWidth={y === 0 ? 1.5 : 1}
              strokeDasharray={y === 0 ? undefined : "3 3"}
            />
            <text
              x={PAD.left - 7}
              y={sy(y) + 4}
              textAnchor="end"
              fontSize={11}
              fill="currentColor"
              opacity={0.65}
            >
              {y > 0 ? `+${y}` : y}
            </text>
          </g>
        ))}

        {/* X gridlines + labels */}
        {xTicks.map((t) => (
          <g key={t}>
            <line
              x1={sx(t)}
              y1={PAD.top}
              x2={sx(t)}
              y2={H - PAD.bottom}
              stroke="currentColor"
              strokeOpacity={0.08}
              strokeWidth={1}
            />
            <text
              x={sx(t)}
              y={H - PAD.bottom + 15}
              textAnchor="middle"
              fontSize={11}
              fill="currentColor"
              opacity={0.65}
            >
              {formatDuration(t)}
            </text>
          </g>
        ))}

        {/* Axes */}
        <line
          x1={PAD.left} y1={PAD.top}
          x2={PAD.left} y2={H - PAD.bottom}
          stroke="currentColor" strokeOpacity={0.35} strokeWidth={1}
        />
        <line
          x1={PAD.left} y1={H - PAD.bottom}
          x2={W - PAD.right} y2={H - PAD.bottom}
          stroke="currentColor" strokeOpacity={0.35} strokeWidth={1}
        />

        {/* Axis labels */}
        <text
          x={PAD.left + plotW / 2}
          y={H - 6}
          textAnchor="middle"
          fontSize={11}
          fill="currentColor"
          opacity={0.6}
        >
          Session duration
        </text>
        <text
          x={12}
          y={PAD.top + plotH / 2}
          textAnchor="middle"
          fontSize={11}
          fill="currentColor"
          opacity={0.6}
          transform={`rotate(-90, 12, ${PAD.top + plotH / 2})`}
        >
          ELO change
        </text>

        {/* Line of best fit */}
        {regStart && regEnd && (
          <line
            x1={regStart.x}
            y1={regStart.y}
            x2={regEnd.x}
            y2={regEnd.y}
            stroke={slope >= 0 ? "#4caf72" : "#d45555"}
            strokeOpacity={0.6}
            strokeWidth={2}
            strokeDasharray="6 3"
          />
        )}

        {/* Outlier points (shown as hollow circles with muted colour) */}
        {showOutliers &&
          outliers.map((p, i) => {
            const cx = sx(p.durationMin);
            const cy = sy(p.eloGain);
            // Only render if within the plot area
            if (
              cx < PAD.left || cx > W - PAD.right ||
              cy < PAD.top || cy > H - PAD.bottom
            )
              return null;
            return (
              <circle
                key={`out-${i}`}
                cx={cx}
                cy={cy}
                r={5}
                fill="transparent"
                stroke={p.eloGain > 0 ? "#4caf72" : p.eloGain < 0 ? "#d45555" : "currentColor"}
                strokeOpacity={0.5}
                strokeWidth={1.5}
                style={{ cursor: "pointer" }}
                onMouseEnter={(e) => handleCircleEnter(e, p)}
                onMouseLeave={() => setTooltip(null)}
              />
            );
          })}

        {/* Inlier data points */}
        {inliers.map((p, i) => (
          <circle
            key={`in-${i}`}
            cx={sx(p.durationMin)}
            cy={sy(p.eloGain)}
            r={5}
            fill={p.eloGain > 0 ? "#4caf72" : p.eloGain < 0 ? "#d45555" : "currentColor"}
            opacity={0.7}
            style={{ cursor: "pointer" }}
            onMouseEnter={(e) => handleCircleEnter(e, p)}
            onMouseLeave={() => setTooltip(null)}
          />
        ))}
      </svg>

      {tooltip && (() => {
        const { point, left, top } = tooltip;
        const eloLabel = point.eloGain > 0 ? `+${point.eloGain}` : String(point.eloGain);
        const dateLabel = point.date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
        return (
          <div
            style={{ left, top, width: TOOLTIP_WIDTH, pointerEvents: "none" }}
            className="absolute z-10 rounded-md border border-[var(--foreground)] bg-[var(--background)] px-3 py-2 text-xs shadow-lg opacity-90"
          >
            <div className="font-semibold mb-0.5 opacity-80">{dateLabel}</div>
            <div className="mb-1 opacity-50">{point.date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</div>
            <div className="flex justify-between gap-2">
              <span className="opacity-60">Duration</span>
              <span>{formatDuration(point.durationMin)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="opacity-60">ELO</span>
              <span style={{ color: point.eloGain > 0 ? "#4caf72" : point.eloGain < 0 ? "#d45555" : undefined }}>
                {eloLabel}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="opacity-60">Games</span>
              <span>{point.games}</span>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
