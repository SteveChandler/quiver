import { CHART_GRID, CHART_INK, CHART_MUTED, CHART_SERIES } from "@/components/best-time-to-surf/buoy-record/chart-theme";
import { compassPoint, formatCoordinate, formatHeightFt, formatPeriod, metersToFeetRounded } from "@/lib/buoy-pages/format";
import { MODEL_NAME } from "@/lib/buoy-pages/model-at-buoy";
import type { ModelBlock } from "@/lib/buoy-pages/station-page-data";

const WIDTH = 720;
const HEIGHT = 220;
const LEFT = 44;
const RIGHT = 12;
const TOP = 14;
const BOTTOM = 26;
const HOUR_MS = 3_600_000;

interface ModelVsObservedProps {
  model: ModelBlock;
  timeZone: string;
  stationName: string;
}

function midnights(start: number, end: number, timeZone: string): number[] {
  const hourOf = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" });
  const ticks: number[] = [];
  for (let t = Math.ceil(start / HOUR_MS) * HOUR_MS; t <= end; t += HOUR_MS) {
    if (hourOf.formatToParts(new Date(t)).find((part) => part.type === "hour")?.value === "0") ticks.push(t);
  }
  return ticks;
}

/** Model at the buoy against what the buoy measured, then the model ahead. */
export function ModelVsObserved({ model, timeZone, stationName }: ModelVsObservedProps) {
  const modelHours = model.hours.filter((hour) => hour.hs !== null);
  const start = Math.min(modelHours[0]?.t ?? model.splitAt, model.observed[0]?.t ?? model.splitAt);
  const end = modelHours[modelHours.length - 1]?.t ?? model.splitAt;
  const span = Math.max(1, end - start);
  const x = (t: number) => LEFT + ((t - start) / span) * (WIDTH - LEFT - RIGHT);
  const feet = [
    ...modelHours.map((hour) => metersToFeetRounded(hour.hs as number)),
    ...model.observed.map((obs) => metersToFeetRounded(obs.hs)),
  ];
  const max = Math.max(4, Math.ceil(Math.max(0, ...feet) / 2) * 2);
  const plot = HEIGHT - TOP - BOTTOM;
  const y = (ft: number) => TOP + plot * (1 - ft / max);
  const pathFor = (hours: typeof modelHours) =>
    hours.map((hour, index) => `${index === 0 ? "M" : "L"}${x(hour.t).toFixed(1)},${y(metersToFeetRounded(hour.hs as number)).toFixed(1)}`).join("");
  const past = modelHours.filter((hour) => hour.t <= model.splitAt);
  const ahead = modelHours.filter((hour) => hour.t >= (past[past.length - 1]?.t ?? model.splitAt));
  const dayLabel = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", day: "numeric" });
  const yTicks = Array.from({ length: max / 2 }, (_, index) => (index + 1) * 2);

  return (
    <div data-testid="buoy-model-block">
      <div className="overflow-x-auto border-2 border-[#11100D] bg-[#FFFDF7] p-3">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full min-w-[540px]"
          role="img"
          aria-label={`${MODEL_NAME} model wave height at ${stationName} against the buoy's readings, then the model forecast`}
        >
          {yTicks.map((tick) => (
            <g key={tick}>
              <line x1={LEFT} x2={WIDTH - RIGHT} y1={y(tick)} y2={y(tick)} stroke={CHART_GRID} />
              <text x={LEFT - 6} y={y(tick) + 4} textAnchor="end" fontSize={11} fill={CHART_MUTED}>{`${tick} ft`}</text>
            </g>
          ))}
          {midnights(start, end, timeZone).map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={TOP} y2={y(0)} stroke={CHART_GRID} />
              <text x={x(t)} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill={CHART_MUTED}>
                {dayLabel.format(new Date(t))}
              </text>
            </g>
          ))}
          <line x1={LEFT} x2={WIDTH - RIGHT} y1={y(0)} y2={y(0)} stroke={CHART_INK} strokeOpacity={0.4} />
          <rect x={x(model.splitAt)} y={TOP} width={Math.max(0, WIDTH - RIGHT - x(model.splitAt))} height={plot} fill="#11100D" fillOpacity={0.04} />
          <line x1={x(model.splitAt)} x2={x(model.splitAt)} y1={TOP} y2={y(0)} stroke={CHART_INK} strokeDasharray="2 3" />
          <text x={x(model.splitAt) + 4} y={TOP + 11} fontSize={11} fill={CHART_MUTED}>forecast</text>
          <path d={pathFor(past)} fill="none" stroke={CHART_INK} strokeWidth={2} />
          <path d={pathFor(ahead)} fill="none" stroke={CHART_INK} strokeWidth={2} strokeDasharray="6 4" />
          {model.observed.map((obs) => (
            <circle key={obs.t} cx={x(obs.t)} cy={y(metersToFeetRounded(obs.hs))} r={2.2} fill={CHART_SERIES} />
          ))}
        </svg>
        <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#11100D]/75">
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: CHART_SERIES }} />
            Buoy, hourly
          </li>
          <li className="inline-flex items-center gap-1.5">
            <svg width="18" height="6" aria-hidden><line x1="0" x2="18" y1="3" y2="3" stroke={CHART_INK} strokeWidth="2" /></svg>
            Model, past days
          </li>
          <li className="inline-flex items-center gap-1.5">
            <svg width="18" height="6" aria-hidden><line x1="0" x2="18" y1="3" y2="3" stroke={CHART_INK} strokeWidth="2" strokeDasharray="4 3" /></svg>
            Model forecast
          </li>
        </ul>
      </div>
      {model.comparisonText ? (
        <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[#11100D]" data-testid="buoy-model-comparison">
          {model.comparisonText}
        </p>
      ) : null}
      {model.peaks.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <caption className="mb-2 text-left font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#11100D]/60">
              Model peak each day at the buoy
            </caption>
            <thead>
              <tr className="border-b-2 border-[#11100D] text-left font-mono text-[11px] uppercase tracking-[0.12em] text-[#11100D]/60">
                <th className="py-1.5 pr-3 font-bold">Day</th>
                <th className="py-1.5 pr-3 font-bold">Height</th>
                <th className="py-1.5 pr-3 font-bold">Peak period</th>
                <th className="py-1.5 font-bold">From</th>
              </tr>
            </thead>
            <tbody>
              {model.peaks.map((peak) => (
                <tr key={peak.day} className="border-b border-[#11100D]/15">
                  <td className="py-1.5 pr-3">{peak.label}</td>
                  <td className="py-1.5 pr-3 font-mono">{formatHeightFt(peak.hs)}</td>
                  <td className="py-1.5 pr-3 font-mono">{formatPeriod(peak.tp) ?? "—"}</td>
                  <td className="py-1.5">{compassPoint(peak.dir) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className="mt-3 max-w-3xl text-xs leading-5 text-[#655C4C]">
        {`${MODEL_NAME} wave model via Open-Meteo, nearest model cell (${formatCoordinate(model.gridLat, "lat")}, ${formatCoordinate(model.gridLon, "lon")}). Both lines are significant wave height at sea, the same measure the buoy reports. Model output, not a Quiver beach forecast.`}
      </p>
    </div>
  );
}
