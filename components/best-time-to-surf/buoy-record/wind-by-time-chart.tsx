import { formatShare } from "@/lib/climatology/season-view";
import type { WindMonthStats } from "@/lib/climatology/types";
import { CHART_GRID, CHART_MUTED, WIND_CLASS_COLORS, WIND_CLASS_LABELS } from "./chart-theme";

const WIDTH = 720;
const HEIGHT = 220;
const LEFT = 40;
const TOP = 12;
const BOTTOM = 28;
const PLOT_HEIGHT = HEIGHT - TOP - BOTTOM;
const BASELINE = TOP + PLOT_HEIGHT;
const STEP = (WIDTH - LEFT) / 12;
const BAR_WIDTH = 12;
const BAR_GAP = 3;
const BLOCKS = ["dawn", "midday", "afternoon"] as const;
const CLASS_ORDER = ["offshore", "light", "cross", "onshore"] as const;

interface WindByTimeChartProps {
  months: Array<{ month: number; abbrev: string; wind: WindMonthStats | null }>;
  stationName: string;
  chartId: string;
}

export function WindByTimeChart({ months, stationName, chartId }: WindByTimeChartProps) {
  const titleId = `${chartId}-title`;
  const groupWidth = BLOCKS.length * BAR_WIDTH + (BLOCKS.length - 1) * BAR_GAP;
  const summary = months
    .map((month) => (month.wind ? `${month.abbrev} ${formatShare(month.wind.dawn.offshore)}` : `${month.abbrev} n/a`))
    .join(", ");

  return (
    <figure>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-labelledby={titleId}>
        <title id={titleId}>{`Wind at ${stationName}, share of dawn hours with offshore wind: ${summary}`}</title>
        {[0.5, 1].map((tick) => {
          const y = BASELINE - PLOT_HEIGHT * tick;
          return (
            <g key={tick}>
              <line x1={LEFT} x2={WIDTH} y1={y} y2={y} stroke={CHART_GRID} />
              <text x={LEFT - 6} y={y + 4} textAnchor="end" fontSize={11} fill={CHART_MUTED}>
                {formatShare(tick)}
              </text>
            </g>
          );
        })}
        {months.map((month, index) => {
          const groupLeft = LEFT + index * STEP + (STEP - groupWidth) / 2;
          const center = LEFT + index * STEP + STEP / 2;
          const wind = month.wind;
          return (
            <g key={month.month}>
              {wind ? (
                BLOCKS.map((block, blockIndex) => {
                  const x = groupLeft + blockIndex * (BAR_WIDTH + BAR_GAP);
                  let cursor = BASELINE;
                  return (
                    <g key={block} data-testid="wind-bar">
                      {CLASS_ORDER.map((windClass) => {
                        const height = PLOT_HEIGHT * wind[block][windClass];
                        cursor -= height;
                        return (
                          <rect
                            key={windClass}
                            x={x}
                            y={cursor}
                            width={BAR_WIDTH}
                            height={height}
                            fill={WIND_CLASS_COLORS[windClass]}
                          />
                        );
                      })}
                    </g>
                  );
                })
              ) : (
                <text x={center} y={BASELINE - 6} textAnchor="middle" fontSize={11} fill={CHART_MUTED}>
                  n/a
                </text>
              )}
              <text x={center} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill={CHART_MUTED}>
                {month.abbrev}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 space-y-2 text-xs text-[#655C4C]">
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {CLASS_ORDER.map((windClass) => (
            <li key={windClass} className="flex items-center gap-1.5">
              <span
                className="inline-block h-3 w-3 rounded-sm"
                style={{ backgroundColor: WIND_CLASS_COLORS[windClass] }}
                aria-hidden="true"
              />
              {WIND_CLASS_LABELS[windClass]}
            </li>
          ))}
        </ul>
        <p>Each month shows dawn (6–9 am), midday (11 am–2 pm) and afternoon (3–6 pm), left to right.</p>
      </figcaption>
    </figure>
  );
}
