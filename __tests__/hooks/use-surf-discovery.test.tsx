/**
 * Unit tests for useSurfDiscovery hook
 *
 * Tests validate:
 * - Basic fetching with authentication
 * - Control flag behavior (enabled, immediate)
 * - Dependency stability (critical for optimization)
 * - Options handling
 * - Error handling and callbacks
 * - Data transformation
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useSurfDiscovery } from "@/hooks/use-surf-discovery";
import type { SurfDiscoveryResponse } from "@/types/personalization";

// Mock auth context
const mockUser = { id: "user-123", email: "test@example.com" };
jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(() => ({ user: mockUser })),
}));

// Don't mock useDataFetcher - let it work normally for integration testing

describe("useSurfDiscovery", () => {
  // Suppress console.log during tests to avoid log spam
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;

  beforeAll(() => {
    console.log = jest.fn();
    console.warn = jest.fn();
  });

  afterAll(() => {
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
  });

  const mockDiscoveryResponse: SurfDiscoveryResponse = {
    recommendations: [
      {
        beach: {
          id: "beach-1",
          name: "Ocean Beach",
          slug: "ocean-beach",
          city: "San Diego",
          state: "CA",
          lat: 32.75,
          lon: -117.25,
        } as any,
        window: {
          start: new Date("2025-12-16T15:00:00Z"),
          end: new Date("2025-12-16T18:00:00Z"),
          tide: "Rising",
          wind: "5 mph SW",
          waveHeight: "3-4 ft",
          wavePeriod: "12s",
          dataSource: "NOAA_NWS",
          confidence: 85,
          timezone: "America/Los_Angeles",
        },
        forecast: {} as any,
        score: 85,
        matchQuality: "excellent",
        subscores: {
          waveHeightFit: 20,
          periodEnergyScore: 18,
          windAlignment: 17,
          tideFit: 12,
          affinityBonus: 10,
          distancePenalty: -5,
        },
        summary: "Perfect conditions for your skill level",
        reasons: ["Offshore winds", "Good swell period"],
        warnings: [],
        generated_at: "2025-12-16T14:00:00Z",
      },
    ],
    searchCriteria: {
      maxResults: 5,
    },
    metadata: {
      totalBeachesConsidered: 5,
      successfulForecasts: 5,
      failedBeaches: 0,
      staleBeaches: 0,
      partialSuccess: false,
      generated_at: "2025-12-16T14:00:00Z",
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    // Ensure localStorage-based discovery cache doesn't leak between tests.
    // This hook intentionally reads from localStorage on mount.
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.clear();
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Basic Functionality", () => {
    it("fetches discovery data when user is authenticated", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            ...mockDiscoveryResponse,
            recommendations: mockDiscoveryResponse.recommendations.map(
              (rec) => ({
                ...rec,
                window: {
                  ...rec.window,
                  start: rec.window.start.toISOString(),
                  end: rec.window.end.toISOString(),
                },
              })
            ),
          },
        }),
      });

      const { result } = renderHook(() =>
        useSurfDiscovery({ immediate: true })
      );

      expect(result.current.loading).toBe(true);

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.discovery).not.toBeNull();
      expect(result.current.hasRecommendations).toBe(true);
      expect(result.current.error).toBeNull();
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("skips fetch when user is not authenticated", async () => {
      const { useAuth } = require("@/context/auth-context");
      useAuth.mockReturnValueOnce({ user: null });

      const { result } = renderHook(() =>
        useSurfDiscovery({ immediate: true })
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.discovery).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("respects enabled flag set to false", async () => {
      const { result } = renderHook(() =>
        useSurfDiscovery({ enabled: false, immediate: true })
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.discovery).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("respects immediate flag set to false", async () => {
      const { result } = renderHook(() =>
        useSurfDiscovery({ immediate: false })
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.discovery).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe("Options Handling", () => {
    it("passes maxResults parameter correctly", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockDiscoveryResponse }),
      });

      renderHook(() => useSurfDiscovery({ maxResults: 3, immediate: true }));

      await waitFor(() => expect(global.fetch).toHaveBeenCalled());

      const fetchUrl = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(fetchUrl).toContain("maxResults=3");
    });

    it("passes userLocation and radiusMiles correctly", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockDiscoveryResponse }),
      });

      renderHook(() =>
        useSurfDiscovery({
          userLocation: { lat: 32.75, lon: -117.25 },
          radiusMiles: 50,
          immediate: true,
        })
      );

      await waitFor(() => expect(global.fetch).toHaveBeenCalled());

      const fetchUrl = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(fetchUrl).toContain("lat=32.75");
      expect(fetchUrl).toContain("lon=-117.25");
      expect(fetchUrl).toContain("radius=50");
    });

    it("handles includeHome option", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockDiscoveryResponse }),
      });

      renderHook(() =>
        useSurfDiscovery({ includeHome: false, immediate: true })
      );

      await waitFor(() => expect(global.fetch).toHaveBeenCalled());

      const fetchUrl = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(fetchUrl).toContain("includeHome=false");
    });
  });

  describe("Error Handling", () => {
    it("handles API errors gracefully", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: "Internal server error" }),
      });

      const { result } = renderHook(() =>
        useSurfDiscovery({ immediate: true })
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.discovery).toBeNull();
    });

    it("calls onError callback on failure", async () => {
      const onError = jest.fn();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: "Not found" }),
      });

      renderHook(() => useSurfDiscovery({ immediate: true, onError }));

      await waitFor(() => expect(onError).toHaveBeenCalled());
      expect(onError).toHaveBeenCalledWith(
        expect.stringContaining("Not found")
      );
    });

    it("calls onSuccess callback on success", async () => {
      const onSuccess = jest.fn();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            ...mockDiscoveryResponse,
            recommendations: mockDiscoveryResponse.recommendations.map(
              (rec) => ({
                ...rec,
                window: {
                  ...rec.window,
                  start: rec.window.start.toISOString(),
                  end: rec.window.end.toISOString(),
                },
              })
            ),
          },
        }),
      });

      renderHook(() => useSurfDiscovery({ immediate: true, onSuccess }));

      await waitFor(() => expect(onSuccess).toHaveBeenCalled());
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          recommendations: expect.any(Array),
          metadata: expect.any(Object),
        })
      );
    });
  });

  describe("Data Transformation", () => {
    it("transforms date strings to Date objects correctly", async () => {
      const responseWithStringDates = {
        ...mockDiscoveryResponse,
        recommendations: mockDiscoveryResponse.recommendations.map((rec) => ({
          ...rec,
          window: {
            ...rec.window,
            start: "2025-12-16T15:00:00Z",
            end: "2025-12-16T18:00:00Z",
          },
        })),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: responseWithStringDates }),
      });

      const { result } = renderHook(() =>
        useSurfDiscovery({ immediate: true })
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.discovery).not.toBeNull();
      const window = result.current.discovery!.recommendations[0].window;
      expect(window.start).toBeInstanceOf(Date);
      expect(window.end).toBeInstanceOf(Date);
    });

    it("returns recommendations with correct structure", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            ...mockDiscoveryResponse,
            recommendations: mockDiscoveryResponse.recommendations.map(
              (rec) => ({
                ...rec,
                window: {
                  ...rec.window,
                  start: rec.window.start.toISOString(),
                  end: rec.window.end.toISOString(),
                },
              })
            ),
          },
        }),
      });

      const { result } = renderHook(() =>
        useSurfDiscovery({ immediate: true })
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.discovery).toMatchObject({
        recommendations: expect.arrayContaining([
          expect.objectContaining({
            beach: expect.objectContaining({
              id: expect.any(String),
              name: expect.any(String),
            }),
            window: expect.objectContaining({
              start: expect.any(Date),
              end: expect.any(Date),
              tide: expect.any(String),
              wind: expect.any(String),
            }),
            score: expect.any(Number),
            summary: expect.any(String),
            reasons: expect.any(Array),
          }),
        ]),
        metadata: expect.objectContaining({
          totalBeachesConsidered: expect.any(Number),
          successfulForecasts: expect.any(Number),
        }),
      });
    });
  });

  describe("Dependency Stability (Critical for Optimization)", () => {
    it("maintains stable refetch callback reference", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockDiscoveryResponse }),
      });

      const { result, rerender } = renderHook(
        ({ immediate }) => useSurfDiscovery({ maxResults: 3, immediate }),
        { initialProps: { immediate: true } }
      );

      await waitFor(() => expect(result.current.loading).toBe(false));
      const firstRefetch = result.current.refetch;

      // Change control flag - refetch should remain stable
      rerender({ immediate: false });
      expect(result.current.refetch).toBe(firstRefetch);
    });

    it("refetch works correctly after control flag changes", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            ...mockDiscoveryResponse,
            recommendations: mockDiscoveryResponse.recommendations.map(
              (rec) => ({
                ...rec,
                window: {
                  ...rec.window,
                  start: rec.window.start.toISOString(),
                  end: rec.window.end.toISOString(),
                },
              })
            ),
          },
        }),
      });

      const { result, rerender } = renderHook(
        ({ enabled }) => useSurfDiscovery({ enabled, immediate: true }),
        { initialProps: { enabled: false } }
      );

      // Should not fetch when disabled
      expect(global.fetch).not.toHaveBeenCalled();

      // Enable and manually refetch
      rerender({ enabled: true });
      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(global.fetch).toHaveBeenCalled();
      expect(result.current.discovery).not.toBeNull();
    });
  });

  describe("Convenience Helpers", () => {
    it("hasRecommendations returns true when recommendations exist", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            ...mockDiscoveryResponse,
            recommendations: mockDiscoveryResponse.recommendations.map(
              (rec) => ({
                ...rec,
                window: {
                  ...rec.window,
                  start: rec.window.start.toISOString(),
                  end: rec.window.end.toISOString(),
                },
              })
            ),
          },
        }),
      });

      const { result } = renderHook(() =>
        useSurfDiscovery({ immediate: true })
      );

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.hasRecommendations).toBe(true);
    });

    it("hasRecommendations returns false when no recommendations", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            recommendations: [],
            metadata: mockDiscoveryResponse.metadata,
          },
        }),
      });

      const { result } = renderHook(() =>
        useSurfDiscovery({ immediate: true })
      );

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.hasRecommendations).toBe(false);
    });
  });
});
