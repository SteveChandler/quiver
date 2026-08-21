"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, ReactElement, ReactNode } from "react";
import type { TimelineDaySegment } from "@/components/map/hourly-swell-timeline";
import { formatTimelineBubble } from "@/components/map/hourly-swell-timeline";
import {
  SWELL_MAP_CTA_CLASS,
  SWELL_MAP_LEGEND_SURFACE,
  SWELL_MAP_STICKER_RADIUS,
  SWELL_MAP_TIMELINE,
  SWELL_MAP_TIMELINE_CSS_VARIABLES,
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
  onHeightChange?: (height: number) => void;
  onPlaybackPositionChange?: (position: number) => void;
}

const deltaByKey: Record<string, number> = {
  ArrowLeft: -1,
  ArrowDown: -1,
  ArrowRight: 1,
  ArrowUp: 1,
};
export const PLAYBACK_TARGET_DURATION_MS = 18_000;
const DEFAULT_PLAYBACK_VISUAL_FRAME_MS = 500;
const MIN_PLAYBACK_VISUAL_FRAME_MS = 50;
const MAX_PLAYBACK_VISUAL_FRAME_MS = 750;
const FIELD_UPDATE_INTERVAL_MS = 100;
// "Mon 17" at 12px bold uppercase plus padding; below this a band shows the date number only.
const FULL_DAY_LABEL_MIN_PX = 64;

export function getPlaybackVisualFrameMs(timestampCount: number): number {
  const frameCount = Math.max(1, Math.floor(timestampCount) - 1);
  const targetFrameMs = PLAYBACK_TARGET_DURATION_MS / frameCount;
  return Math.min(
    MAX_PLAYBACK_VISUAL_FRAME_MS,
    Math.max(MIN_PLAYBACK_VISUAL_FRAME_MS, targetFrameMs),
  );
}

export function advancePlaybackPosition(
  current: number,
  elapsedMs: number,
  maxIndex: number,
  visualFrameMs = DEFAULT_PLAYBACK_VISUAL_FRAME_MS,
): number {
  return Math.min(maxIndex, current + elapsedMs / visualFrameMs);
}

interface LocalTimestampParts {
  dateOrdinal: number;
  wallMinutes: number;
}

function localTimestampParts(timestamp: string, timezone: string): LocalTimestampParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const value = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  const year = value("year");
  const month = value("month");
  const day = value("day");
  const hour = value("hour");
  const minute = value("minute");
  return {
    dateOrdinal: Date.UTC(year, month - 1, day) / (24 * 60 * 60 * 1000),
    wallMinutes: hour * 60 + minute,
  };
}

export function findAdjacentLocalDayIndex(
  timestamps: readonly string[],
  index: number,
  timezone: string,
  direction: -1 | 1,
): number {
  const safeIndex = clampIndex(index, timestamps.length);
  if (timestamps.length <= 1) return safeIndex;
  const active = localTimestampParts(timestamps[safeIndex], timezone);
  const targetOrdinal = active.dateOrdinal + direction;
  const candidates = timestamps.map((timestamp, candidateIndex) => ({
    index: candidateIndex,
    ...localTimestampParts(timestamp, timezone),
  })).filter((candidate) => direction > 0
    ? candidate.index > safeIndex
    : candidate.index < safeIndex);
  const targetDateCandidates = candidates.filter(
    (candidate) => candidate.dateOrdinal === targetOrdinal,
  );
  const exact = targetDateCandidates.filter(
    (candidate) => candidate.wallMinutes === active.wallMinutes,
  );
  if (exact.length > 0) return direction > 0 ? exact[0].index : exact[exact.length - 1].index;

  const pool = targetDateCandidates.length > 0
    ? targetDateCandidates
    : candidates.filter((candidate) => direction > 0
      ? candidate.dateOrdinal >= targetOrdinal
      : candidate.dateOrdinal <= targetOrdinal);
  if (pool.length === 0) return direction > 0 ? timestamps.length - 1 : 0;
  return pool.reduce((best, candidate) => {
    const bestDateDistance = Math.abs(best.dateOrdinal - targetOrdinal);
    const candidateDateDistance = Math.abs(candidate.dateOrdinal - targetOrdinal);
    if (candidateDateDistance !== bestDateDistance) {
      return candidateDateDistance < bestDateDistance ? candidate : best;
    }
    const bestWallDistance = Math.abs(best.wallMinutes - active.wallMinutes);
    const candidateWallDistance = Math.abs(candidate.wallMinutes - active.wallMinutes);
    if (candidateWallDistance !== bestWallDistance) {
      return candidateWallDistance < bestWallDistance ? candidate : best;
    }
    return direction > 0
      ? (candidate.index < best.index ? candidate : best)
      : (candidate.index > best.index ? candidate : best);
  }).index;
}

