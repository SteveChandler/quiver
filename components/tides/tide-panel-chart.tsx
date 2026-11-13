"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { formatStationTime } from "@/lib/tide-stations/format";
import type { TideExtremePoint } from "@/lib/tide-stations/series";
import { metresToFeet } from "@/lib/tide-stations/series";
import { formatTideAxisValue, tideYTicks } from "@/lib/utils/tide-axis";
import {
  buildMonotoneCurvePath,
  buildTideChartXTicks,
  formatPanelTideHeight,
  tideHeightOnCurve,
  tideYDomain,
  type TidePanelPoint,
} from "@/lib/tides/tide-panel";

/**
 * Web port of native `CompactTideDrilldownChart` (Beach Detail tide panel):
 * paper panel, blue monotone curve, orange now line, legend, next low and high.
 * Every label is in the beach's time zone.
 */

const HOUR_MS = 3_600_000;
const WIDTH = 340;
const HEIGHT = 148;
const PADDING = { top: 18, right: 12, bottom: 24, left: 34 };
const INK = "#11100D";
const INK_MUTED = "#4A463C";
const TIDE = "#5B8DEF";
const NOW = "#F78E42";

type Span = "24h" | "3d" | "7d";

const SPANS: Array<{ key: Span; label: string; hours: number }> = [
  { key: "24h", label: "24 h", hours: 24 },
  { key: "3d", label: "3 days", hours: 72 },
  { key: "7d", label: "7 days", hours: 168 },
];

interface TidePanelChartProps {
  curve: TidePanelPoint[];
  extremes: TideExtremePoint[];
  timeZone: string;
  /** Render time of the cached page; the first client render matches it, then moves to the real clock. */
  renderedAtMs: number;
}

function formatExtremeLabel(extreme: TideExtremePoint, timeZone: string): string {
  return `${extreme.type === "high" ? "High" : "Low"} ${formatPanelTideHeight(metresToFeet(extreme.heightM))} · ${formatStationTime(extreme.ts, timeZone)}`;
}

