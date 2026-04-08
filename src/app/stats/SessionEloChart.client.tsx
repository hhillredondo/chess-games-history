"use client";

import type { Session } from "@/lib/analytics/sessions";

const W = 680;
const H = 520;
const PAD = { top: 20, right: 20, bottom: 52, left: 60 };
const plotW = W - PAD.left - PAD.right;
const plotH = H - PAD.top - PAD.bottom;

export default function SessionEloChart({ sessions }: { sessions: Session[] }) {
  const points = sessions.flatMap((s) =>
    s.eloGain !== undefined
      ? [{ durationMin: s.durationMs / 60_000, eloGain: s.eloGain, games: s.games.length, date: s.startAt }]
      : []
  );

  if (points.length < 3) return null;

  const maxDur = Math.max(...points.map((p) => p.durationMin));
  const gains = points.map((p) => p.eloGain);
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
  const showHours = xMax > 120;

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

  // Linear regression (least squares): gain = slope * dur + intercept
  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.durationMin, 0);
  const sumY = points.reduce((s, p) => s + p.eloGain, 0);
  const sumXY = points.reduce((s, p) => s + p.durationMin * p.eloGain, 0);
  const sumX2 = points.reduce((s, p) => s + p.durationMin * p.durationMin, 0);
  const denom = n * sumX2 - sumX * sumX;
  const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  const intercept = (sumY - slope * sumX) / n;

  // Clamp regression line endpoints to the y domain so it doesn't escape the plot
  function regressionPoint(x: number): { x: number; y: number } | null {
    const yVal = slope * x + intercept;
    if (yVal < yMin || yVal > yMax) return null;
    return { x: sx(x), y: sy(yVal) };
  }
  const regStart = regressionPoint(0);
  const regEnd = regressionPoint(xMax);

  return (
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
            {showHours
              ? `${(t / 60).toFixed(1)}h`
              : `${Math.round(t)}m`}
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
        {showHours ? "Session duration (hours)" : "Session duration (minutes)"}
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

      {/* Data points */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={sx(p.durationMin)}
          cy={sy(p.eloGain)}
          r={5}
          fill={p.eloGain > 0 ? "#4caf72" : p.eloGain < 0 ? "#d45555" : "currentColor"}
          opacity={0.7}
        />
      ))}
    </svg>
  );
}
