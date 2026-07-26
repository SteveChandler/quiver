import { act, renderHook } from "@testing-library/react";
import { useHomeDiscoveryRequestMetrics } from "@/hooks/use-home-discovery-request-metrics";
import { captureClientPostHogEventAfterConsent } from "@/lib/posthog-client";

jest.mock("@/lib/posthog-client", () => ({
  captureClientPostHogEventAfterConsent: jest.fn(),
}));

const capturePostHogEventMock = jest.mocked(
  captureClientPostHogEventAfterConsent,
);

type HomeDiscoveryWindow = Window & {
  __quiverHomeDiscoveryRequestCount?: number;
};

function getHomeDiscoveryWindow(): HomeDiscoveryWindow {
  return window as HomeDiscoveryWindow;
}

describe("useHomeDiscoveryRequestMetrics", () => {
  beforeEach(() => {
    capturePostHogEventMock.mockClear();
  });

  it("records discovery requests against one home-load budget", () => {
    const { result } = renderHook(() => useHomeDiscoveryRequestMetrics());

    act(() => {
      result.current("primary");
      result.current("fallback");
    });

    expect(capturePostHogEventMock).toHaveBeenCalledTimes(2);
    const firstProperties = capturePostHogEventMock.mock.calls[0][1];
    const secondProperties = capturePostHogEventMock.mock.calls[1][1];

    expect(firstProperties).toEqual({
      home_load_id: expect.any(String),
      request_number: 1,
      source: "primary",
    });
    expect(secondProperties).toEqual({
      home_load_id: firstProperties?.home_load_id,
      request_number: 2,
      source: "fallback",
    });
  });

  it("uses a new budget identifier for a new home load", () => {
    const first = renderHook(() => useHomeDiscoveryRequestMetrics());

    act(() => {
      first.result.current("primary");
    });
    const firstLoadId = capturePostHogEventMock.mock.calls[0][1]?.home_load_id;

    first.unmount();
    capturePostHogEventMock.mockClear();

    const second = renderHook(() => useHomeDiscoveryRequestMetrics());
    act(() => {
      second.result.current("primary");
    });
    const secondLoadId = capturePostHogEventMock.mock.calls[0][1]?.home_load_id;

    expect(firstLoadId).toEqual(expect.any(String));
    expect(secondLoadId).toEqual(expect.any(String));
    expect(secondLoadId).not.toBe(firstLoadId);
  });

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
