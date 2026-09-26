import { formatShare } from "@/lib/climatology/season-view";
import { CHART_GRID, CHART_MUTED, CHART_PEAK, CHART_SERIES } from "./chart-theme";

const WIDTH = 720;
const HEIGHT = 220;
const LEFT = 40;
const TOP = 16;
const BOTTOM = 28;
const PLOT_HEIGHT = HEIGHT - TOP - BOTTOM;
const BASELINE = TOP + PLOT_HEIGHT;
const STEP = (WIDTH - LEFT) / 12;
const BAR_WIDTH = 14;

interface SwellDaysSeries {
  label: string;
  values: Array<number | null>;
}

interface SwellDaysChartProps {
  abbrevs: readonly string[];
  primary: SwellDaysSeries;
  secondary: SwellDaysSeries;
  stationName: string;
  chartId: string;
}

export function SwellDaysChart({ abbrevs, primary, secondary, stationName, chartId }: SwellDaysChartProps) {
  const titleId = `${chartId}-title`;
  const all = [...primary.values, ...secondary.values].flatMap((value) => (value === null ? [] : [value]));
  // Round the axis up to the next 10%, never below 10%.
  const max = Math.max(0.1, Math.ceil(Math.max(0, ...all) * 10) / 10);
  const y = (share: number): number => BASELINE - PLOT_HEIGHT * (share / max);
  const ticks = Array.from({ length: Math.round(max * 10) }, (_, index) => (index + 1) / 10).filter(
    (tick, index, list) => list.length <= 5 || index % 2 === 1,
  );
  const summary = abbrevs
    .map((abbrev, index) => {
      const a = primary.values[index];
      const b = secondary.values[index];
      return a === null || b === null ? `${abbrev} n/a` : `${abbrev} ${formatShare(a)} / ${formatShare(b)}`;
    })
    .join(", ");

  return (
    <figure>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-labelledby={titleId}>
        <title id={titleId}>{`${primary.label} / ${secondary.label} at ${stationName}: ${summary}`}</title>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={LEFT} x2={WIDTH} y1={y(tick)} y2={y(tick)} stroke={CHART_GRID} />
            <text x={LEFT - 6} y={y(tick) + 4} textAnchor="end" fontSize={11} fill={CHART_MUTED}>
              {formatShare(tick)}
            </text>
          </g>
        ))}
        {abbrevs.map((abbrev, index) => {
          const center = LEFT + index * STEP + STEP / 2;
          const a = primary.values[index];
          const b = secondary.values[index];
          return (
            <g key={abbrev + index}>
              {a === null || b === null ? (
                <text x={center} y={BASELINE - 6} textAnchor="middle" fontSize={11} fill={CHART_MUTED}>
                  n/a
                </text>
              ) : (
                <>
                  <rect data-testid="swell-days-bar" x={center - BAR_WIDTH - 1} y={y(a)} width={BAR_WIDTH} height={BASELINE - y(a)} rx={2} fill={CHART_PEAK} />
                  <rect data-testid="swell-days-bar" x={center + 1} y={y(b)} width={BAR_WIDTH} height={BASELINE - y(b)} rx={2} fill={CHART_SERIES} />
                </>
              )}
              <text x={center} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill={CHART_MUTED}>
                {abbrev}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 text-xs text-[#655C4C]">
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: CHART_PEAK }} aria-hidden="true" />
            {primary.label}
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: CHART_SERIES }} aria-hidden="true" />
            {secondary.label}
          </li>
        </ul>
      </figcaption>
    </figure>
  );
}
