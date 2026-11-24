import { synthesizeFromExtrema, type InternalPoint } from "@/components/forecast/tide-chart/tide-chart-helpers";
import { formatDateKey } from "@/lib/tide-stations/format";
import { localDateKey, metresToFeet, type TideDay, type TideExtremePoint, type TideHeightPoint } from "@/lib/tide-stations/series";

interface TideStationCurveProps {
  hourly: TideHeightPoint[];
  extremes: TideExtremePoint[];
  days: TideDay[];
  timeZone: string;
}

const WIDTH = 980;
const HEIGHT = 220;
const PAD = { top: 18, right: 12, bottom: 30, left: 40 };

/** Server-drawn seven-day curve; every label is in the station's own time zone. */
export function TideStationCurve({ hourly, extremes, days, timeZone }: TideStationCurveProps) {
  if (!days.length) return null;
  const dayKeys = new Set(days.map((d) => d.dateKey));
  const inWindow = (ts: string) => dayKeys.has(localDateKey(ts, timeZone));

  // Subordinate stations publish only highs and lows; draw between them the way the beach tide chart does.
  const source: Array<{ ms: number; ft: number }> = hourly.length
    ? hourly.map((p) => ({ ms: Date.parse(p.ts), ft: metresToFeet(p.heightM) }))
    : synthesizeFromExtrema(
        extremes.map<InternalPoint>((e) => ({
          t: e.ts,
          timestamp: Date.parse(e.ts),
          h: metresToFeet(e.heightM),
          isHigh: e.type === "high",
          isLow: e.type === "low",
        }))
      ).map((p) => ({ ms: p.timestamp, ft: p.h }));

  const points = source.filter((p) => inWindow(new Date(p.ms).toISOString()));
  const marks = extremes.filter((e) => inWindow(e.ts));
  if (points.length < 2) return null;

  const minMs = points[0].ms;
  const maxMs = points[points.length - 1].ms;
  const heights = [...points.map((p) => p.ft), ...marks.map((m) => metresToFeet(m.heightM))];
  const low = Math.floor(Math.min(...heights));
  const high = Math.ceil(Math.max(...heights));
  const span = Math.max(1, high - low);

  const x = (ms: number) => PAD.left + ((ms - minMs) / Math.max(1, maxMs - minMs)) * (WIDTH - PAD.left - PAD.right);
  const y = (ft: number) => PAD.top + (1 - (ft - low) / span) * (HEIGHT - PAD.top - PAD.bottom);

  const path = points.map((p, i) => `${i ? "L" : "M"}${x(p.ms).toFixed(1)},${y(p.ft).toFixed(1)}`).join(" ");
  const area = `${path} L${x(maxMs).toFixed(1)},${y(low).toFixed(1)} L${x(minMs).toFixed(1)},${y(low).toFixed(1)} Z`;

  // First curve point of each local day marks the day boundary.
  const dayStarts = days
    .map((day) => ({ day, point: points.find((p) => localDateKey(p.ms, timeZone) === day.dateKey) }))
    .filter((d): d is { day: TideDay; point: { ms: number; ft: number } } => Boolean(d.point));

  const step = span > 8 ? 2 : 1;
  const yTicks: number[] = [];
  for (let v = low; v <= high; v += step) yTicks.push(v);

  return (
    <figure className="border-2 border-[#11100D] bg-[#FBF6E8] p-3" data-testid="tide-station-curve">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Seven-day tide curve in feet, highs and lows marked"
        className="h-auto w-full"
      >
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(v)} y2={y(v)} stroke="#11100D" strokeOpacity={0.12} />
            <text x={PAD.left - 6} y={y(v) + 4} textAnchor="end" fontSize={11} fill="#11100D" fillOpacity={0.7}>
              {v}
            </text>
          </g>
        ))}
        {dayStarts.map(({ day, point }) => (
          <g key={day.dateKey}>
            <line x1={x(point.ms)} x2={x(point.ms)} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke="#11100D" strokeOpacity={0.25} strokeDasharray="3 4" />
            <text x={x(point.ms) + 4} y={HEIGHT - 10} fontSize={11} fill="#11100D" fillOpacity={0.75}>
              {formatDateKey(day.dateKey)}
            </text>
          </g>
        ))}
        <path d={area} fill="#7FA7B8" fillOpacity={0.28} />
        <path d={path} fill="none" stroke="#11100D" strokeWidth={2} />
        {marks.map((m) => (
          <circle
            key={m.ts}
            cx={x(Date.parse(m.ts))}
            cy={y(metresToFeet(m.heightM))}
            r={3.5}
            fill={m.type === "high" ? "#F78E42" : "#11100D"}
          />
        ))}
      </svg>
      <figcaption className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-[#11100D]/60">
        Feet · orange dots are highs, black dots are lows
      </figcaption>
    </figure>
  );
}
