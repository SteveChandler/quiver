import { renderHook, act, waitFor } from "@testing-library/react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { RequestCache } from "@/lib/utils/request-cache";

// Replace the shared apiCache with a real RequestCache per test so we can inspect it
// without relying on global state between test runs.
jest.mock("@/lib/utils/request-cache", () => {
  const actual = jest.requireActual<typeof import("@/lib/utils/request-cache")>(
    "@/lib/utils/request-cache"
  );
  return {
    ...actual,
    // Each test gets a fresh apiCache by re-constructing
    apiCache: new actual.RequestCache({ ttl: 60000, maxSize: 50 }),
  };
});

describe("useDataFetcher", () => {
  it("ignores an older request that resolves after a newer refetch", async () => {
    let resolveFirst!: (value: { version: number }) => void;
    let resolveSecond!: (value: { version: number }) => void;
    const first = new Promise<{ version: number }>((resolve) => {
      resolveFirst = resolve;
    });
    const second = new Promise<{ version: number }>((resolve) => {
      resolveSecond = resolve;
    });
    const fetcher = jest
      .fn()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second);
    const { result } = renderHook(() => useDataFetcher(fetcher));

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    act(() => {
      void result.current.refetch();
    });
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));

    await act(async () => {
      resolveSecond({ version: 2 });
      await second;
    });
    expect(result.current.data).toEqual({ version: 2 });

    await act(async () => {
      resolveFirst({ version: 1 });
      await first;
    });
    expect(result.current.data).toEqual({ version: 2 });
  });

  it("sets loading then data on success", async () => {
    const fetcher = jest.fn().mockResolvedValue({ hello: "world" });
    const { result } = renderHook(() => useDataFetcher(fetcher));

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ hello: "world" });
    expect(result.current.error).toBeNull();
  });

  it("captures and exposes errors", async () => {
    const fetcher = jest.fn().mockRejectedValue(new Error("Nope"));
    const { result } = renderHook(() => useDataFetcher(fetcher));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe("Nope");
  });

  it("supports refetch and reset", async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce({ a: 1 })
      .mockResolvedValueOnce({ a: 2 });

    const { result } = renderHook(() => useDataFetcher(fetcher));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ a: 1 });

    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.data).toEqual({ a: 2 });

    act(() => {
      result.current.reset();
    });
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("respects skip and triggers when skip flips to false", async () => {
    const fetcher = jest.fn().mockResolvedValue({ ok: true });
    const { result, rerender } = renderHook(
      ({ skip }) => useDataFetcher(fetcher, { immediate: true, skip }),
      {
        initialProps: { skip: true },
      }
    );

    expect(result.current.loading).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();

    rerender({ skip: false });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  describe("cacheKey / cacheTTL behavior", () => {
    it("seeds initial state from cache when cacheKey hits", async () => {
      // Pre-populate a real cache instance
      const cache = new RequestCache({ ttl: 60000, maxSize: 10 });
      cache.set("test-key", { cached: true });

      const fetcher = jest.fn().mockResolvedValue({ cached: false });
      const { result } = renderHook(() =>
        useDataFetcher(fetcher, { cacheKey: "test-key", cache })
      );

      // Initial state should be seeded from cache — no loading
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual({ cached: true });

      // The effect will run and call fetchData(bypassCache=false) but the
      // in-flight cache check returns the hit, so the network is never called.
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(fetcher).not.toHaveBeenCalled();
    });

    it("fetches and populates cache on cache miss", async () => {
      const cache = new RequestCache({ ttl: 60000, maxSize: 10 });
      const fetcher = jest.fn().mockResolvedValue({ fresh: true });

      const { result } = renderHook(() =>
        useDataFetcher(fetcher, { cacheKey: "miss-key", cache })
      );

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.data).toEqual({ fresh: true });
      expect(fetcher).toHaveBeenCalledTimes(1);

      // Cache should now hold the result
      expect(cache.get("miss-key")).toEqual({ fresh: true });
    });

    it("refetch bypasses cache and re-populates it", async () => {
      const cache = new RequestCache({ ttl: 60000, maxSize: 10 });
      cache.set("refetch-key", { version: 1 });

      const fetcher = jest.fn().mockResolvedValue({ version: 2 });

      const { result } = renderHook(() =>
        useDataFetcher(fetcher, { cacheKey: "refetch-key", cache })
      );

      // Initial state is from cache
      expect(result.current.data).toEqual({ version: 1 });

      // refetch should bypass cache and hit the network
      await act(async () => {
        await result.current.refetch();
      });

      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(result.current.data).toEqual({ version: 2 });
      // Cache is updated with new value
      expect(cache.get("refetch-key")).toEqual({ version: 2 });
    });

    it("invalidateCache removes the entry without triggering a fetch", () => {
      const cache = new RequestCache({ ttl: 60000, maxSize: 10 });
      cache.set("inv-key", { stored: true });

      const fetcher = jest.fn().mockResolvedValue({ stored: false });

      const { result } = renderHook(() =>
        useDataFetcher(fetcher, { cacheKey: "inv-key", cache })
      );

      act(() => {
        result.current.invalidateCache();
      });

      expect(cache.get("inv-key")).toBeNull();
    });

    it("behaves identically to no-cache mode when cacheKey is omitted", async () => {
      const fetcher = jest.fn().mockResolvedValue({ no: "cache" });
      const { result } = renderHook(() => useDataFetcher(fetcher));

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.data).toEqual({ no: "cache" });
      // invalidateCache is a no-op when there is no key
      act(() => {
        result.current.invalidateCache();
      });
    });
  });
});
