import type { HourlyChart } from "@/lib/utils/beach-hourly-chart";
import { formatBeachDateTime, formatTimeCasual } from "@/lib/utils/date-time";

const W = 1160;
const H = 230;
const BASE = 200;
const TOP = 40;

export function BeachHourlyChart({ chart, timezone }: { chart: HourlyChart; timezone: string }) {
  const { points, maxHeightFt, tideRange } = chart;
  if (points.length === 0) return null;
  const date = formatBeachDateTime(points[0].at, timezone, "EEE, MMM d").replace(",", "");
  const heights = points.flatMap((point) => point.heightFt == null ? [] : [point.heightFt]);
  const size = heights.length ? `${Math.min(...heights)}–${maxHeightFt} ft` : "unavailable";
  const bestPoints = points.filter((point) => point.inBestWindow);
  const bestStart = chart.bestWindow?.start ?? bestPoints[0]?.at;
  const bestEnd = chart.bestWindow?.end ?? bestPoints.at(-1)?.at;
  const best = bestStart && bestEnd
    ? `${formatTimeCasual(bestStart, timezone)}–${formatTimeCasual(bestEnd, timezone)}` : "unavailable";
  const summary = `Surf height by hour for ${date}: surf bars ${size}. Best window ${best}. The full hourly table follows below.`;
  const slot = W / points.length;
  const barWidth = Math.min(46, slot * 0.66);
  const heightScale = maxHeightFt > 0 ? (BASE - TOP) / maxHeightFt : 0;
  const tideY = (ft: number) =>
    tideRange && tideRange[1] > tideRange[0]
      ? 150 - ((ft - tideRange[0]) / (tideRange[1] - tideRange[0])) * 100
      : 100;
  let tidePath = "";
  let inRun = false;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.tideFt != null) {
      const cmd = inRun ? "L" : "M";
      tidePath += `${cmd}${slot * i + slot / 2} ${tideY(p.tideFt)} `;
      inRun = true;
    } else {
      inRun = false;
    }
  }
  tidePath = tidePath.trim();

  return (
    <figure data-testid="beach-hourly-chart" className="m-0 min-w-0 rounded-2xl border border-[#F5EEDC]/15 bg-[#F5EEDC]/5 p-4">
      <p className="mb-2 font-mono text-sm font-bold text-[#F5EEDC]">{date} · Surf bars {size}</p>
      <div className="overflow-x-auto">
        <div style={{ minWidth: points.length * 32 }}>
          <svg role="img" aria-label={summary} aria-describedby="public-forecast-hourly-heading" viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full">
            {points.map((p, i) => {
              const x = slot * i + (slot - barWidth) / 2;
              const h = p.heightFt == null ? 0 : p.heightFt * heightScale;
              return (
                <g key={p.at}>
                  <rect
                    data-bar={p.inBestWindow ? "best" : "hour"}
                    x={x}
                    y={BASE - h}
                    width={barWidth}
                    height={h}
                    rx={6}
                    fill={p.inBestWindow ? "#FDB84B" : "rgba(245,238,220,0.28)"}
                  />
                </g>
              );
            })}
            {tidePath ? <path data-tide-line d={tidePath} fill="none" stroke="#7FA7B8" strokeWidth={3} /> : null}
          </svg>
          <div aria-hidden="true" className="grid font-mono text-xs text-[#F5EEDC]" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
            {points.map((point) => (
              <div key={point.at} className="flex flex-col items-center gap-1">
                <span>{point.heightFt != null ? `${point.heightFt} ft` : "—"}</span>
                <span data-wind-arrow className="inline-block h-5 text-base leading-5" style={{ transform: `rotate(${((point.windFromDeg ?? 0) + 180) % 360}deg)` }}>
                  {point.windFromDeg != null ? "↑" : ""}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="beach-hourly-time-labels" className="grid font-mono text-xs text-[#F5EEDC]/60" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
            {points.map((point, i) => <span key={point.at} className="text-center first:text-left last:text-right">{i % 2 === 0 ? formatTimeCasual(point.at, timezone) : null}</span>)}
          </div>
        </div>
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#F5EEDC]/70">
        <span><i className="mr-1.5 inline-block h-1 w-3.5 rounded bg-[#FDB84B] align-middle" />Best window</span>
        <span><i className="mr-1.5 inline-block h-1 w-3.5 rounded bg-[#7FA7B8] align-middle" />Tide{tideRange ? ` (${tideRange[0]}–${tideRange[1]} ft, separate scale)` : ""}</span>
        <span>↑ Arrow points where the wind blows</span>
      </figcaption>
    </figure>
  );
}
