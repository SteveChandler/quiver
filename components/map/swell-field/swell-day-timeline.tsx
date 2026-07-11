"use client";

import { Pause, Play } from "lucide-react";
import type { KeyboardEvent, ReactElement, ReactNode } from "react";
import type { TimelineDaySegment } from "@/components/map/hourly-swell-timeline";
import {
  SWELL_MAP_CTA_CLASS,
  SWELL_MAP_LEGEND_SURFACE,
  SWELL_MAP_STICKER_RADIUS,
  SWELL_MAP_STICKER_SHADOW,
  SWELL_MAP_TIMELINE,
} from "@/components/map/swell-map-theme";
import { Button } from "@/components/ui/button";

export interface SwellDayTimelineProps {
  timestamps: string[];
  index: number;
  timezone: string;
  bubbleLabel: string;
  daySegments: TimelineDaySegment[];
  isPlaying: boolean;
  isLoadingMore: boolean;
  isExhausted: boolean;
  error: string | null;
  onIndexChange: (index: number) => void;
  onPlayingChange: (playing: boolean) => void;
  onRetry: () => void;
}

const deltaByKey: Record<string, number> = {
  ArrowLeft: -1,
  ArrowDown: -1,
  ArrowRight: 1,
  ArrowUp: 1,
  PageUp: -24,
  PageDown: 24,
};

function clampIndex(index: number, length: number): number {
  if (!Number.isFinite(index) || length <= 1) return 0;
  return Math.min(Math.max(index, 0), length - 1);
}

function dayTestId(label: string): string {
  return `timeline-day-${label.replaceAll(/\s+/g, "-")}`;
}

function TimelineStatus({
  bubbleLabel,
  error,
  isLoadingMore,
  isExhausted,
  onRetry,
}: Pick<
  SwellDayTimelineProps,
  "bubbleLabel" | "error" | "isLoadingMore" | "isExhausted" | "onRetry"
>): ReactElement | null {
  if (error) {
    return (
      <div role="status" aria-live="polite" aria-atomic="true" className="flex items-center gap-2 text-xs font-semibold">
        <span>Forecast extension unavailable: {error}</span>
        <button
          type="button"
          onClick={onRetry}
          aria-label="Retry loading forecast hours"
          className="border-b border-current font-bold uppercase tracking-[0.08em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB84B] focus-visible:ring-offset-2"
        >
          Retry
        </button>
      </div>
    );
  }

  if (isLoadingMore) {
    return (
      <div role="status" aria-live="polite" aria-atomic="true" className="text-xs font-semibold">
        Loading more forecast hours
      </div>
    );
  }

  if (isExhausted) {
    return (
      <div role="status" aria-live="polite" aria-atomic="true" className="text-xs font-semibold">
        Forecast ends {bubbleLabel}
      </div>
    );
  }

  return null;
}

function TimelineShell({
  children,
  timezone,
}: {
  children: ReactNode;
  timezone: string;
}): ReactElement {
  return (
    <aside
      data-testid="swell-day-timeline"
      data-timezone={timezone}
      className="pointer-events-auto fixed inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-5"
    >
      <div
        className="mx-auto max-w-5xl border px-3 py-2 sm:px-4"
        style={{
          background: SWELL_MAP_LEGEND_SURFACE.paper,
          borderColor: SWELL_MAP_LEGEND_SURFACE.border,
          borderRadius: SWELL_MAP_STICKER_RADIUS,
          boxShadow: SWELL_MAP_STICKER_SHADOW,
          color: SWELL_MAP_LEGEND_SURFACE.ink,
        }}
      >
        {children}
      </div>
    </aside>
  );
}

