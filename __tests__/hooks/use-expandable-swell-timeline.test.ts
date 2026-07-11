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
  });

  it("retries a failed extension from the same next start", async () => {
    const initial = makeTimeline(0, 8);
    const firstChunk = deferred<HourlySwellTimeline>();
    const loadChunk = jest.fn()
      .mockReturnValueOnce(firstChunk.promise)
      .mockResolvedValueOnce(makeTimeline(8, 2, { hasMore: false, nextStart: null }));
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

    await act(async () => {
      result.current.retry();
      await Promise.resolve();
    });

    expect(loadChunk).toHaveBeenCalledTimes(2);
    expect(loadChunk.mock.calls[1][0]).toBe(initial.nextStart);
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

  it("skips null-only timestamps during playback instead of retaining stale partitions", () => {
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

    expect(result.current.index).toBe(2);
  });
});
