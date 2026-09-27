import type { HourlyChart } from "@/lib/utils/beach-hourly-chart";
import { formatTimeCasual } from "@/lib/utils/date-time";

const W = 1160;
const H = 230;
const BASE = 200;
const TOP = 40;

export function BeachHourlyChart({ chart, timezone }: { chart: HourlyChart; timezone: string }) {
  const { points, maxHeightFt, tideRange } = chart;
  if (points.length === 0) return null;
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
      <div className="overflow-x-auto">
        <div style={{ minWidth: points.length * 32 }}>
          <svg role="img" aria-label="Surf height by hour, with the tide and wind" viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full">
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
                  {p.windFromDeg != null ? (
                    <text x={x + barWidth / 2} y={BASE - 6} textAnchor="middle" fontSize="16" fill="#F5EEDC"
                      transform={`rotate(${(p.windFromDeg + 180) % 360} ${x + barWidth / 2} ${BASE - 11})`}>
                      ↑
                    </text>
                  ) : null}
                </g>
              );
            })}
            {tidePath ? <path data-tide-line d={tidePath} fill="none" stroke="#7FA7B8" strokeWidth={3} /> : null}
          </svg>
          <div data-testid="beach-hourly-time-labels" className="grid font-mono text-xs text-[#F5EEDC]/60" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
            {points.map((point, i) => <span key={point.at} className="text-center first:text-left last:text-right">{i % 2 === 0 ? formatTimeCasual(point.at, timezone) : null}</span>)}
          </div>
        </div>
      </div>
      <figcaption className="mt-2 flex gap-4 text-xs text-[#F5EEDC]/70">
        <span><i className="mr-1.5 inline-block h-1 w-3.5 rounded bg-[#FDB84B] align-middle" />Best window</span>
        <span><i className="mr-1.5 inline-block h-1 w-3.5 rounded bg-[#7FA7B8] align-middle" />Tide</span>
        <span>↑ Wind direction</span>
      </figcaption>
    </figure>
  );
}