export function TidePanelChart({ curve, extremes, timeZone, renderedAtMs }: TidePanelChartProps) {
  const [span, setSpan] = React.useState<Span>("24h");
  const [nowMs, setNowMs] = React.useState(renderedAtMs);
  const clipId = React.useId().replace(/:/g, "");

  React.useEffect(() => {
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const hours = SPANS.find((s) => s.key === span)?.hours ?? 24;
  // Same past share as the old page chart: a fifth of the span behind now.
  const chartStart = Math.floor((nowMs - hours * 0.2 * HOUR_MS) / HOUR_MS) * HOUR_MS;
  const chartEnd = chartStart + hours * HOUR_MS;
  const points = curve.filter((p) => p.timestamp >= chartStart - HOUR_MS && p.timestamp <= chartEnd + HOUR_MS);
  const nowHeight = tideHeightOnCurve(curve, nowMs);
  const nextLow = extremes.find((e) => e.type === "low" && Date.parse(e.ts) > nowMs) ?? null;
  const nextHigh = extremes.find((e) => e.type === "high" && Date.parse(e.ts) > nowMs) ?? null;

  if (curve.length < 2) return null;

  const [minY, maxY] = tideYDomain(points);
  const chartW = WIDTH - PADDING.left - PADDING.right;
  const chartH = HEIGHT - PADDING.top - PADDING.bottom;
  const scaleX = (t: number) => PADDING.left + ((t - chartStart) / (chartEnd - chartStart)) * chartW;
  const scaleY = (h: number) => PADDING.top + ((maxY - h) / (maxY - minY || 1)) * chartH;
  const pathD = buildMonotoneCurvePath(points.map((p) => ({ x: scaleX(p.timestamp), y: scaleY(p.heightFt) })));
  const first = points[0];
  const last = points[points.length - 1];
  const areaD =
    points.length > 1
      ? `${pathD} L${scaleX(last.timestamp).toFixed(2)},${scaleY(minY).toFixed(2)} L${scaleX(first.timestamp).toFixed(2)},${scaleY(minY).toFixed(2)} Z`
      : "";
  const yTicks = tideYTicks([minY, maxY]);
  const xTicks = buildTideChartXTicks(chartStart, chartEnd, timeZone);
  const nowVisible = nowMs >= chartStart && nowMs <= chartEnd;

  return (
    <div
      className="flex flex-col gap-[9px] rounded-[14px] rounded-tr-[22px] border border-[#E5D4B3] bg-[#F4EBD8] p-3"
      data-testid="tide-panel-chart"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[9px] font-bold tracking-[1.1px] text-[#4A463C]">TIDE</span>
        <div role="tablist" aria-label="Tide chart span" className="flex border-2 border-[#11100D]">
          {SPANS.map((s) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={span === s.key}
              onClick={() => setSpan(s.key)}
              className={cn(
                "focus-ring px-2.5 py-1 font-mono text-[11px] font-bold uppercase",
                span === s.key ? "bg-[#11100D] text-[#F4EBD8]" : "text-[#11100D] hover:bg-[#11100D]/10"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        {nowHeight != null && (
          <span className="font-mono text-[13px] font-bold text-[#8A5E00]">{formatPanelTideHeight(nowHeight)}</span>
        )}
      </div>

      <div className="overflow-hidden rounded-[10px] bg-[#11100D]/[0.04]">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          width="100%"
          role="img"
          aria-label={`Tide curve for the next ${hours} hours, local time`}
          className="block"
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={PADDING.left} y={0} width={chartW} height={HEIGHT} />
            </clipPath>
          </defs>
          {yTicks.map((value) => (
            <g key={`y-${value}`}>
              <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={scaleY(value)} y2={scaleY(value)} stroke={INK} strokeOpacity={0.15} />
              <text x={PADDING.left - 6} y={scaleY(value) + 4} fill={INK_MUTED} fontSize={9} textAnchor="end">
                {formatTideAxisValue(value)}
              </text>
            </g>
          ))}
          <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={scaleY(0)} y2={scaleY(0)} stroke={INK} strokeOpacity={0.15} strokeDasharray="4 4" />
          <g clipPath={`url(#${clipId})`}>
            <path d={areaD} fill={TIDE} fillOpacity={0.18} />
            <path d={pathD} stroke={TIDE} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </g>
          {nowVisible && (
            <line x1={scaleX(nowMs)} x2={scaleX(nowMs)} y1={PADDING.top} y2={PADDING.top + chartH} stroke={NOW} strokeWidth={2} />
          )}
          {xTicks.map((tick, index) => (
            <text
              key={`x-${tick.timestamp}`}
              x={scaleX(tick.timestamp)}
              y={HEIGHT - 7}
              fill={INK_MUTED}
              fontSize={9}
              textAnchor={index === 0 && span === "24h" ? "start" : index === xTicks.length - 1 && span === "24h" ? "end" : "middle"}
            >
              {tick.label}
            </text>
          ))}
        </svg>
      </div>

      <div className="flex items-center gap-3 font-mono text-[8px] font-bold tracking-[0.4px] text-[#4A463C]">
        <span className="flex items-center gap-[5px]">
          <i className="inline-block h-[3px] w-[14px] rounded-full" style={{ background: TIDE }} />
          TIDE
        </span>
        {nowVisible && (
          <span className="flex items-center gap-[5px]">
            <i className="inline-block h-[3px] w-[14px] rounded-full" style={{ background: NOW }} />
            NOW
          </span>
        )}
      </div>

      <div className="flex gap-2 font-mono text-[11px] leading-[14px] text-[#11100D]">
        <span className="min-w-0 flex-1">{nextLow ? formatExtremeLabel(nextLow, timeZone) : "Low —"}</span>
        <span className="min-w-0 flex-1">{nextHigh ? formatExtremeLabel(nextHigh, timeZone) : "High —"}</span>
      </div>
    </div>
  );
}
