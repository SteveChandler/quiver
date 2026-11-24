"use client";

import { useState } from "react";

import { CHART_GRID, CHART_INK, CHART_MUTED, CHART_PEAK, CHART_SERIES } from "@/components/best-time-to-surf/buoy-record/chart-theme";
import type { ChartRange as TrendRange, ChartRangeData as TrendRangeData } from "@/lib/buoy-pages/chart-ranges";
import { metersToFeetRounded, travelArrowRotation } from "@/lib/buoy-pages/format";
import type { TrendPoint } from "@/lib/buoy-pages/series";
import { cn } from "@/lib/utils";

interface TrendChartProps {
  ranges: Partial<Record<TrendRange, TrendRangeData>>;
  defaultRange: TrendRange;
  hasSplit: boolean;
  stationName: string;
}

const WIDTH = 720;
const LEFT = 44;
const RIGHT = 12;
const TOP = 12;
const BOTTOM = 26;
const HOUR_MS = 3_600_000;
const GAP_MS = 3 * HOUR_MS;
const RANGE_LABELS: Record<TrendRange, string> = { "24h": "24 h", "5d": "5 days", "30d": "30 days" };
const SWELL_COLOR = "#0E9468";

type Accessor = (point: TrendPoint) => number | null;

function linePath(points: TrendPoint[], value: Accessor, x: (t: number) => number, y: (v: number) => number): string {
  let path = "";
  let previous: number | null = null;
  for (const point of points) {
    const v = value(point);
    if (v === null) {
      previous = null;
      continue;
    }
    const command = previous === null || point.t - previous > GAP_MS ? "M" : "L";
    path += `${command}${x(point.t).toFixed(1)},${y(v).toFixed(1)}`;
    previous = point.t;
  }
  return path;
}

function niceMax(maxValue: number, step: number, floor: number): number {
  return Math.max(floor, Math.ceil(maxValue / step) * step);
}

interface PanelProps {
  data: TrendRangeData;
  height: number;
  series: Array<{ key: string; label: string; color: string; value: Accessor; dashed?: boolean }>;
  unit: string;
  step: number;
  floor: number;
  title: string;
}

