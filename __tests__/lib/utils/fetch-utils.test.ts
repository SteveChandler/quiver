import { fetchWithTimeout } from "@/lib/utils/fetch-utils";

describe("fetchWithTimeout", () => {
  const originalFetch = global.fetch as any;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  test("resolves with fetch response before timeout", async () => {
    const mockResponse = new Response(JSON.stringify({ ok: true }), {
      status: 200,
    });
    global.fetch = jest.fn().mockResolvedValue(mockResponse);

    const res = await fetchWithTimeout("/api/test", { timeoutMs: 50 });
    expect(res.status).toBe(200);
    expect(global.fetch).toHaveBeenCalled();
  });

  test("aborts when exceeding timeout", async () => {
    jest.useFakeTimers();
    // Simulate a fetch that rejects when the AbortSignal is aborted
    global.fetch = jest.fn(
      (_input: any, init: any) =>
        new Promise((_resolve, reject) => {
          const signal: AbortSignal | undefined = init?.signal;
          if (signal) {
            if (signal.aborted) {
              return reject(new Error("aborted"));
            }
            signal.addEventListener("abort", () =>
              reject(new Error("aborted"))
            );
          }
          // otherwise never resolve to rely on timeout
        })
    );

    const promise = fetchWithTimeout("/slow", { timeoutMs: 10 });
    // Fast-forward timers to trigger abort
    jest.advanceTimersByTime(11);
    // Flush any pending microtasks
    await Promise.resolve();
    await expect(promise).rejects.toThrow(/aborted|AbortError|aborted/i);
  }, 15000);
});
