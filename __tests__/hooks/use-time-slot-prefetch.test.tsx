import { renderHook } from "@testing-library/react";

import { useTimeSlotPrefetch } from "@/hooks/use-time-slot-prefetch";

describe("useTimeSlotPrefetch", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
    window.localStorage.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it.each([true, false])(
    "never prefetches or persists recommendation responses when enabled=%s",
    (enabled) => {
      renderHook(() =>
        useTimeSlotPrefetch({
          userLocation: { lat: 32.715, lon: -117.161 },
          radiusMiles: 50,
          horizonHours: 24,
          maxResults: 6,
          currentSlot: "any",
          enabled,
        }),
      );

      expect(global.fetch).not.toHaveBeenCalled();
      expect(
        Object.keys(window.localStorage).filter((key) =>
          key.startsWith("quiver_discovery_"),
        ),
      ).toEqual([]);
    },
  );

  it("preserves the existing hook call contract", () => {
    expect(() =>
      renderHook(() =>
        useTimeSlotPrefetch({
          currentSlot: "lunch-session",
        }),
      ),
    ).not.toThrow();
  });
});
