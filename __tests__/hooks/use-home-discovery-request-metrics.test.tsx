import { act, renderHook } from "@testing-library/react";
import { useHomeDiscoveryRequestMetrics } from "@/hooks/use-home-discovery-request-metrics";

type HomeDiscoveryWindow = Window & {
  __quiverHomeDiscoveryRequestCount?: number;
};

function getHomeDiscoveryWindow(): HomeDiscoveryWindow {
  return window as HomeDiscoveryWindow;
}

describe("useHomeDiscoveryRequestMetrics", () => {
  it("resets the debug request count for each hook mount", () => {
    getHomeDiscoveryWindow().__quiverHomeDiscoveryRequestCount = 9;

    const first = renderHook(() => useHomeDiscoveryRequestMetrics());

    expect(getHomeDiscoveryWindow().__quiverHomeDiscoveryRequestCount).toBe(0);

    act(() => {
      first.result.current("primary");
    });
    expect(getHomeDiscoveryWindow().__quiverHomeDiscoveryRequestCount).toBe(1);

    first.unmount();
    getHomeDiscoveryWindow().__quiverHomeDiscoveryRequestCount = 12;

    renderHook(() => useHomeDiscoveryRequestMetrics());

    expect(getHomeDiscoveryWindow().__quiverHomeDiscoveryRequestCount).toBe(0);
  });

  it("clears stale discovery request marks without clearing unrelated marks", () => {
    const staleMark = "quiver:home:discovery-request:9:primary";
    const unrelatedMark = "quiver:route-change";
    const originalPerformance = globalThis.performance;
    const getEntriesByType = jest.fn(() => [
      { name: staleMark } as PerformanceEntry,
      { name: unrelatedMark } as PerformanceEntry,
    ]);
    const clearMarks = jest.fn();
    const performanceMock = Object.create(originalPerformance) as Performance;
    Object.defineProperties(performanceMock, {
      getEntriesByType: { configurable: true, value: getEntriesByType },
      clearMarks: { configurable: true, value: clearMarks },
    });
    Object.defineProperty(globalThis, "performance", {
      configurable: true,
      value: performanceMock,
    });

    try {
      renderHook(() => useHomeDiscoveryRequestMetrics());

      expect(getEntriesByType).toHaveBeenCalledWith("mark");
      expect(clearMarks).toHaveBeenCalledTimes(1);
      expect(clearMarks).toHaveBeenCalledWith(staleMark);
      expect(clearMarks).not.toHaveBeenCalledWith(unrelatedMark);
    } finally {
      Object.defineProperty(globalThis, "performance", {
        configurable: true,
        value: originalPerformance,
      });
    }
  });
});
