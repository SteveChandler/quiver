import { formatShare } from "@/lib/climatology/season-view";
import { SECTORS, type Sector } from "@/lib/climatology/types";
import { CHART_MUTED, CHART_SERIES } from "./chart-theme";

const LABEL_WIDTH = 72;
const COLUMN_WIDTH = 40;
const ROW_HEIGHT = 58;
const BAR_MAX = 36;
const TOP = 12;
const WIDTH = LABEL_WIDTH + SECTORS.length * COLUMN_WIDTH;

interface DirectionMixRow {
  stationName: string;
  seasons: Array<{ label: string; mix: Record<Sector, number> | null }>;
}

interface DirectionMixChartProps {
  rows: DirectionMixRow[];
  chartId: string;
}

function topSectors(mix: Record<Sector, number> | null): string {
  if (!mix) return "no data";
  return [...SECTORS]
    .sort((a, b) => mix[b] - mix[a])
    .slice(0, 2)
    .map((sector) => `${sector} ${formatShare(mix[sector])}`)
    .join(", ");
}

export function DirectionMixChart({ rows, chartId }: DirectionMixChartProps) {
  // One scale for every panel so stations can be compared by eye.
  const maxShare = Math.max(
    0.05,
    ...rows.flatMap((row) =>
      row.seasons.flatMap((season) => {
        const mix = season.mix;
        return mix ? SECTORS.map((sector) => mix[sector]) : [];
      }),
    ),
  );

  return (
    <div>
      <div className={rows.length > 1 ? "grid gap-6 md:grid-cols-2" : undefined}>
        {rows.map((row, rowIndex) => {
          const titleId = `${chartId}-${rowIndex}-title`;
          const height = TOP + row.seasons.length * ROW_HEIGHT + 16;
          return (
            <figure key={row.stationName}>
              <figcaption className="mb-2 text-sm font-semibold text-[#11100D]">{row.stationName}</figcaption>
              <svg viewBox={`0 0 ${WIDTH} ${height}`} className="h-auto w-full" role="img" aria-labelledby={titleId}>
                <title id={titleId}>
                  {`Swell direction at ${row.stationName}, share of hours: ${row.seasons
                    .map((season) => `${season.label} ${topSectors(season.mix)}`)
                    .join("; ")}`}
                </title>
                {row.seasons.map((season, seasonIndex) => {
                  const rowTop = TOP + seasonIndex * ROW_HEIGHT;
                  const mix = season.mix;
                  return (
                    <g key={season.label}>
                      <text x={0} y={rowTop + BAR_MAX} fontSize={11} fill={CHART_MUTED}>
                        {season.label}
                      </text>
                      {mix ? (
                        SECTORS.map((sector, sectorIndex) => {
                          const share = mix[sector];
                          const barHeight = (share / maxShare) * BAR_MAX;
                          const x = LABEL_WIDTH + sectorIndex * COLUMN_WIDTH;
                          return (
                            <g key={sector}>
                              <rect
                                x={x}
                                y={rowTop + BAR_MAX - barHeight}
                                width={COLUMN_WIDTH - 8}
                                height={barHeight}
                                rx={2}
                                fill={CHART_SERIES}
                              />
                              {share >= 0.05 && (
                                <text
                                  x={x + (COLUMN_WIDTH - 8) / 2}
                                  y={rowTop + BAR_MAX - barHeight - 3}
                                  textAnchor="middle"
                                  fontSize={9}
                                  fill={CHART_MUTED}
                                >
                                  {formatShare(share)}
                                </text>
                              )}
                            </g>
                          );
                        })
                      ) : (
                        <text x={LABEL_WIDTH} y={rowTop + BAR_MAX} fontSize={11} fill={CHART_MUTED}>
                          n/a
                        </text>
                      )}
                    </g>
                  );
                })}
                {SECTORS.map((sector, sectorIndex) => (
                  <text
                    key={sector}
                    x={LABEL_WIDTH + sectorIndex * COLUMN_WIDTH + (COLUMN_WIDTH - 8) / 2}
                    y={height - 4}
                    textAnchor="middle"
                    fontSize={10}
                    fill={CHART_MUTED}
                  >
                    {sector}
                  </text>
                ))}
              </svg>
            </figure>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-[#655C4C]">
        Direction the swell comes from at the buoy, as a share of hours in each season.
      </p>
    </div>
  );
}
