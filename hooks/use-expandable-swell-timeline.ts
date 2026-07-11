"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HourlySwellTimeline, SwellPartition } from "@/app/api/forecasts/bulk/route";
import {
  formatTimelineBubble,
  mergeHourlyTimeline,
  segmentTimelineDays,
  type TimelineDaySegment,
} from "@/components/map/hourly-swell-timeline";

const CHUNK_HOURS = 48;
const PREFETCH_REMAINING_FRAMES = 6;
const PLAYBACK_TICK_MS = 500;
const REDUCED_MOTION_PLAYBACK_TICK_MS = 1000;
const HOUR_MS = 60 * 60 * 1000;

export interface ExpandableTimelineState {
  timestamps: string[];
  partitionsByBeach: Record<string, Array<SwellPartition | null>>;
  index: number;
  isPlaying: boolean;
  isLoadingMore: boolean;
  isExhausted: boolean;
  error: string | null;
}

export interface UseExpandableSwellTimelineArgs {
  scopeKey: string;
  initial: HourlySwellTimeline | null;
  timezone: string;
  loadChunk: (start: string, hours: number, signal: AbortSignal) => Promise<HourlySwellTimeline>;
  reducedMotion: boolean;
}

export interface UseExpandableSwellTimelineResult extends ExpandableTimelineState {
  timezone: string;
  bubbleLabel: string;
  daySegments: TimelineDaySegment[];
  setIndex: (index: number) => void;
  setPlaying: (playing: boolean) => void;
  retry: () => void;
}

function clampIndex(index: number, timestamps: string[]): number {
  if (timestamps.length === 0) return 0;
  return Math.max(0, Math.min(index, timestamps.length - 1));
}

function nearestTimestampIndex(timestamps: string[], timestamp: string | undefined): number {
  if (!timestamp || timestamps.length === 0) return 0;

  const exactIndex = timestamps.indexOf(timestamp);
  if (exactIndex >= 0) return exactIndex;

  const target = Date.parse(timestamp);
  if (!Number.isFinite(target)) return 0;

  return timestamps.reduce((nearestIndex, candidate, index) => {
    const nearestDistance = Math.abs(Date.parse(timestamps[nearestIndex]) - target);
    const candidateDistance = Math.abs(Date.parse(candidate) - target);
    return candidateDistance < nearestDistance ? index : nearestIndex;
  }, 0);
}

function frameHasPartitions(timeline: HourlySwellTimeline, index: number): boolean {
  return Object.values(timeline.partitionsByBeach).some(
    (partitions) => partitions[index] != null,
  );
}

function parseTimestamp(timestamp: string | undefined): number | null {
  const value = Date.parse(timestamp ?? "");
  return Number.isFinite(value) ? value : null;
}

function timelineResetIdentity(timeline: HourlySwellTimeline | null): string {
  if (!timeline) return "empty";

  const partitionsByBeach = Object.keys(timeline.partitionsByBeach)
    .sort()
    .map((beachId) => [beachId, timeline.partitionsByBeach[beachId]]);

  return JSON.stringify([
    timeline.timestamps,
    partitionsByBeach,
    timeline.hasMore,
    timeline.nextStart,
  ]);
}

