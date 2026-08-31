describe("app-handoff tracking module import safety", () => {
  it("does not track or fetch while the exact-call emitter module loads", async () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn();
    const trackMock = jest.fn();

    global.fetch = fetchMock as typeof fetch;
    jest.resetModules();
    jest.doMock("@/lib/analytics", () => ({ track: trackMock }));

    try {
      await jest.isolateModulesAsync(async () => {
        await import("@/lib/analytics/app-handoff-tracking");
      });

      expect(trackMock).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }
  });
});
