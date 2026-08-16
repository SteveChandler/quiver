"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  prefetchHours?: number;
  isFramePlayable?: (timeline: HourlySwellTimeline, index: number) => boolean;
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

function capTimelineHorizon(
  timeline: HourlySwellTimeline | null,
  horizonHours: number,
): HourlySwellTimeline | null {
  if (!timeline || horizonHours <= 0 || timeline.timestamps.length === 0) {
    return timeline;
  }

  const firstTimestamp = parseTimestamp(timeline.timestamps[0]);
  const lastTimestamp = parseTimestamp(timeline.timestamps.at(-1));
  if (firstTimestamp == null || lastTimestamp == null) return timeline;

  const horizonEnd = firstTimestamp + horizonHours * HOUR_MS;
  if (lastTimestamp < horizonEnd - HOUR_MS) return timeline;

  const timestamps = timeline.timestamps.filter(
    (timestamp) => Date.parse(timestamp) < horizonEnd,
  );
  return {
    timestamps,
    partitionsByBeach: Object.fromEntries(
      Object.entries(timeline.partitionsByBeach).map(([beachId, partitions]) => [
        beachId,
        partitions.slice(0, timestamps.length),
      ]),
    ),
    hasMore: false,
    nextStart: null,
  };
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
  prefetchHours = 0,
  isFramePlayable = frameHasPartitions,
}: UseExpandableSwellTimelineArgs): UseExpandableSwellTimelineResult {
  const prefetchTargetHours = Number.isFinite(prefetchHours)
    ? Math.max(0, Math.floor(prefetchHours))
    : 0;
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
  const isFramePlayableRef = useRef(isFramePlayable);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestGenerationRef = useRef(0);
  const isLoadingRef = useRef(false);
  const backgroundPrefetchRequestedRef = useRef(false);
  const lastRequestedHoursRef = useRef(CHUNK_HOURS);
  const playbackForecastTimeRef = useRef<number | null>(null);
  const horizonHoursRef = useRef(prefetchTargetHours);
  horizonHoursRef.current = prefetchTargetHours;
  const initialTimelineKey = useMemo(
    () => timelineResetIdentity(initial),
    [initial],
  );

  useEffect(() => {
    initialRef.current = initial;
    scopeKeyRef.current = scopeKey;
    loadChunkRef.current = loadChunk;
    isFramePlayableRef.current = isFramePlayable;
  }, [initial, isFramePlayable, loadChunk, scopeKey]);

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
    const nextTimeline = capTimelineHorizon(
      initialRef.current,
      horizonHoursRef.current,
    );
    const nextIndex = nearestTimestampIndex(nextTimeline?.timestamps ?? [], previousTimestamp);

    requestGenerationRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    isLoadingRef.current = false;
    backgroundPrefetchRequestedRef.current = false;
    lastRequestedHoursRef.current = CHUNK_HOURS;
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

  const requestMore = useCallback(async (requestedHours = CHUNK_HOURS): Promise<void> => {
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
      const hours = Number.isFinite(requestedHours)
        ? Math.max(1, Math.floor(requestedHours))
        : CHUNK_HOURS;
      lastRequestedHoursRef.current = hours;
      const incoming = await loadChunkRef.current(start, hours, controller.signal);
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
      const merged = capTimelineHorizon(
        mergeHourlyTimeline(latest, incoming),
        horizonHoursRef.current,
      )!;
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
    if (
      !current
      || prefetchTargetHours === 0
      || !current.hasMore
      || isLoadingMore
      || error
      || backgroundPrefetchRequestedRef.current
    ) {
      return;
    }

    const firstTimestamp = parseTimestamp(current.timestamps[0]);
    const lastTimestamp = parseTimestamp(current.timestamps.at(-1));
    const loadedHours = firstTimestamp != null && lastTimestamp != null
      ? Math.max(0, Math.floor((lastTimestamp - firstTimestamp) / HOUR_MS) + 1)
      : 0;
    if (loadedHours >= prefetchTargetHours) return;

    backgroundPrefetchRequestedRef.current = true;
    void requestMore(prefetchTargetHours - loadedHours);
  }, [
    error,
    isLoadingMore,
    prefetchTargetHours,
    requestMore,
    scopeKey,
    timeline,
  ]);

  useEffect(() => {
    const current = timelineRef.current;
    if (!current || !current.hasMore || error) return;
    if (index < Math.max(0, current.timestamps.length - PREFETCH_REMAINING_FRAMES)) return;

    void requestMore();
  }, [error, index, initialTimelineKey, requestMore, scopeKey]);

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

      const loadedEndTime = parseTimestamp(current.timestamps.at(-1));
      if (current.hasMore && loadedEndTime != null && playbackTime >= loadedEndTime) {
        playbackForecastTimeRef.current = loadedEndTime;
        return;
      }

      const nextForecastTime = current.hasMore && loadedEndTime != null
        ? Math.min(playbackTime + HOUR_MS, loadedEndTime)
        : playbackTime + HOUR_MS;
      playbackForecastTimeRef.current = nextForecastTime;
      let selectedIndex = indexRef.current;

      for (let candidateIndex = indexRef.current + 1; candidateIndex < current.timestamps.length; candidateIndex += 1) {
        const candidateTime = parseTimestamp(current.timestamps[candidateIndex]);
        if (candidateTime == null || candidateTime > nextForecastTime) break;
        if (isFramePlayableRef.current(current, candidateIndex)) {
          selectedIndex = candidateIndex;
        }
      }

      if (selectedIndex !== indexRef.current) {
        indexRef.current = selectedIndex;
        setIndexState(selectedIndex);
      }

      if (!current.hasMore && loadedEndTime != null && nextForecastTime >= loadedEndTime) {
        setPlayingState(false);
      }
    }, tickMs);

    return () => window.clearInterval(interval);
  }, [isPlaying, reducedMotion]);

  const retry = useCallback(() => {
    void requestMore(lastRequestedHoursRef.current);
  }, [requestMore]);

  const timestamps = useMemo(() => timeline?.timestamps ?? [], [timeline]);
  const partitionsByBeach = useMemo(
    () => timeline?.partitionsByBeach ?? {},
    [timeline],
  );
  const activeTimestamp = timestamps[index];
  const bubbleLabel = useMemo(
    () => activeTimestamp ? formatTimelineBubble(activeTimestamp, timezone) : "",
    [activeTimestamp, timezone],
  );
  const daySegments = useMemo(
    () => segmentTimelineDays(timestamps, timezone),
    [timestamps, timezone],
  );

  return {
    timestamps,
    partitionsByBeach,
    index,
    isPlaying,
    isLoadingMore,
    isExhausted,
    error,
    timezone,
    bubbleLabel,
    daySegments,
    setIndex,
    setPlaying: setPlayingState,
    retry,
  };
}
