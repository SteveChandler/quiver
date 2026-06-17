"use client";

import type { ReactElement } from "react";
import {
  SWELL_MAP_SURFACE,
  SWELL_MAP_STICKER_SHADOW,
  SWELL_MAP_STICKER_RADIUS,
  SWELL_MAP_CTA_CLASS,
} from "@/components/map/swell-map-theme";

interface SwellForecastTimelineProps {
  /** Discrete forecast-hour labels, e.g. ["Now", "+3h", "+6h", ...]. */
  steps: string[];
  index: number;
  onIndexChange: (index: number) => void;
}

export function SwellForecastTimeline({
  steps,
  index,
  onIndexChange,
}: SwellForecastTimelineProps): ReactElement | null {
  if (steps.length === 0) return null;
  const clamped = Math.min(Math.max(index, 0), steps.length - 1);
  return (
    <div
      data-testid="swell-forecast-timeline"
      className="pointer-events-auto absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 px-3 py-2"
      style={{
        background: SWELL_MAP_SURFACE.panel,
        border: `1px solid ${SWELL_MAP_SURFACE.border}`,
        borderRadius: SWELL_MAP_STICKER_RADIUS,
        boxShadow: SWELL_MAP_STICKER_SHADOW,
      }}
    >
      <button
        type="button"
        aria-label="Previous forecast step"
        disabled={clamped === 0}
        onClick={() => onIndexChange(clamped - 1)}
        className={`rounded-sm px-2 py-1 text-xs disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB84B] ${SWELL_MAP_CTA_CLASS}`}
      >
        ‹
      </button>
      <input
        type="range"
        min={0}
        max={steps.length - 1}
        step={1}
        value={clamped}
        aria-label="Forecast time"
        data-testid="swell-timeline-range"
        onChange={(e) => onIndexChange(Number(e.target.value))}
        className="h-1 w-40 cursor-pointer accent-[#F78E42]"
      />
      <span className="font-mono text-xs tabular-nums text-white">
        {steps[clamped]}
      </span>
      <button
        type="button"
        aria-label="Next forecast step"
        disabled={clamped === steps.length - 1}
        onClick={() => onIndexChange(clamped + 1)}
        className={`rounded-sm px-2 py-1 text-xs disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB84B] ${SWELL_MAP_CTA_CLASS}`}
      >
        ›
      </button>
    </div>
  );
}
