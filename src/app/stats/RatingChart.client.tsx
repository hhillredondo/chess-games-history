import type { RatingPoint } from "@/lib/analytics/ratings";

const PLATFORM_COLORS: Record<string, string> = {
  chesscom: "#e07030",
  lichess: "#3070e0",
};

const W = 1200;
const H = 420;
const PAD = { top: 20, right: 20, bottom: 50, left: 60 };
const plotW = W - PAD.left - PAD.right;
const plotH = H - PAD.top - PAD.bottom;

export default function RatingChart({ points }: { points: RatingPoint[] }) {
  if (points.length < 2) return null;

  const times = points.map((p) => new Date(p.date).getTime());
  const ratings = points.map((p) => p.rating);
  const minT = Math.min(...times);
  const maxT = Math.max(...times);
  const rawMin = Math.min(...ratings);
  const rawMax = Math.max(...ratings);

  const rPad = Math.max(50, (rawMax - rawMin) * 0.1);
  const rMin = Math.floor((rawMin - rPad) / 50) * 50;
  const rMax = Math.ceil((rawMax + rPad) / 50) * 50;
  const rRange = rMax - rMin || 1;
  const tRange = maxT - minT || 1;

  function sx(t: number): number {
    return PAD.left + ((t - minT) / tRange) * plotW;
  }
  function sy(r: number): number {
    return PAD.top + (1 - (r - rMin) / rRange) * plotH;
  }

  // Y ticks at nice intervals
  const rRange_ = rMax - rMin;
  const rStep = rRange_ <= 400 ? 50 : rRange_ <= 800 ? 100 : 200;
  const yTicks: number[] = [];
  for (let r = Math.ceil(rMin / rStep) * rStep; r <= rMax; r += rStep) {
    yTicks.push(r);
  }

  // X ticks: years, or months if range < ~18 months
  const rangeMs = maxT - minT;
  const useMonths = rangeMs < 1000 * 60 * 60 * 24 * 548; // ~18 months
  const xTicks: Date[] = [];
  if (useMonths) {
    const d = new Date(minT);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    while (d.getTime() <= maxT) {
      if (d.getTime() >= minT) xTicks.push(new Date(d));
      d.setMonth(d.getMonth() + 1);
    }
  } else {
    const minYear = new Date(minT).getFullYear();
    const maxYear = new Date(maxT).getFullYear();
    for (let y = minYear; y <= maxYear; y++) {
      const d = new Date(y, 0, 1);
      if (d.getTime() >= minT && d.getTime() <= maxT) xTicks.push(d);
    }
  }

  const platforms = [...new Set(points.map((p) => p.source))];

  function toPath(pts: RatingPoint[]): string {
    return pts
      .map((p, i) => {
        const x = sx(new Date(p.date).getTime()).toFixed(1);
        const y = sy(p.rating).toFixed(1);
        return `${i === 0 ? "M" : "L"}${x} ${y}`;
      })
      .join(" ");
  }

  return (
    <div className="w-full">
      {platforms.length > 1 && (
        <div className="flex gap-5 mb-3 text-sm">
          {platforms.map((src) => (
            <span key={src} className="flex items-center gap-2">
              <svg width={20} height={10} aria-hidden>
                <line
                  x1={0}
                  y1={5}
                  x2={20}
                  y2={5}
                  stroke={PLATFORM_COLORS[src] ?? "#888"}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                />
              </svg>
              {src === "chesscom" ? "Chess.com" : "Lichess"}
            </span>
          ))}
        </div>
      )}

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ maxHeight: H }}
        aria-label="Rating trend over time"
      >
        {/* Horizontal gridlines + y-axis labels */}
        {yTicks.map((r) => (
          <g key={r}>
            <line
              x1={PAD.left}
              y1={sy(r)}
              x2={W - PAD.right}
              y2={sy(r)}
              stroke="currentColor"
              strokeOpacity={0.12}
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={sy(r) + 4}
              textAnchor="end"
              fontSize={11}
              fill="currentColor"
              opacity={0.65}
            >
              {r}
            </text>
          </g>
        ))}

        {/* Vertical gridlines + x-axis labels */}
        {xTicks.map((d) => {
          const tx = sx(d.getTime());
          const label = useMonths
            ? d.toLocaleDateString(undefined, { month: "short", year: "2-digit" })
            : String(d.getFullYear());
          return (
            <g key={d.getTime()}>
              <line
                x1={tx}
                y1={PAD.top}
                x2={tx}
                y2={H - PAD.bottom}
                stroke="currentColor"
                strokeOpacity={0.1}
                strokeWidth={1}
              />
              <text
                x={tx}
                y={H - PAD.bottom + 16}
                textAnchor="middle"
                fontSize={11}
                fill="currentColor"
                opacity={0.65}
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* Axes */}
        <line
          x1={PAD.left}
          y1={PAD.top}
          x2={PAD.left}
          y2={H - PAD.bottom}
          stroke="currentColor"
          strokeOpacity={0.35}
          strokeWidth={1}
        />
        <line
          x1={PAD.left}
          y1={H - PAD.bottom}
          x2={W - PAD.right}
          y2={H - PAD.bottom}
          stroke="currentColor"
          strokeOpacity={0.35}
          strokeWidth={1}
        />

        {/* Data lines per platform */}
        {platforms.map((src) => (
          <path
            key={src}
            d={toPath(points.filter((p) => p.source === src))}
            fill="none"
            stroke={PLATFORM_COLORS[src] ?? "#888"}
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={0.85}
          />
        ))}
      </svg>
    </div>
  );
}
