import type { SeasonMonthView } from "@/lib/climatology/season-view";
import { CHART_GRID, CHART_INK, CHART_MUTED, CHART_PEAK, CHART_SERIES } from "./chart-theme";

const WIDTH = 720;
const HEIGHT = 220;
const LEFT = 32;
const TOP = 20;
const BOTTOM = 28;
const PLOT_HEIGHT = HEIGHT - TOP - BOTTOM;
const STEP = (WIDTH - LEFT) / 12;
const BAR_WIDTH = STEP * 0.62;
const BASELINE = TOP + PLOT_HEIGHT;

interface ScoreByMonthChartProps {
  months: SeasonMonthView[];
  stationName: string;
  chartId: string;
}

export function ScoreByMonthChart({ months, stationName, chartId }: ScoreByMonthChartProps) {
  const titleId = `${chartId}-title`;
  const summary = months.map((month) => `${month.abbrev} ${month.score ?? "n/a"}`).join(", ");

  return (
    <figure>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-labelledby={titleId}>
        <title id={titleId}>{`Buoy score by month, ${stationName}: ${summary}`}</title>
        {[25, 50, 75, 100].map((tick) => {
          const y = TOP + PLOT_HEIGHT * (1 - tick / 100);
          return (
            <g key={tick}>
              <line x1={LEFT} x2={WIDTH} y1={y} y2={y} stroke={CHART_GRID} />
              <text x={LEFT - 6} y={y + 4} textAnchor="end" fontSize={11} fill={CHART_MUTED}>
                {tick}
              </text>
            </g>
          );
        })}
        {months.map((month, index) => {
          const x = LEFT + index * STEP + (STEP - BAR_WIDTH) / 2;
          const center = x + BAR_WIDTH / 2;
          const monthLabel = (
            <text x={center} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill={CHART_MUTED}>
              {month.abbrev}
            </text>
          );
          if (month.score === null) {
            return (
              <g key={month.month} data-testid="score-bar-missing">
                <text x={center} y={BASELINE - 6} textAnchor="middle" fontSize={11} fill={CHART_MUTED}>
                  n/a
                </text>
                {monthLabel}
              </g>
            );
          }
          const height = PLOT_HEIGHT * (month.score / 100);
          return (
            <g key={month.month} data-testid={month.isPeak ? "score-bar-peak" : "score-bar"}>
              <rect
                x={x}
                y={BASELINE - height}
                width={BAR_WIDTH}
                height={height}
                rx={3}
                fill={month.isPeak ? CHART_PEAK : CHART_SERIES}
              />
              <text
                x={center}
                y={BASELINE - height - 6}
                textAnchor="middle"
                fontSize={11}
                fontWeight={600}
                fill={CHART_INK}
              >
                {month.score}
              </text>
              {monthLabel}
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 flex items-center gap-2 text-xs text-[#655C4C]">
        <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: CHART_PEAK }} aria-hidden="true" />
        Peak band: within 10 points of the top month
      </figcaption>
    </figure>
  );
}