function clampIndex(index: number, length: number): number {
  if (!Number.isFinite(index) || length <= 1) return 0;
  return Math.min(Math.max(index, 0), length - 1);
}

function dayTestId(label: string): string {
  return `timeline-day-${label.replaceAll(/\s+/g, "-")}`;
}

export function compactTimelineDayLabel(label: string): string {
  return label.match(/\d+$/)?.[0] ?? label;
}

export function timelineDayLabelWidthPercent(
  startIndex: number,
  endIndex: number,
  timestampCount: number,
): number {
  if (timestampCount <= 0 || endIndex < startIndex) return 0;
  return ((endIndex - startIndex + 1) / timestampCount) * 100;
}

function isPartialCurrentDaySegment(
  segment: TimelineDaySegment,
  segmentIndex: number,
  timezone: string,
  timestamps: string[],
): boolean {
  if (segmentIndex !== 0 || segment.startIndex !== 0) return false;
  return localTimestampParts(timestamps[0], timezone).wallMinutes > 0;
}

function timelineSegmentLabels(
  segment: TimelineDaySegment,
  segmentIndex: number,
  timestamps: string[],
  timezone: string,
): { full: string; compact: string; hint: string | undefined } {
  const isPartial = isPartialCurrentDaySegment(segment, segmentIndex, timezone, timestamps);
  if (!isPartial) {
    return {
      full: segment.label,
      compact: compactTimelineDayLabel(segment.label),
      hint: undefined,
    };
  }

  const remainingHours = segment.endIndex - segment.startIndex + 1;
  return {
    full: "Today",
    compact: "Today",
    hint: `${remainingHours}h left`,
  };
}

export function timelineDayLabelClasses(
  segmentWidthPx: number | null,
): { full: string; compact: string } {
  // Unknown width (no layout yet, or jsdom): fall back to the viewport breakpoint.
  if (segmentWidthPx == null) {
    return { full: "hidden truncate sm:inline", compact: "tabular-nums sm:hidden" };
  }
  if (segmentWidthPx < FULL_DAY_LABEL_MIN_PX) {
    return { full: "hidden", compact: "inline tabular-nums" };
  }
  return { full: "inline truncate", compact: "hidden tabular-nums" };
}

function TimelineStatus({
  error,
  isLoadingMore,
  isExhausted,
  onRetry,
  exhaustionLabel,
}: Pick<
  SwellDayTimelineProps,
  "error" | "isLoadingMore" | "isExhausted" | "onRetry"
> & { exhaustionLabel: string }): ReactElement | null {
  if (error) {
    return (
      <div role="status" aria-live="polite" aria-atomic="true" className="flex items-center gap-2 text-xs font-semibold">
        <span>Forecast extension unavailable: {error}</span>
        <button
          type="button"
          onClick={onRetry}
          aria-label="Retry loading forecast hours"
          className="inline-flex h-11 min-h-11 min-w-11 items-center justify-center border-b border-current font-bold uppercase tracking-[0.08em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--swell-timeline-focus)] focus-visible:ring-offset-2"
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
        {exhaustionLabel}
      </div>
    );
  }

  return null;
}

