import { act, renderHook } from "@testing-library/react";
import type { HourlySwellTimeline, SwellPartition } from "@/app/api/forecasts/bulk/route";
import { useExpandableSwellTimeline } from "@/hooks/use-expandable-swell-timeline";

const HOUR_MS = 60 * 60 * 1000;

const partition = (s1HeightFt: number): SwellPartition => ({
  s1Dir: 270,
  s1PeriodS: 12,
  s1HeightFt,
  s2Dir: null,
  s2PeriodS: null,
  s2HeightFt: null,
  windDir: null,
  windMph: null,
});

function makeTimeline(
  startHour: number,
  hours: number,
  overrides: Partial<HourlySwellTimeline> = {},
): HourlySwellTimeline {
  const start = Date.parse("2026-07-10T00:00:00.000Z") + startHour * HOUR_MS;
  return {
    timestamps: Array.from({ length: hours }, (_, index) =>
      new Date(start + index * HOUR_MS).toISOString(),
    ),
    partitionsByBeach: {
      a: Array.from({ length: hours }, (_, index) => partition(startHour + index + 1)),
    },
    hasMore: true,
    nextStart: new Date(start + hours * HOUR_MS).toISOString(),
    ...overrides,
  };
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("useExpandableSwellTimeline", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("seeds an unchanged scope when its initial chunk arrives", () => {
    const hydrated = makeTimeline(0, 2, { hasMore: false, nextStart: null });
    const { result, rerender } = renderHook(
      ({ initial }) => useExpandableSwellTimeline({
        scopeKey: "a",
        initial,
        timezone: "Pacific/Honolulu",
        loadChunk: jest.fn(),
        reducedMotion: false,
      }),
      { initialProps: { initial: null as HourlySwellTimeline | null } },
    );

    rerender({ initial: hydrated });

    expect(result.current.timestamps).toEqual(hydrated.timestamps);
  });

  it("prefetches once when a hydrated timeline starts inside the final six frames", () => {
    const hydrated = makeTimeline(0, 4);
    const nextChunk = deferred<HourlySwellTimeline>();
    const loadChunk = jest.fn<Promise<HourlySwellTimeline>, [string, number, AbortSignal]>(
      () => nextChunk.promise,
    );
    const { rerender } = renderHook(
      ({ timeline }) => useExpandableSwellTimeline({
        scopeKey: "a",
        initial: timeline,
        timezone: "Pacific/Honolulu",
        loadChunk,
        reducedMotion: false,
      }),
      { initialProps: { timeline: null as HourlySwellTimeline | null } },
    );

    expect(loadChunk).not.toHaveBeenCalled();

    rerender({ timeline: hydrated });
    rerender({ timeline: { ...hydrated } });

    expect(loadChunk).toHaveBeenCalledTimes(1);
    expect(loadChunk).toHaveBeenCalledWith(hydrated.nextStart, 48, expect.any(AbortSignal));
  });

  it("expands a fast initial chunk to the requested ten-day background horizon", async () => {
    const initial = makeTimeline(0, 48);
    const backgroundChunk = deferred<HourlySwellTimeline>();
    const loadChunk = jest.fn<Promise<HourlySwellTimeline>, [string, number, AbortSignal]>(
      () => backgroundChunk.promise,
    );
    const { result } = renderHook(() => useExpandableSwellTimeline({
      scopeKey: "a",
      initial,
      timezone: "Pacific/Honolulu",
      loadChunk,
      reducedMotion: false,
      prefetchHours: 10 * 24,
    }));

    expect(result.current.timestamps).toHaveLength(48);
    expect(loadChunk).toHaveBeenCalledTimes(1);
    expect(loadChunk).toHaveBeenCalledWith(
      initial.nextStart,
      192,
      expect.any(AbortSignal),
    );

    const expanded = makeTimeline(48, 192);
    await act(async () => {
      backgroundChunk.resolve(expanded);
      await backgroundChunk.promise;
    });

    expect(result.current.timestamps).toHaveLength(10 * 24);
    expect(result.current.isLoadingMore).toBe(false);
    expect(result.current.isExhausted).toBe(true);
    expect(loadChunk).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setIndex(result.current.timestamps.length - 1);
    });
    expect(loadChunk).toHaveBeenCalledTimes(1);
  });

  it("deduplicates edge prefetch while the ten-day background request is active", async () => {
    const initial = makeTimeline(0, 48);
    const backgroundChunk = deferred<HourlySwellTimeline>();
    const loadChunk = jest.fn<Promise<HourlySwellTimeline>, [string, number, AbortSignal]>(
      () => backgroundChunk.promise,
    );
    const { result } = renderHook(() => useExpandableSwellTimeline({
      scopeKey: "a",
      initial,
      timezone: "Pacific/Honolulu",
      loadChunk,
      reducedMotion: false,
      prefetchHours: 10 * 24,
    }));

    act(() => {
      result.current.setIndex(47);
    });

    expect(loadChunk).toHaveBeenCalledTimes(1);

    await act(async () => {
      backgroundChunk.resolve(makeTimeline(48, 192, { hasMore: false, nextStart: null }));
      await backgroundChunk.promise;
    });
  });

  it("keeps the fast initial chunk available when background expansion fails", async () => {
    const initial = makeTimeline(0, 48);
    const backgroundChunk = deferred<HourlySwellTimeline>();
    const loadChunk = jest.fn(() => backgroundChunk.promise);
    const { result } = renderHook(() => useExpandableSwellTimeline({
      scopeKey: "a",
      initial,
      timezone: "Pacific/Honolulu",
      loadChunk,
      reducedMotion: false,
      prefetchHours: 10 * 24,
    }));

    await act(async () => {
      backgroundChunk.reject(new Error("Ten-day forecast unavailable"));
      try {
        await backgroundChunk.promise;
      } catch {
        // The controller preserves the loaded horizon and surfaces retry state.
      }
    });

    expect(result.current.timestamps).toEqual(initial.timestamps);
    expect(result.current.error).toBe("Ten-day forecast unavailable");
    expect(result.current.isLoadingMore).toBe(false);
  });

  it("hydrates corrected partitions when initial pagination metadata is unchanged", () => {
    const initial = makeTimeline(0, 2, { hasMore: false, nextStart: null });
    const corrected = {
      ...initial,
      partitionsByBeach: { a: [partition(99), partition(100)] },
    };
    const loadChunk = jest.fn();
    const { result, rerender } = renderHook(
      ({ timeline }) => useExpandableSwellTimeline({
        scopeKey: "a",
        initial: timeline,
        timezone: "Pacific/Honolulu",
        loadChunk,
        reducedMotion: false,
      }),
      { initialProps: { timeline: initial } },
    );

    rerender({ timeline: corrected });

    expect(result.current.partitionsByBeach.a).toEqual([
      partition(99),
      partition(100),
    ]);
  });

  it("restarts prefetch from corrected initial data after aborting an in-flight extension", async () => {
    const initial = makeTimeline(0, 8);
    const corrected = {
      ...initial,
      partitionsByBeach: {
        a: initial.timestamps.map(() => partition(99)),
      },
      nextStart: makeTimeline(16, 1).timestamps[0],
    };
    const staleChunk = deferred<HourlySwellTimeline>();
    const freshChunk = deferred<HourlySwellTimeline>();
    const loadChunk = jest.fn<Promise<HourlySwellTimeline>, [string, number, AbortSignal]>(
      () => staleChunk.promise,
    ).mockReturnValueOnce(staleChunk.promise).mockReturnValueOnce(freshChunk.promise);
    const { result, rerender } = renderHook(
      ({ timeline }) => useExpandableSwellTimeline({
        scopeKey: "a",
        initial: timeline,
        timezone: "Pacific/Honolulu",
        loadChunk,
        reducedMotion: false,
      }),
      { initialProps: { timeline: initial } },
    );

    act(() => {
      result.current.setIndex(2);
    });
    const staleSignal = loadChunk.mock.calls[0][2];

    rerender({ timeline: corrected });

    expect(staleSignal.aborted).toBe(true);
    expect(loadChunk).toHaveBeenCalledTimes(2);
    expect(loadChunk).toHaveBeenLastCalledWith(
      corrected.nextStart,
      48,
      expect.any(AbortSignal),
    );

    await act(async () => {
      staleChunk.resolve(makeTimeline(8, 2, { hasMore: false, nextStart: null }));
      await staleChunk.promise;
    });

    expect(result.current.timestamps).toEqual(corrected.timestamps);
    expect(result.current.partitionsByBeach.a).toEqual(corrected.partitionsByBeach.a);

    const replacement = makeTimeline(16, 2, { hasMore: false, nextStart: null });
    await act(async () => {
      freshChunk.resolve(replacement);
      await freshChunk.promise;
    });

    expect(result.current.timestamps).toEqual([
      ...corrected.timestamps,
      ...replacement.timestamps,
    ]);
    expect(result.current.partitionsByBeach.a).toEqual([
      ...corrected.partitionsByBeach.a,
      ...replacement.partitionsByBeach.a,
    ]);
    expect(result.current.isExhausted).toBe(true);
    expect(loadChunk).toHaveBeenCalledTimes(2);
  });

  it("prefetches exactly once when the index enters the final six loaded frames", async () => {
    const nextChunk = deferred<HourlySwellTimeline>();
    const loadChunk = jest.fn<Promise<HourlySwellTimeline>, [string, number, AbortSignal]>(
      () => nextChunk.promise,
    );
    const initial = makeTimeline(0, 8);
    const { result } = renderHook(() => useExpandableSwellTimeline({
      scopeKey: "a",
      initial,
      timezone: "Pacific/Honolulu",
      loadChunk,
      reducedMotion: false,
    }));

    act(() => {
      result.current.setIndex(2);
    });
    act(() => {
      result.current.setIndex(3);
    });

    expect(loadChunk).toHaveBeenCalledTimes(1);
    expect(loadChunk).toHaveBeenCalledWith(initial.nextStart, 48, expect.any(AbortSignal));

    await act(async () => {
      nextChunk.resolve(makeTimeline(8, 2, { hasMore: false, nextStart: null }));
      await nextChunk.promise;
    });
  });

  it("ignores a stale completion after the scope changes", async () => {
    const nextChunk = deferred<HourlySwellTimeline>();
    const loadChunk = jest.fn<Promise<HourlySwellTimeline>, [string, number, AbortSignal]>(
      () => nextChunk.promise,
    );
    const initial = makeTimeline(0, 8);
    const nextScopeInitial = makeTimeline(24, 2, { hasMore: false, nextStart: null });
    const { result, rerender } = renderHook(
      ({ scopeKey, timeline }) => useExpandableSwellTimeline({
        scopeKey,
        initial: timeline,
        timezone: "Pacific/Honolulu",
        loadChunk,
        reducedMotion: false,
      }),
      { initialProps: { scopeKey: "a", timeline: initial } },
    );

    act(() => {
      result.current.setIndex(2);
    });
    const staleSignal = loadChunk.mock.calls[0][2] as AbortSignal;

    rerender({ scopeKey: "b", timeline: nextScopeInitial });

    await act(async () => {
      nextChunk.resolve(makeTimeline(8, 2, { hasMore: false, nextStart: null }));
      await nextChunk.promise;
    });

    expect(staleSignal.aborted).toBe(true);
    expect(result.current.timestamps).toEqual(nextScopeInitial.timestamps);
  });

  it("marks the horizon exhausted when the extension reports no more data", async () => {
    const nextChunk = deferred<HourlySwellTimeline>();
    const loadChunk = jest.fn(() => nextChunk.promise);
    const { result } = renderHook(() => useExpandableSwellTimeline({
      scopeKey: "a",
      initial: makeTimeline(0, 8),
      timezone: "Pacific/Honolulu",
      loadChunk,
      reducedMotion: false,
    }));

    act(() => {
      result.current.setIndex(2);
    });
    await act(async () => {
      nextChunk.resolve(makeTimeline(8, 2, { hasMore: false, nextStart: null }));
      await nextChunk.promise;
    });

    expect(result.current.isExhausted).toBe(true);
  });

  it("preserves loaded frames and pauses playback when an extension fails", async () => {
    const nextChunk = deferred<HourlySwellTimeline>();
    const loadChunk = jest.fn(() => nextChunk.promise);
    const initial = makeTimeline(0, 8);
    const { result } = renderHook(() => useExpandableSwellTimeline({
      scopeKey: "a",
      initial,
      timezone: "Pacific/Honolulu",
      loadChunk,
      reducedMotion: false,
    }));

    act(() => {
      result.current.setPlaying(true);
      result.current.setIndex(2);
    });
    await act(async () => {
      nextChunk.reject(new Error("Extension unavailable"));
      try {
        await nextChunk.promise;
      } catch {
        // The controller owns extension failures and surfaces them as state.
      }
    });

    expect(result.current.timestamps).toEqual(initial.timestamps);
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.error).toBe("Extension unavailable");

    act(() => {
      result.current.setIndex(7);
    });
    expect(loadChunk).toHaveBeenCalledTimes(1);
  });

  it("freezes at the loaded boundary until a deferred gapped extension merges", async () => {
    const nextChunk = deferred<HourlySwellTimeline>();
    const loadChunk = jest.fn(() => nextChunk.promise);
    const initial = makeTimeline(0, 8);
    const { result } = renderHook(() => useExpandableSwellTimeline({
      scopeKey: "a",
      initial,
      timezone: "Pacific/Honolulu",
      loadChunk,
      reducedMotion: false,
    }));

    act(() => {
      result.current.setIndex(7);
      result.current.setPlaying(true);
    });
    expect(result.current.isLoadingMore).toBe(true);

    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(result.current.index).toBe(7);
    expect(result.current.timestamps[result.current.index]).toBe(
      "2026-07-10T07:00:00.000Z",
    );

    const gapped = makeTimeline(12, 2, { hasMore: false, nextStart: null });
    await act(async () => {
      nextChunk.resolve(gapped);
      await nextChunk.promise;
    });

    act(() => {
      jest.advanceTimersByTime(4 * 500);
    });
    expect(result.current.index).toBe(7);

    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(result.current.timestamps[result.current.index]).toBe(
      "2026-07-10T12:00:00.000Z",
    );
  });

  it("skips playback frames that cannot render the active swell layer", () => {
    const initial = makeTimeline(0, 4, { hasMore: false, nextStart: null });
    const isFramePlayable = jest.fn((_timeline: HourlySwellTimeline, index: number) =>
      index !== 1,
    );
    const { result } = renderHook(() => useExpandableSwellTimeline({
      scopeKey: "a",
      initial,
      timezone: "Pacific/Honolulu",
      loadChunk: jest.fn(),
      reducedMotion: false,
      isFramePlayable,
    }));

    act(() => {
      result.current.setPlaying(true);
      jest.advanceTimersByTime(500);
    });

    expect(result.current.index).toBe(0);

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current.index).toBe(0);

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current.index).toBe(2);
    expect(isFramePlayable).toHaveBeenCalledWith(initial, 1);
    expect(isFramePlayable).toHaveBeenCalledWith(initial, 2);
  });

  it("does not rebuild reset identity or day segments for index-only renders", () => {
    const stringifySpy = jest.spyOn(JSON, "stringify");
    const timelineUtils = jest.requireMock(
      "@/components/map/hourly-swell-timeline",
    ) as typeof import("@/components/map/hourly-swell-timeline");
    const segmentSpy = jest.spyOn(timelineUtils, "segmentTimelineDays");
    try {
      const initial = makeTimeline(0, 8, { hasMore: false, nextStart: null });
      const { result } = renderHook(() => useExpandableSwellTimeline({
        scopeKey: "a",
        initial,
        timezone: "Pacific/Honolulu",
        loadChunk: jest.fn(),
        reducedMotion: false,
      }));
      const stringifyCalls = stringifySpy.mock.calls.length;
      const segmentCalls = segmentSpy.mock.calls.length;

      act(() => {
        result.current.setIndex(1);
      });

      expect(stringifySpy).toHaveBeenCalledTimes(stringifyCalls);
      expect(segmentSpy).toHaveBeenCalledTimes(segmentCalls);
    } finally {
      stringifySpy.mockRestore();
      segmentSpy.mockRestore();
    }
  });

  it("retries a failed extension from the same next start", async () => {
    const initial = makeTimeline(0, 8);
    const firstChunk = deferred<HourlySwellTimeline>();
    const recoveryChunk = deferred<HourlySwellTimeline>();
    const loadChunk = jest.fn()
      .mockReturnValueOnce(firstChunk.promise)
      .mockReturnValueOnce(recoveryChunk.promise);
    const { result } = renderHook(() => useExpandableSwellTimeline({
      scopeKey: "a",
      initial,
      timezone: "Pacific/Honolulu",
      loadChunk,
      reducedMotion: false,
    }));

    act(() => {
      result.current.setIndex(2);
    });
    await act(async () => {
      firstChunk.reject(new Error("Extension unavailable"));
      try {
        await firstChunk.promise;
      } catch {
        // The controller owns extension failures and surfaces them as state.
      }
    });

    act(() => {
      result.current.retry();
    });

    expect(loadChunk).toHaveBeenCalledTimes(2);
    expect(loadChunk.mock.calls[1][0]).toBe(initial.nextStart);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoadingMore).toBe(true);

    await act(async () => {
      recoveryChunk.resolve(makeTimeline(8, 2, { hasMore: false, nextStart: null }));
      await recoveryChunk.promise;
    });

    expect(result.current.timestamps).toHaveLength(10);
    expect(result.current.partitionsByBeach.a.at(-1)).toEqual(partition(10));
    expect(result.current.error).toBeNull();
    expect(result.current.isLoadingMore).toBe(false);
    expect(result.current.isExhausted).toBe(true);
  });

  it("advances reduced-motion playback by one real hour per tick", () => {
    const initial = makeTimeline(0, 4, { hasMore: false, nextStart: null });
    const { result } = renderHook(() => useExpandableSwellTimeline({
      scopeKey: "a",
      initial,
      timezone: "Pacific/Honolulu",
      loadChunk: jest.fn(),
      reducedMotion: true,
    }));

    act(() => {
      result.current.setPlaying(true);
    });
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(result.current.index).toBe(1);
    expect(result.current.timestamps[result.current.index]).toBe("2026-07-10T01:00:00.000Z");
  });

  it("uses two normal-mode forecast-hour ticks before crossing a null-only two-hour gap", () => {
    const initial = makeTimeline(0, 4, {
      hasMore: false,
      nextStart: null,
      partitionsByBeach: { a: [partition(1), null, partition(3), partition(4)] },
    });
    const { result } = renderHook(() => useExpandableSwellTimeline({
      scopeKey: "a",
      initial,
      timezone: "Pacific/Honolulu",
      loadChunk: jest.fn(),
      reducedMotion: false,
    }));

    act(() => {
      result.current.setPlaying(true);
    });
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current.index).toBe(0);
    expect(result.current.partitionsByBeach.a[result.current.index]).toEqual(partition(1));

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current.index).toBe(2);
    expect(result.current.partitionsByBeach.a[result.current.index]).toEqual(partition(3));
  });

  it("uses two reduced-motion forecast-hour ticks before crossing a missing timestamp gap", () => {
    const initial = makeTimeline(0, 2, {
      timestamps: [
        "2026-07-10T00:00:00.000Z",
        "2026-07-10T02:00:00.000Z",
      ],
      partitionsByBeach: { a: [partition(1), partition(3)] },
      hasMore: false,
      nextStart: null,
    });
    const { result } = renderHook(() => useExpandableSwellTimeline({
      scopeKey: "a",
      initial,
      timezone: "Pacific/Honolulu",
      loadChunk: jest.fn(),
      reducedMotion: true,
    }));

    act(() => {
      result.current.setPlaying(true);
    });
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(result.current.index).toBe(0);

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(result.current.index).toBe(1);
  });
});
