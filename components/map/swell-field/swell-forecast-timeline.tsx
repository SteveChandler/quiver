"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import { Pause, Play } from "lucide-react";
import {
  SWELL_MAP_LEGEND_SURFACE,
  SWELL_MAP_SURFACE,
  SWELL_MAP_STICKER_SHADOW,
  SWELL_MAP_STICKER_RADIUS,
  SWELL_MAP_CTA_CLASS,
} from "@/components/map/swell-map-theme";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface SwellForecastTimelineProps {
  /** Discrete forecast-hour labels, e.g. ["Now", "+3h", "+6h", ...]. */
  steps: string[];
  index: number;
  onIndexChange: (index: number) => void;
  placement?: "floating" | "legend";
}

const PLAYBACK_FRAME_MS = 100;
const PLAYBACK_STEP_MS = 1200;

export function SwellForecastTimeline({
  steps,
  index,
  onIndexChange,
  placement = "floating",
}: SwellForecastTimelineProps): ReactElement | null {
  const [isPlaying, setIsPlaying] = useState(false);
  const reducedMotion = useReducedMotion();
  const safeIndex = Number.isFinite(index) ? index : 0;
  const clamped =
    steps.length > 0 ? Math.min(Math.max(safeIndex, 0), steps.length - 1) : 0;
  const nearestStep = Math.round(clamped);
  const canPlay = steps.length > 1;
  const progressRef = useRef(clamped);

  useEffect(() => {
    progressRef.current = clamped;
  }, [clamped]);

  useEffect(() => {
    if (!isPlaying || !canPlay) return;

    const intervalId = window.setInterval(() => {
      const stepDelta = reducedMotion ? 1 : PLAYBACK_FRAME_MS / PLAYBACK_STEP_MS;
      const nextRaw = progressRef.current + stepDelta;
      const next = nextRaw > steps.length - 1 ? 0 : nextRaw;
      progressRef.current = next;
      onIndexChange(next);
    }, reducedMotion ? PLAYBACK_STEP_MS : PLAYBACK_FRAME_MS);

    return () => window.clearInterval(intervalId);
  }, [canPlay, isPlaying, onIndexChange, reducedMotion, steps.length]);

  if (steps.length === 0) return null;

  const isLegendPlacement = placement === "legend";
  const containerClassName = isLegendPlacement
    ? "pointer-events-auto flex w-full items-center gap-2"
    : "pointer-events-auto absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 px-3 py-2";
  const containerStyle = isLegendPlacement
    ? undefined
    : {
        background: SWELL_MAP_SURFACE.panel,
        border: `1px solid ${SWELL_MAP_SURFACE.border}`,
        borderRadius: SWELL_MAP_STICKER_RADIUS,
        boxShadow: SWELL_MAP_STICKER_SHADOW,
      };

  return (
    <div
      data-testid="swell-forecast-timeline"
      className={containerClassName}
      style={containerStyle}
    >
      <button
        type="button"
        aria-label={isPlaying ? "Pause forecast timeline" : "Play forecast timeline"}
        disabled={!canPlay}
        onClick={() => setIsPlaying((playing) => !playing)}
        className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-sm text-xs disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB84B] ${SWELL_MAP_CTA_CLASS}`}
      >
        {isPlaying ? (
          <Pause className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
        )}
      </button>
      <button
        type="button"
        aria-label="Previous forecast step"
        disabled={nearestStep === 0}
        onClick={() => onIndexChange(Math.max(0, nearestStep - 1))}
        className={`min-h-11 min-w-11 rounded-sm px-2 py-1 text-xs disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB84B] ${SWELL_MAP_CTA_CLASS}`}
      >
        ‹
      </button>
      <input
        type="range"
        min={0}
        max={steps.length - 1}
        step={reducedMotion ? 1 : 0.01}
        value={clamped}
        aria-valuetext={steps[nearestStep]}
        aria-label="Forecast time"
        data-testid="swell-timeline-range"
        onChange={(e) => onIndexChange(Number(e.target.value))}
        className={`h-11 cursor-pointer accent-[#F78E42] ${
          isLegendPlacement ? "min-w-0 flex-1" : "w-40"
        }`}
      />
      <span
        className="min-w-8 text-right font-mono text-xs tabular-nums"
        style={{
          color: isLegendPlacement
            ? SWELL_MAP_LEGEND_SURFACE.ink
            : "#F4EBD8",
        }}
      >
        {steps[nearestStep]}
      </span>
      <button
        type="button"
        aria-label="Next forecast step"
        disabled={nearestStep === steps.length - 1}
        onClick={() => onIndexChange(Math.min(steps.length - 1, nearestStep + 1))}
        className={`min-h-11 min-w-11 rounded-sm px-2 py-1 text-xs disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB84B] ${SWELL_MAP_CTA_CLASS}`}
      >
        ›
      </button>
    </div>
  );
}