export function useExpandableSwellTimeline({
  scopeKey,
  initial,
  timezone,
  loadChunk,
  reducedMotion,
}: UseExpandableSwellTimelineArgs): UseExpandableSwellTimelineResult {
  const [timeline, setTimeline] = useState<HourlySwellTimeline | null>(initial);
  const [index, setIndexState] = useState(0);
  const [isPlaying, setPlayingState] = useState(false);
  const [isLoadingMore, setLoadingMore] = useState(false);
  const [isExhausted, setExhausted] = useState(!initial?.hasMore);
  const [error, setError] = useState<string | null>(null);

  const timelineRef = useRef<HourlySwellTimeline | null>(initial);
  const initialRef = useRef(initial);
  const indexRef = useRef(0);
  const scopeKeyRef = useRef(scopeKey);
  const loadChunkRef = useRef(loadChunk);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestGenerationRef = useRef(0);
  const isLoadingRef = useRef(false);
  const playbackForecastTimeRef = useRef<number | null>(null);
  const initialTimelineKey = timelineResetIdentity(initial);

  useEffect(() => {
    initialRef.current = initial;
    scopeKeyRef.current = scopeKey;
    loadChunkRef.current = loadChunk;
  }, [initial, loadChunk, scopeKey]);

  const setIndex = useCallback((nextIndex: number) => {
    const timestamps = timelineRef.current?.timestamps ?? [];
    const next = clampIndex(nextIndex, timestamps);
    indexRef.current = next;
    playbackForecastTimeRef.current = parseTimestamp(timestamps[next]);
    setIndexState(next);
  }, []);

  useEffect(() => {
    const previousTimeline = timelineRef.current;
    const previousTimestamp = previousTimeline?.timestamps[indexRef.current];
    const nextTimeline = initialRef.current;
    const nextIndex = nearestTimestampIndex(nextTimeline?.timestamps ?? [], previousTimestamp);

    requestGenerationRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    isLoadingRef.current = false;
    timelineRef.current = nextTimeline;
    indexRef.current = nextIndex;
    playbackForecastTimeRef.current = parseTimestamp(nextTimeline?.timestamps[nextIndex]);

    setTimeline(nextTimeline);
    setIndexState(nextIndex);
    setPlayingState(false);
    setLoadingMore(false);
    setExhausted(!nextTimeline?.hasMore);
    setError(null);

    return () => {
      requestGenerationRef.current += 1;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      isLoadingRef.current = false;
    };
  }, [initialTimelineKey, scopeKey]);

  const requestMore = useCallback(async (): Promise<void> => {
    const current = timelineRef.current;
    if (!current || isLoadingRef.current || !current.hasMore) return;

    const start = current.nextStart;
    if (!start) {
      setExhausted(true);
      return;
    }

    const requestScopeKey = scopeKeyRef.current;
    const requestGeneration = requestGenerationRef.current + 1;
    const controller = new AbortController();
    requestGenerationRef.current = requestGeneration;
    abortControllerRef.current?.abort();
    abortControllerRef.current = controller;
    isLoadingRef.current = true;
    setLoadingMore(true);
    setError(null);

    try {
      const incoming = await loadChunkRef.current(start, CHUNK_HOURS, controller.signal);
      if (
        controller.signal.aborted
        || requestGenerationRef.current !== requestGeneration
        || scopeKeyRef.current !== requestScopeKey
      ) {
        return;
      }

      const latest = timelineRef.current;
      if (!latest) return;

      const activeTimestamp = latest.timestamps[indexRef.current];
      const merged = mergeHourlyTimeline(latest, incoming);
      const nextIndex = nearestTimestampIndex(merged.timestamps, activeTimestamp);
      timelineRef.current = merged;
      indexRef.current = nextIndex;

      setTimeline(merged);
      setIndexState(nextIndex);
      setExhausted(!merged.hasMore || !merged.nextStart);
    } catch (requestError) {
      if (
        controller.signal.aborted
        || requestGenerationRef.current !== requestGeneration
        || scopeKeyRef.current !== requestScopeKey
      ) {
        return;
      }

      setPlayingState(false);
      setError(requestError instanceof Error ? requestError.message : "Unable to load more forecast hours");
    } finally {
      if (
        requestGenerationRef.current === requestGeneration
        && scopeKeyRef.current === requestScopeKey
      ) {
        isLoadingRef.current = false;
        setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    const current = timelineRef.current;
    if (!current || !current.hasMore) return;
    if (index < Math.max(0, current.timestamps.length - PREFETCH_REMAINING_FRAMES)) return;

    void requestMore();
  }, [index, initialTimelineKey, requestMore, scopeKey]);

  useEffect(() => {
    if (!isPlaying) return;

    // The controller always commits whole real frames. Presentation code may animate
    // between commits when motion is allowed; reduced motion advances one hour per second.
    const tickMs = reducedMotion ? REDUCED_MOTION_PLAYBACK_TICK_MS : PLAYBACK_TICK_MS;
    const activeTimestampMs = parseTimestamp(
      timelineRef.current?.timestamps[indexRef.current],
    );
    if (activeTimestampMs == null) {
      setPlayingState(false);
      return;
    }
    playbackForecastTimeRef.current = activeTimestampMs;

    const interval = window.setInterval(() => {
      const current = timelineRef.current;
      if (!current) {
        setPlayingState(false);
        return;
      }

      const playbackTime = playbackForecastTimeRef.current;
      if (playbackTime == null) {
        setPlayingState(false);
        return;
      }

      const nextForecastTime = playbackTime + HOUR_MS;
      playbackForecastTimeRef.current = nextForecastTime;
      let selectedIndex = indexRef.current;

      for (let candidateIndex = indexRef.current + 1; candidateIndex < current.timestamps.length; candidateIndex += 1) {
        const candidateTime = parseTimestamp(current.timestamps[candidateIndex]);
        if (candidateTime == null || candidateTime > nextForecastTime) break;
        if (frameHasPartitions(current, candidateIndex)) {
          selectedIndex = candidateIndex;
        }
      }

      if (selectedIndex !== indexRef.current) {
        indexRef.current = selectedIndex;
        setIndexState(selectedIndex);
      }

      const loadedEndTime = parseTimestamp(current.timestamps.at(-1));
      if (!current.hasMore && loadedEndTime != null && nextForecastTime >= loadedEndTime) {
        setPlayingState(false);
      }
    }, tickMs);

    return () => window.clearInterval(interval);
  }, [isPlaying, reducedMotion]);

  const retry = useCallback(() => {
    void requestMore();
  }, [requestMore]);

  const timestamps = timeline?.timestamps ?? [];
  const partitionsByBeach = timeline?.partitionsByBeach ?? {};
  const activeTimestamp = timestamps[index];

  return {
    timestamps,
    partitionsByBeach,
    index,
    isPlaying,
    isLoadingMore,
    isExhausted,
    error,
    timezone,
    bubbleLabel: activeTimestamp ? formatTimelineBubble(activeTimestamp, timezone) : "",
    daySegments: segmentTimelineDays(timestamps, timezone),
    setIndex,
    setPlaying: setPlayingState,
    retry,
  };
}
