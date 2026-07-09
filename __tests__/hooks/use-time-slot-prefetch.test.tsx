/**
 * Unit Tests: use-time-slot-prefetch.ts
 *
 * Tests for the background prefetch hook that pre-caches discovery data
 * for all time slots to enable instant filter switching.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { useTimeSlotPrefetch } from "@/hooks/use-time-slot-prefetch";
import * as authContext from "@/context/auth-context";
import * as cacheUtils from "@/lib/utils/discovery-cache-utils";
import type { TimeSlot } from "@/types/personalization";

// Mock dependencies
jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/lib/utils/discovery-cache-utils", () => ({
  getDiscoveryCacheKey: jest.fn(),
  hasValidCache: jest.fn(),
  hashDiscoveryOptions: jest.fn(),
  writeToCache: jest.fn(),
}));

describe("useTimeSlotPrefetch", () => {
  const mockUser = { id: "test-user-123" };
  const mockLocation = { lat: 32.715, lon: -117.161 };
  const mockFetch = jest.fn();

  // Store original globals
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
    Object.defineProperty(navigator, "connection", {
      value: undefined,
      configurable: true,
    });

    // Setup fetch mock
    global.fetch = mockFetch;

    // Default mocks
    (authContext.useAuth as jest.Mock).mockReturnValue({ user: mockUser });
    (cacheUtils.hasValidCache as jest.Mock).mockReturnValue(false);
    (cacheUtils.getDiscoveryCacheKey as jest.Mock).mockImplementation(
      (userId: string, options: any) => `cache_${userId}_${options.timeSlot}`
    );
    (cacheUtils.hashDiscoveryOptions as jest.Mock).mockReturnValue("test_hash");
    (cacheUtils.writeToCache as jest.Mock).mockImplementation(() => {});

    // Default fetch response
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          recommendations: [
            {
              beach: { id: "1", name: "Test Beach" },
              window: {
                start: new Date().toISOString(),
                end: new Date().toISOString(),
              },
            },
          ],
          metadata: { generated_at: new Date().toISOString() },
        },
      }),
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("basic behavior", () => {
    it("should not prefetch when disabled", async () => {
      renderHook(() =>
        useTimeSlotPrefetch({
          userLocation: mockLocation,
          currentSlot: "any",
          enabled: false,
        })
      );

      // Wait a bit to ensure no fetch happens
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should not prefetch when user is missing", async () => {
      (authContext.useAuth as jest.Mock).mockReturnValue({ user: null });

      renderHook(() =>
        useTimeSlotPrefetch({
          userLocation: mockLocation,
          currentSlot: "any",
          enabled: true,
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should not prefetch while the document is hidden", async () => {
      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        configurable: true,
      });

      renderHook(() =>
        useTimeSlotPrefetch({
          userLocation: mockLocation,
          currentSlot: "any",
          enabled: true,
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 700));

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should not prefetch when data saver is enabled", async () => {
      Object.defineProperty(navigator, "connection", {
        value: { saveData: true, effectiveType: "4g" },
        configurable: true,
      });

      renderHook(() =>
        useTimeSlotPrefetch({
          userLocation: mockLocation,
          currentSlot: "any",
          enabled: true,
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 700));

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should not prefetch on constrained effective connections", async () => {
      Object.defineProperty(navigator, "connection", {
        value: { saveData: false, effectiveType: "2g" },
        configurable: true,
      });

      renderHook(() =>
        useTimeSlotPrefetch({
          userLocation: mockLocation,
          currentSlot: "any",
          enabled: true,
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 700));

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should prefetch other 3 time slots (excluding current)", async () => {
      renderHook(() =>
        useTimeSlotPrefetch({
          userLocation: mockLocation,
          currentSlot: "any",
          enabled: true,
        })
      );

      // Wait for 500ms delay + idle callback + fetch
      await waitFor(
        () => {
          expect(mockFetch).toHaveBeenCalledTimes(3);
        },
        { timeout: 5000 }
      );

      // Verify each slot was requested
      const fetchCalls = mockFetch.mock.calls;
      const urls = fetchCalls.map((call) => call[0] as string);

      expect(urls.some((url) => url.includes("timeSlot=dawn-patrol"))).toBe(true);
      expect(urls.some((url) => url.includes("timeSlot=lunch-session"))).toBe(true);
      expect(urls.some((url) => url.includes("timeSlot=afternoon"))).toBe(true);
      expect(urls.some((url) => url.includes("timeSlot=any"))).toBe(false);
    });

    it("should not prefetch current slot (lunch-session)", async () => {
      renderHook(() =>
        useTimeSlotPrefetch({
          userLocation: mockLocation,
          currentSlot: "lunch-session",
          enabled: true,
        })
      );

      await waitFor(
        () => {
          expect(mockFetch).toHaveBeenCalledTimes(3);
        },
        { timeout: 5000 }
      );

      const fetchCalls = mockFetch.mock.calls;
      const urls = fetchCalls.map((call) => call[0] as string);

      // Should NOT include lunch-session
      expect(urls.some((url) => url.includes("timeSlot=lunch-session"))).toBe(false);
      // Should include the other 3
      expect(urls.some((url) => url.includes("timeSlot=any"))).toBe(true);
      expect(urls.some((url) => url.includes("timeSlot=dawn-patrol"))).toBe(true);
      expect(urls.some((url) => url.includes("timeSlot=afternoon"))).toBe(true);
    });
  });

  describe("caching behavior", () => {
    it("should skip slots that already have valid cache", async () => {
      // Mock: only 'lunch-session' needs fetching, others are cached
      (cacheUtils.hasValidCache as jest.Mock).mockImplementation((key: string) => {
        return !key.includes("lunch-session");
      });

      renderHook(() =>
        useTimeSlotPrefetch({
          userLocation: mockLocation,
          currentSlot: "any",
          enabled: true,
        })
      );

      await waitFor(
        () => {
          expect(mockFetch).toHaveBeenCalledTimes(1);
        },
        { timeout: 5000 }
      );

      expect(mockFetch.mock.calls[0][0]).toContain("timeSlot=lunch-session");
    });

    it("should not prefetch if all slots are already cached", async () => {
      (cacheUtils.hasValidCache as jest.Mock).mockReturnValue(true);

      renderHook(() =>
        useTimeSlotPrefetch({
          userLocation: mockLocation,
          currentSlot: "any",
          enabled: true,
        })
      );

      // Wait a bit to ensure no fetch happens
      await new Promise((resolve) => setTimeout(resolve, 1500));

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should write fetched data to cache", async () => {
      renderHook(() =>
        useTimeSlotPrefetch({
          userLocation: mockLocation,
          currentSlot: "any",
          enabled: true,
        })
      );

      await waitFor(
        () => {
          expect(cacheUtils.writeToCache).toHaveBeenCalled();
        },
        { timeout: 5000 }
      );
    });
  });

  describe("error handling", () => {
    it("should handle non-ok response silently", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
      });

      renderHook(() =>
        useTimeSlotPrefetch({
          userLocation: mockLocation,
          currentSlot: "any",
          enabled: true,
        })
      );

      await waitFor(
        () => {
          expect(mockFetch).toHaveBeenCalled();
        },
        { timeout: 5000 }
      );

      // Should not write to cache on failure
      expect(cacheUtils.writeToCache).not.toHaveBeenCalled();
    });

    it("should handle fetch rejection silently", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const consoleDebugSpy = jest.spyOn(console, "debug").mockImplementation();

      renderHook(() =>
        useTimeSlotPrefetch({
          userLocation: mockLocation,
          currentSlot: "any",
          enabled: true,
        })
      );

      await waitFor(
        () => {
          expect(mockFetch).toHaveBeenCalled();
        },
        { timeout: 5000 }
      );

      // Wait for error handling
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should not write to cache on error
      expect(cacheUtils.writeToCache).not.toHaveBeenCalled();

      consoleDebugSpy.mockRestore();
    });
  });

  describe("cleanup behavior", () => {
    it("should clear timeout on unmount before delay completes", async () => {
      const { unmount } = renderHook(() =>
        useTimeSlotPrefetch({
          userLocation: mockLocation,
          currentSlot: "any",
          enabled: true,
        })
      );

      // Unmount immediately (before 500ms delay)
      unmount();

      // Wait past where prefetch would have triggered
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Should not have fetched
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("location change behavior", () => {
    it("should reset prefetch tracking when location changes significantly", async () => {
      const { rerender } = renderHook(
        ({ location }) =>
          useTimeSlotPrefetch({
            userLocation: location,
            currentSlot: "any",
            enabled: true,
          }),
        { initialProps: { location: mockLocation } }
      );

      // Wait for first prefetch cycle
      await waitFor(
        () => {
          expect(mockFetch).toHaveBeenCalledTimes(3);
        },
        { timeout: 5000 }
      );

      // Clear mocks for second cycle
      mockFetch.mockClear();
      (cacheUtils.hasValidCache as jest.Mock).mockReturnValue(false);

      // Change location by ~11km (0.1 degree)
      const newLocation = { lat: 32.815, lon: -117.261 };
      rerender({ location: newLocation });

      // Should prefetch again for new location
      await waitFor(
        () => {
          expect(mockFetch).toHaveBeenCalled();
        },
        { timeout: 5000 }
      );
    });

    it("should not reset tracking for small location changes", async () => {
      const { rerender } = renderHook(
        ({ location }) =>
          useTimeSlotPrefetch({
            userLocation: location,
            currentSlot: "any",
            enabled: true,
          }),
        { initialProps: { location: mockLocation } }
      );

      // Wait for first prefetch cycle
      await waitFor(
        () => {
          expect(mockFetch).toHaveBeenCalledTimes(3);
        },
        { timeout: 5000 }
      );

      mockFetch.mockClear();

      // Small location change (<0.1 degree ~ <11km)
      const nearbyLocation = { lat: 32.716, lon: -117.162 };
      rerender({ location: nearbyLocation });

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Should NOT have prefetched again (same location key when rounded to 0.1)
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("URL construction", () => {
    it("should include all parameters in fetch URL", async () => {
      renderHook(() =>
        useTimeSlotPrefetch({
          userLocation: mockLocation,
          radiusMiles: 50,
          horizonHours: 24,
          maxResults: 6,
          currentSlot: "any",
          enabled: true,
        })
      );

      await waitFor(
        () => {
          expect(mockFetch).toHaveBeenCalled();
        },
        { timeout: 5000 }
      );

      const fetchUrl = mockFetch.mock.calls[0][0] as string;

      expect(fetchUrl).toContain("lat=32.715");
      expect(fetchUrl).toContain("lon=-117.161");
      expect(fetchUrl).toContain("radius=50");
      expect(fetchUrl).toContain("horizonHours=24");
      expect(fetchUrl).toContain("maxResults=6");
      expect(fetchUrl).toContain("timeSlot=");
    });

    it("should work without optional parameters", async () => {
      renderHook(() =>
        useTimeSlotPrefetch({
          currentSlot: "any",
          enabled: true,
        })
      );

      await waitFor(
        () => {
          expect(mockFetch).toHaveBeenCalled();
        },
        { timeout: 5000 }
      );

      const fetchUrl = mockFetch.mock.calls[0][0] as string;

      // Should still have timeSlot but not location params
      expect(fetchUrl).toContain("timeSlot=");
      expect(fetchUrl).not.toContain("lat=");
      expect(fetchUrl).not.toContain("lon=");
    });
  });
});
