import type { SeasonMonthView } from "@/lib/climatology/season-view";
import { CHART_GRID, CHART_INK, CHART_MUTED, CHART_SERIES } from "./chart-theme";

const WIDTH = 720;
const HEIGHT = 220;
const LEFT = 40;
const TOP = 16;
const BOTTOM = 28;
const PLOT_HEIGHT = HEIGHT - TOP - BOTTOM;
const STEP = (WIDTH - LEFT) / 12;
const BAR_WIDTH = 14;

interface WaveRangeChartProps {
  months: SeasonMonthView[];
  stationName: string;
  chartId: string;
}

export function WaveRangeChart({ months, stationName, chartId }: WaveRangeChartProps) {
  const titleId = `${chartId}-title`;
  const p90s = months.flatMap((month) => (month.waves ? [month.waves.hsFt.p90] : []));
  // Round the axis up to an even number of feet, never below 4 ft.
  const maxFt = Math.max(4, Math.ceil(Math.max(0, ...p90s) / 2) * 2);
  const y = (ft: number): number => TOP + PLOT_HEIGHT * (1 - ft / maxFt);
  const ticks = Array.from({ length: maxFt / 2 }, (_, index) => (index + 1) * 2);
  const summary = months
    .map((month) => (month.waves ? `${month.abbrev} median ${month.waves.hsFt.median} ft` : `${month.abbrev} n/a`))
    .join(", ");

  return (
    <figure>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-labelledby={titleId}>
        <title id={titleId}>{`Buoy wave height by month at ${stationName}: ${summary}`}</title>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={LEFT} x2={WIDTH} y1={y(tick)} y2={y(tick)} stroke={CHART_GRID} />
            <text x={LEFT - 6} y={y(tick) + 4} textAnchor="end" fontSize={11} fill={CHART_MUTED}>
              {`${tick} ft`}
            </text>
          </g>
        ))}
        {months.map((month, index) => {
          const center = LEFT + index * STEP + STEP / 2;
          const monthLabel = (
            <text x={center} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill={CHART_MUTED}>
              {month.abbrev}
            </text>
          );
          if (!month.waves) {
            return (
              <g key={month.month}>
                <text x={center} y={y(0) - 6} textAnchor="middle" fontSize={11} fill={CHART_MUTED}>
                  n/a
                </text>
                {monthLabel}
              </g>
            );
          }
          const { median, p25, p75, p90 } = month.waves.hsFt;
          return (
            <g key={month.month}>
              <rect
                x={center - BAR_WIDTH / 2}
                y={y(p75)}
                width={BAR_WIDTH}
                height={Math.max(1, y(p25) - y(p75))}
                rx={3}
                fill={CHART_SERIES}
                fillOpacity={0.3}
              />
              <line
                x1={center - BAR_WIDTH / 2}
                x2={center + BAR_WIDTH / 2}
                y1={y(p90)}
                y2={y(p90)}
                stroke={CHART_INK}
                strokeWidth={2}
              />
              <circle cx={center} cy={y(median)} r={4} fill={CHART_SERIES} />
              {monthLabel}
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 text-xs leading-5 text-[#655C4C]">
        Dot: median buoy reading. Bar: the middle half of readings. Line: the 90th percentile. These are buoy
        readings, not surf height at the beach.
      </figcaption>
    </figure>
  );
}