function TimelineShell({
  children,
  timezone,
  onHeightChange,
}: {
  children: ReactNode;
  timezone: string;
  onHeightChange?: (height: number) => void;
}): ReactElement {
  const shellRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell || !onHeightChange) return;

    const reportHeight = (): void => {
      onHeightChange(shell.getBoundingClientRect().height);
    };
    reportHeight();
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(reportHeight);
    observer.observe(shell);
    return () => observer.disconnect();
  }, [onHeightChange]);

  return (
    <aside
      ref={shellRef}
      data-testid="swell-day-timeline"
      data-timezone={timezone}
      className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-5"
    >
      <div
        data-testid="timeline-panel"
        className="pointer-events-auto mx-auto max-w-5xl border px-3 py-2 sm:px-4"
        style={{
          ...SWELL_MAP_TIMELINE_CSS_VARIABLES,
          background: SWELL_MAP_LEGEND_SURFACE.paper,
          borderColor: SWELL_MAP_LEGEND_SURFACE.border,
          borderRadius: SWELL_MAP_STICKER_RADIUS,
          boxShadow: SWELL_MAP_TIMELINE.stickerShadow,
          color: SWELL_MAP_TIMELINE.ink,
        } as CSSProperties}
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
  onHeightChange,
  onPlaybackPositionChange,
}: SwellDayTimelineProps): ReactElement | null {
  const finalTimestamp = timestamps.at(-1);
  const exhaustionLabel = finalTimestamp
    ? `${daySegments.length}-day forecast · ends ${formatTimelineBubble(finalTimestamp, timezone)}`
    : "No forecast hours available";
  const safeIndex = clampIndex(index, timestamps.length);
  const canPlay = timestamps.length > 1;
  const maxIndex = Math.max(0, timestamps.length - 1);
  const visualFrameMs = getPlaybackVisualFrameMs(timestamps.length);
  const [visualIndex, setVisualIndex] = useState(safeIndex);
  const visualIndexRef = useRef(safeIndex);
  const controlledIndexRef = useRef(safeIndex);
  const maxIndexRef = useRef(maxIndex);
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const onPlaybackPositionChangeRef = useRef(onPlaybackPositionChange);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = (): void => {
      setTrackWidth(track.getBoundingClientRect().width);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    onPlaybackPositionChangeRef.current = onPlaybackPositionChange;
  }, [onPlaybackPositionChange]);

  useEffect(() => {
    controlledIndexRef.current = safeIndex;
    if (isPlaying) return;
    visualIndexRef.current = safeIndex;
    setVisualIndex(safeIndex);
    onPlaybackPositionChangeRef.current?.(safeIndex);
  }, [isPlaying, safeIndex]);

  useEffect(() => {
    maxIndexRef.current = maxIndex;
  }, [maxIndex]);

  useEffect(() => {
    if (!isPlaying) return;
    visualIndexRef.current = controlledIndexRef.current;
    setVisualIndex(controlledIndexRef.current);
    onPlaybackPositionChangeRef.current?.(controlledIndexRef.current);
    let animationFrame = 0;
    let lastFrameTime: number | null = null;
    let lastFieldUpdateTime: number | null = null;

    const animate = (frameTime: number): void => {
      if (lastFrameTime != null) {
        const next = advancePlaybackPosition(
          visualIndexRef.current,
          frameTime - lastFrameTime,
          maxIndexRef.current,
          visualFrameMs,
        );
        visualIndexRef.current = next;
        setVisualIndex(next);
        if (
          lastFieldUpdateTime == null
          || frameTime - lastFieldUpdateTime >= FIELD_UPDATE_INTERVAL_MS
        ) {
          lastFieldUpdateTime = frameTime;
          onPlaybackPositionChangeRef.current?.(next);
        }
      }
      lastFrameTime = frameTime;
      animationFrame = window.requestAnimationFrame(animate);
    };
    animationFrame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [isPlaying, visualFrameMs]);

  if (timestamps.length === 0) {
    if (!error && !isLoadingMore && !isExhausted) return null;

    return (
      <TimelineShell timezone={timezone} onHeightChange={onHeightChange}>
        <TimelineStatus
          error={error}
          isLoadingMore={isLoadingMore}
          isExhausted={isExhausted}
          onRetry={onRetry}
          exhaustionLabel={exhaustionLabel}
        />
      </TimelineShell>
    );
  }

  const progress = timestamps.length <= 1 ? 0 : visualIndex / maxIndex;
  const bubbleLeft = `${progress * 100}%`;
  const bubbleTransform = progress <= 0.15
    ? "translateX(0)"
    : progress >= 0.85
      ? "translateX(-100%)"
      : "translateX(-50%)";

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    const delta = deltaByKey[event.key];
    const requestedIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? timestamps.length - 1
        : event.key === "PageUp"
          ? findAdjacentLocalDayIndex(timestamps, safeIndex, timezone, -1)
          : event.key === "PageDown"
            ? findAdjacentLocalDayIndex(timestamps, safeIndex, timezone, 1)
        : delta === undefined
          ? null
          : safeIndex + delta;

    if (requestedIndex === null) return;

    event.preventDefault();
    onIndexChange(clampIndex(requestedIndex, timestamps.length));
  };

  return (
    <TimelineShell timezone={timezone} onHeightChange={onHeightChange}>
      <div className="flex items-end gap-3">
        <Button
          type="button"
          size="icon"
          aria-label={isPlaying ? "Pause forecast timeline" : "Play forecast timeline"}
          disabled={!canPlay}
          onClick={() => onPlayingChange(!isPlaying)}
          className={`shrink-0 rounded-full border border-[var(--swell-timeline-ink)] shadow-[var(--swell-timeline-sticker-shadow)] focus-visible:ring-[var(--swell-timeline-focus)] ${SWELL_MAP_CTA_CLASS}`}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Play className="h-4 w-4 fill-current" aria-hidden="true" />
          )}
        </Button>

        <div ref={trackRef} data-testid="timeline-track" className="relative min-w-0 flex-1 pt-9">
          {error ? null : (
            <div
              data-testid="timeline-status-inline"
              className="pointer-events-none absolute right-0 top-0 max-w-[60%] text-right leading-4 [&>div]:truncate"
            >
              <TimelineStatus
                error={null}
                isLoadingMore={isLoadingMore}
                isExhausted={isExhausted}
                onRetry={onRetry}
                exhaustionLabel={exhaustionLabel}
              />
            </div>
          )}
          <div
            data-testid="timeline-bubble"
            className="absolute z-10 whitespace-nowrap border border-[var(--swell-timeline-ink)] px-2 py-1 text-xs font-bold tabular-nums shadow-[var(--swell-timeline-sticker-shadow)]"
            style={{
              left: bubbleLeft,
              top: "0.35rem",
              transform: bubbleTransform,
              background: "var(--swell-timeline-active)",
              borderRadius: "7px 3px 8px 4px",
              color: "var(--swell-timeline-ink)",
            }}
          >
            {bubbleLabel}
          </div>

          <div className="relative h-11">
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
              className="peer absolute inset-x-0 bottom-0 z-20 h-11 w-full cursor-pointer opacity-0 accent-[var(--swell-timeline-active)] focus-visible:outline-none focus-visible:ring-[var(--swell-timeline-focus)] disabled:cursor-not-allowed disabled:opacity-0"
            />
            <div
              data-testid="timeline-visual-track"
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-8 h-1 overflow-visible rounded-full bg-[var(--swell-timeline-ink)]/35 peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--swell-timeline-focus)] peer-focus-visible:ring-offset-2"
            >
              <div
                data-testid="timeline-progress"
                className="h-full rounded-full bg-[var(--swell-timeline-active)]"
                style={{ width: `${progress * 100}%` }}
              />
              <span
                className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--swell-timeline-ink)] bg-[var(--swell-timeline-active)] shadow-sm"
                style={{ left: `${progress * 100}%` }}
              />
            </div>
            <div
              data-testid="timeline-day-layer"
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-7 overflow-hidden border border-[var(--swell-timeline-ink)]"
              style={{ borderRadius: "5px 2px 6px 3px", background: SWELL_MAP_TIMELINE.track }}
            >
              {daySegments.map((segment, segmentIndex) => {
                const startIndex = clampIndex(segment.startIndex, timestamps.length);
                const endIndex = clampIndex(segment.endIndex, timestamps.length);

                if (endIndex < startIndex) return null;

                const left = (startIndex / timestamps.length) * 100;
                const width = timelineDayLabelWidthPercent(
                  startIndex,
                  endIndex,
                  timestamps.length,
                );
                const labels = timelineSegmentLabels(
                  segment,
                  segmentIndex,
                  timestamps,
                  timezone,
                );
                const segmentWidthPx = trackWidth > 0 ? (trackWidth * width) / 100 : null;
                const labelClasses = timelineDayLabelClasses(segmentWidthPx);

                return (
                  <div
                    key={segment.key}
                    data-testid={dayTestId(segment.label)}
                    title={labels.hint ? `${labels.full} · ${labels.hint}` : labels.full}
                    className="absolute bottom-0 top-0 flex min-w-0 items-center justify-center border-r border-[var(--swell-timeline-ink)] px-0.5 text-xs font-bold uppercase tracking-[0.04em] last:border-r-0 sm:justify-start sm:px-2 sm:tracking-[0.08em]"
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      background: segmentIndex % 2 === 0
                        ? SWELL_MAP_TIMELINE.dayBand
                        : SWELL_MAP_TIMELINE.dayBandAlternate,
                    }}
                  >
                    <span className={labelClasses.full}>
                      {labels.full}
                      {labels.hint ? (
                        <span className="font-medium normal-case tracking-normal">
                          {` · ${labels.hint}`}
                        </span>
                      ) : null}
                    </span>
                    <span
                      data-testid={`${dayTestId(segment.label)}-compact`}
                      className={labelClasses.compact}
                    >
                      {labels.compact}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      {error ? (
        <div className="mt-1 pl-14">
          <TimelineStatus
            error={error}
            isLoadingMore={isLoadingMore}
            isExhausted={isExhausted}
            onRetry={onRetry}
            exhaustionLabel={exhaustionLabel}
          />
        </div>
      ) : null}
    </TimelineShell>
  );
}