export function SwellDayTimeline({
  timestamps,
  index,
  timezone,
  bubbleLabel,
  daySegments,
  isPlaying,
  isLoadingMore,
  isExhausted,
  error,
  onIndexChange,
  onPlayingChange,
  onRetry,
}: SwellDayTimelineProps): ReactElement | null {
  if (timestamps.length === 0) {
    if (!error && !isLoadingMore) return null;

    return (
      <TimelineShell timezone={timezone}>
        <TimelineStatus
          bubbleLabel={bubbleLabel}
          error={error}
          isLoadingMore={isLoadingMore}
          isExhausted={isExhausted}
          onRetry={onRetry}
        />
      </TimelineShell>
    );
  }

  const safeIndex = clampIndex(index, timestamps.length);
  const canPlay = timestamps.length > 1;
  const progress = timestamps.length <= 1 ? 0 : safeIndex / (timestamps.length - 1);
  const bubbleLeft = `${Math.min(96, Math.max(4, progress * 100))}%`;

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    const delta = deltaByKey[event.key];
    const requestedIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? timestamps.length - 1
        : delta === undefined
          ? null
          : safeIndex + delta;

    if (requestedIndex === null) return;

    event.preventDefault();
    onIndexChange(clampIndex(requestedIndex, timestamps.length));
  };

  return (
    <TimelineShell timezone={timezone}>
      <div className="flex items-end gap-3">
        <Button
          type="button"
          size="icon"
          aria-label={isPlaying ? "Pause forecast timeline" : "Play forecast timeline"}
          disabled={!canPlay}
          onClick={() => onPlayingChange(!isPlaying)}
          className={`shrink-0 rounded-full border border-[#11100D] shadow-[2px_3px_0_0_rgba(0,0,0,0.35)] focus-visible:ring-[#FDB84B] ${SWELL_MAP_CTA_CLASS}`}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Play className="h-4 w-4 fill-current" aria-hidden="true" />
          )}
        </Button>

        <div data-testid="timeline-track" className="relative min-w-0 flex-1 pt-9">
          <div
            data-testid="timeline-bubble"
            className="absolute z-10 -translate-x-1/2 border border-[#11100D] px-2 py-1 text-xs font-bold tabular-nums shadow-[2px_3px_0_0_rgba(0,0,0,0.35)]"
            style={{
              left: bubbleLeft,
              top: "0.35rem",
              background: SWELL_MAP_TIMELINE.active,
              borderRadius: "7px 3px 8px 4px",
              color: SWELL_MAP_LEGEND_SURFACE.ink,
            }}
          >
            {bubbleLabel}
          </div>

          <div className="relative h-11">
            <div
              data-testid="timeline-day-layer"
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-7 overflow-hidden border border-[#11100D]"
              style={{ borderRadius: "5px 2px 6px 3px", background: SWELL_MAP_TIMELINE.track }}
            >
              {daySegments.map((segment, segmentIndex) => {
                const startIndex = clampIndex(segment.startIndex, timestamps.length);
                const endIndex = clampIndex(segment.endIndex, timestamps.length);

                if (endIndex < startIndex) return null;

                const left = (startIndex / timestamps.length) * 100;
                const width = ((endIndex - startIndex + 1) / timestamps.length) * 100;

                return (
                  <div
                    key={segment.key}
                    data-testid={dayTestId(segment.label)}
                    className="absolute bottom-0 top-0 flex min-w-0 items-center border-r border-[#11100D] px-2 text-[10px] font-bold uppercase tracking-[0.08em] last:border-r-0"
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      background: segmentIndex % 2 === 0
                        ? SWELL_MAP_TIMELINE.dayBand
                        : SWELL_MAP_TIMELINE.dayBandAlternate,
                    }}
                  >
                    <span className="truncate">{segment.label}</span>
                  </div>
                );
              })}
            </div>
            <input
              type="range"
              min={0}
              max={timestamps.length - 1}
              step={1}
              value={safeIndex}
              disabled={!canPlay}
              aria-label="Forecast time"
              aria-valuetext={bubbleLabel}
              onChange={(event) => onIndexChange(clampIndex(Number(event.target.value), timestamps.length))}
              onKeyDown={handleKeyDown}
              className="absolute inset-x-0 bottom-0 z-10 h-11 w-full cursor-pointer accent-[#F78E42] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB84B] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        </div>
      </div>

      <div className="mt-1 min-h-4 pl-14">
        <TimelineStatus
          bubbleLabel={bubbleLabel}
          error={error}
          isLoadingMore={isLoadingMore}
          isExhausted={isExhausted}
          onRetry={onRetry}
        />
      </div>
    </TimelineShell>
  );
}