function Panel({ data, height, series, unit, step, floor, title }: PanelProps) {
  const plotHeight = height - TOP - BOTTOM;
  const span = Math.max(1, data.end - data.start);
  const x = (t: number) => LEFT + ((t - data.start) / span) * (WIDTH - LEFT - RIGHT);
  const values = series.flatMap((s) => data.points.map(s.value)).filter((v): v is number => v !== null);
  const max = niceMax(Math.max(0, ...values), step, floor);
  const y = (v: number) => TOP + plotHeight * (1 - v / max);
  const yTicks = Array.from({ length: Math.round(max / step) }, (_, index) => (index + 1) * step);

  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} className="h-auto w-full min-w-[540px]" role="img" aria-label={title}>
      {yTicks.map((tick) => (
        <g key={tick}>
          <line x1={LEFT} x2={WIDTH - RIGHT} y1={y(tick)} y2={y(tick)} stroke={CHART_GRID} />
          <text x={LEFT - 6} y={y(tick) + 4} textAnchor="end" fontSize={11} fill={CHART_MUTED}>
            {`${tick}${unit}`}
          </text>
        </g>
      ))}
      <line x1={LEFT} x2={WIDTH - RIGHT} y1={y(0)} y2={y(0)} stroke={CHART_INK} strokeOpacity={0.4} />
      {data.ticks.map((tick) => (
        <g key={tick.t}>
          <line x1={x(tick.t)} x2={x(tick.t)} y1={TOP} y2={y(0)} stroke={CHART_GRID} />
          <text x={x(tick.t)} y={height - 8} textAnchor="middle" fontSize={11} fill={CHART_MUTED}>
            {tick.label}
          </text>
        </g>
      ))}
      {series.map((s) => (
        <path
          key={s.key}
          d={linePath(data.points, s.value, x, y)}
          fill="none"
          stroke={s.color}
          strokeWidth={s.key === "total" ? 2.5 : 2}
          strokeDasharray={s.dashed ? "5 4" : undefined}
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

function DirectionStrip({ data }: { data: TrendRangeData }) {
  const height = 34;
  const span = Math.max(1, data.end - data.start);
  const x = (t: number) => LEFT + ((t - data.start) / span) * (WIDTH - LEFT - RIGHT);
  const stride = data.arrowEveryHours * HOUR_MS;
  const arrows: Array<{ t: number; deg: number }> = [];
  let next = data.start;
  for (const point of data.points) {
    const deg = point.swD ?? point.mwd;
    if (deg === null || point.t < next) continue;
    arrows.push({ t: point.t, deg });
    next = point.t + stride;
  }
  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} className="h-auto w-full min-w-[540px]" role="img" aria-label="Wave direction over time">
      <text x={LEFT - 6} y={21} textAnchor="end" fontSize={11} fill={CHART_MUTED}>
        dir
      </text>
      {arrows.map((arrow) => (
        <g key={arrow.t} transform={`translate(${x(arrow.t).toFixed(1)},17) rotate(${travelArrowRotation(arrow.deg)})`}>
          <path d="M0,-9 L4,3 L0,1 L-4,3 Z" fill={CHART_SERIES} />
        </g>
      ))}
    </svg>
  );
}

function Legend({ items }: { items: Array<{ label: string; color: string; dashed?: boolean }> }) {
  return (
    <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#11100D]/75">
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-1.5">
          <svg width="18" height="6" aria-hidden>
            <line x1="0" x2="18" y1="3" y2="3" stroke={item.color} strokeWidth="2.5" strokeDasharray={item.dashed ? "4 3" : undefined} />
          </svg>
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export function TrendChart({ ranges, defaultRange, hasSplit, stationName }: TrendChartProps) {
  const available = (Object.keys(RANGE_LABELS) as TrendRange[]).filter((range) => ranges[range]);
  const [range, setRange] = useState<TrendRange>(ranges[defaultRange] ? defaultRange : available[0]);
  const data = ranges[range];
  if (!data) return null;

  const showSplit = hasSplit && data.points.some((point) => point.swH !== null);
  const heightSeries = [
    { key: "total", label: "Total (significant height)", color: CHART_INK, value: (p: TrendPoint) => (p.hs === null ? null : metersToFeetRounded(p.hs)) },
    ...(showSplit
      ? [
          { key: "swell", label: "Swell", color: SWELL_COLOR, value: (p: TrendPoint) => (p.swH === null ? null : metersToFeetRounded(p.swH)) },
          { key: "wind", label: "Wind waves", color: CHART_PEAK, value: (p: TrendPoint) => (p.wwH === null ? null : metersToFeetRounded(p.wwH)), dashed: true },
        ]
      : []),
  ];
  const periodSeries = showSplit
    ? [
        { key: "swell", label: "Swell period", color: SWELL_COLOR, value: (p: TrendPoint) => p.swP },
        { key: "wind", label: "Wind-wave period", color: CHART_PEAK, value: (p: TrendPoint) => p.wwP, dashed: true },
      ]
    : [{ key: "total", label: "Dominant period", color: CHART_SERIES, value: (p: TrendPoint) => p.dpd }];

  return (
    <div data-testid="buoy-trend-chart">
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Chart time range">
        {available.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setRange(option)}
            aria-pressed={option === range}
            className={cn(
              "border-2 border-[#11100D] px-3 py-1 font-mono text-xs font-bold uppercase tracking-[0.12em] transition-colors",
              option === range ? "bg-[#11100D] text-[#FBF6E8]" : "bg-[#FFFDF7] text-[#11100D] hover:bg-[#FBF6E8]",
            )}
          >
            {RANGE_LABELS[option]}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto border-2 border-[#11100D] bg-[#FFFDF7] p-3">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#11100D]/60">Height at the buoy</p>
        <Panel
          data={data}
          height={190}
          series={heightSeries}
          unit=" ft"
          step={2}
          floor={4}
          title={`Wave height at ${stationName} over the last ${RANGE_LABELS[range]}`}
        />
        <Legend items={heightSeries} />
        <p className="mt-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#11100D]/60">Period</p>
        <Panel
          data={data}
          height={150}
          series={periodSeries}
          unit=" s"
          step={5}
          floor={15}
          title={`Wave period at ${stationName} over the last ${RANGE_LABELS[range]}`}
        />
        <Legend items={periodSeries} />
        <DirectionStrip data={data} />
      </div>
    </div>
  );
}
