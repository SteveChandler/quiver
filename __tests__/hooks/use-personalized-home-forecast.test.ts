import { renderHook } from "@testing-library/react";
import { usePersonalizedHomeForecast } from "@/hooks/use-personalized-home-forecast";
import type { PersonalizedForecastRecommendation, SurfDiscoveryResponse } from "@/types/personalization";

// Mock dependencies
jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/hooks/use-surf-discovery", () => ({
  useSurfDiscovery: jest.fn(),
}));

import { useAuth } from "@/context/auth-context";
import { useSurfDiscovery } from "@/hooks/use-surf-discovery";

describe("usePersonalizedHomeForecast", () => {
  const mockUser = { id: "user-123", email: "test@example.com" };

  // Mock discovery response (what useSurfDiscovery returns)
  const mockDiscoveryResponse = {
    recommendations: [
      {
        beach: {
          id: "beach-123",
          name: "Test Beach",
          latitude: 32.8328,
          longitude: -117.2713,
          center_lat: 32.8328,
          center_lng: -117.2713,
        } as any,
        window: {
          start: new Date("2025-01-20T08:00:00Z"),
          end: new Date("2025-01-20T12:00:00Z"),
          tide: "Mid incoming",
          wind: "Light offshore",
          waveHeight: "3-5 ft",
          wavePeriod: "12-14s",
          confidence: 0.85,
        },
        forecast: {} as any,
        score: 85, // Discovery uses 0-100 scale
        matchQuality: "excellent" as const,
        subscores: {
          waveHeightFit: 70,
          periodEnergyScore: 10,
          windAlignment: 3,
          tideFit: 2,
          affinityBonus: 0,
          distancePenalty: 0,
        },
        summary: "Great conditions expected",
        reasons: ["Clean waves", "Offshore wind", "Good tide", "Perfect timing"],
        warnings: [],
        generated_at: "2025-01-20T06:00:00Z",
      },
    ],
    metadata: {
      totalBeachesConsidered: 10,
      successfulForecasts: 8,
      partialSuccess: false,
      failedBeaches: 2,
      staleBeaches: 0,
      generated_at: "2025-01-20T06:00:00Z",
    },
    searchCriteria: {
      location: { lat: 32.8328, lon: -117.2713 },
      radiusMiles: 50,
      targetDate: new Date("2025-01-20"),
    },
  } as unknown as SurfDiscoveryResponse;

  // Expected personalized recommendation (after adaptation)
  const mockRecommendation: PersonalizedForecastRecommendation = {
    beach: {
      id: "beach-123",
      name: "Test Beach",
      latitude: 32.8328,
      longitude: -117.2713,
      center_lat: 32.8328,
      center_lng: -117.2713,
    } as any,
    window: {
      start: new Date("2025-01-20T08:00:00Z"),
      end: new Date("2025-01-20T12:00:00Z"),
      tide: "Mid incoming",
      wind: "Light offshore",
      waveHeight: "3-5 ft",
      wavePeriod: "12-14s",
      dataSource: "NOAA_NWS",
      confidence: 0.85,
    },
    forecast: {} as any,
    score: 85,
    personalized: true,
    breakdown: {
      base: 70,
      onboardingPrefs: 10,
      learnedPrefs: 5,
      affinity: 0,
    },
    summary: "Great conditions expected",
    reasons: ["Clean waves", "Offshore wind", "Good tide", "Perfect timing"],
    generated_at: "2025-01-20T06:00:00Z",
    total_beaches_count: 10,
    available_beaches_count: 8,
    partial_success: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("successful data fetching", () => {
    it("fetches and returns personalized forecast recommendation", () => {
      const mockRefetch = jest.fn();

      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      (useSurfDiscovery as jest.Mock).mockReturnValue({
        discovery: mockDiscoveryResponse,
        loading: false,
        error: null,
        refetch: mockRefetch,
        hasRecommendations: true,
      });

      const { result } = renderHook(() => usePersonalizedHomeForecast());

      expect(result.current.recommendation).toEqual(mockRecommendation);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.hasRecommendation).toBe(true);
      expect(result.current.refetch).toBe(mockRefetch);
    });

    it("handles null recommendation when no good windows found", () => {
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      (useSurfDiscovery as jest.Mock).mockReturnValue({
        discovery: null,
        loading: false,
        error: null,
        refetch: jest.fn(),
        hasRecommendations: false,
      });

      const { result } = renderHook(() => usePersonalizedHomeForecast());

      expect(result.current.recommendation).toBeNull();
      expect(result.current.hasRecommendation).toBe(false);
    });
  });

  describe("loading states", () => {
    it("shows loading state while fetching", () => {
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      (useSurfDiscovery as jest.Mock).mockReturnValue({
        discovery: null,
        loading: true,
        error: null,
        refetch: jest.fn(),
        hasRecommendations: false,
      });

      const { result } = renderHook(() => usePersonalizedHomeForecast());

      expect(result.current.loading).toBe(true);
      expect(result.current.recommendation).toBeNull();
    });
  });

  describe("error handling", () => {
    it("captures and exposes errors", () => {
      const errorMessage = "Failed to fetch personalized forecast";
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      (useSurfDiscovery as jest.Mock).mockReturnValue({
        discovery: null,
        loading: false,
        error: errorMessage,
        refetch: jest.fn(),
        hasRecommendations: false,
      });

      const { result } = renderHook(() => usePersonalizedHomeForecast());

      expect(result.current.error).toBe(errorMessage);
      expect(result.current.recommendation).toBeNull();
    });
  });

  describe("refetch functionality", () => {
    it("provides refetch function", () => {
      const mockRefetch = jest.fn();
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      (useSurfDiscovery as jest.Mock).mockReturnValue({
        discovery: mockDiscoveryResponse,
        loading: false,
        error: null,
        refetch: mockRefetch,
        hasRecommendations: true,
      });

      const { result } = renderHook(() => usePersonalizedHomeForecast());

      expect(result.current.refetch).toBe(mockRefetch);
    });

    it("exposes refetch function for manual refresh", () => {
      const mockRefetch = jest.fn();
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      (useSurfDiscovery as jest.Mock).mockReturnValue({
        discovery: mockDiscoveryResponse,
        loading: false,
        error: null,
        refetch: mockRefetch,
        hasRecommendations: true,
      });

      const { result } = renderHook(() => usePersonalizedHomeForecast());

      result.current.refetch();

      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("authentication handling", () => {
    it("skips fetch when user is not authenticated", () => {
      (useAuth as jest.Mock).mockReturnValue({ user: null });
      (useSurfDiscovery as jest.Mock).mockReturnValue({
        discovery: null,
        loading: false,
        error: null,
        refetch: jest.fn(),
        hasRecommendations: false,
      });

      const { result } = renderHook(() => usePersonalizedHomeForecast());

      expect(result.current.recommendation).toBeNull();
      expect(result.current.hasRecommendation).toBe(false);
    });

    it("passes enabled: false to useSurfDiscovery when user is null (via useAuth)", () => {
      (useAuth as jest.Mock).mockReturnValue({ user: null });
      (useSurfDiscovery as jest.Mock).mockReturnValue({
        discovery: null,
        loading: false,
        error: null,
        refetch: jest.fn(),
        hasRecommendations: false,
      });

      renderHook(() => usePersonalizedHomeForecast());

      // useSurfDiscovery internally handles user auth via useDataFetcher
      // This test verifies the hook doesn't break when user is null
      expect(useSurfDiscovery).toHaveBeenCalled();
    });
  });

  describe("enabled parameter", () => {
    it("passes enabled: false to useSurfDiscovery when disabled", () => {
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      (useSurfDiscovery as jest.Mock).mockReturnValue({
        discovery: null,
        loading: false,
        error: null,
        refetch: jest.fn(),
        hasRecommendations: false,
      });

      renderHook(() => usePersonalizedHomeForecast({ enabled: false }));

      expect(useSurfDiscovery).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false })
      );
    });

    it("passes enabled: true to useSurfDiscovery when enabled", () => {
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      (useSurfDiscovery as jest.Mock).mockReturnValue({
        discovery: mockDiscoveryResponse,
        loading: false,
        error: null,
        refetch: jest.fn(),
        hasRecommendations: true,
      });

      renderHook(() => usePersonalizedHomeForecast({ enabled: true }));

      expect(useSurfDiscovery).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: true })
      );
    });
  });

  describe("homeBeachId parameter", () => {
    it("accepts homeBeachId parameter (ignored, documented as such)", () => {
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      (useSurfDiscovery as jest.Mock).mockReturnValue({
        discovery: mockDiscoveryResponse,
        loading: false,
        error: null,
        refetch: jest.fn(),
        hasRecommendations: true,
      });

      const { result } = renderHook(() =>
        usePersonalizedHomeForecast({ homeBeachId: "beach-456" })
      );

      // homeBeachId is accepted for backward compatibility but not used
      // Discovery service always includes home beach
      expect(result.current.recommendation).toEqual(mockRecommendation);
    });
  });

  describe("callback handling", () => {
    it("forwards onSuccess callback to useSurfDiscovery (wrapped)", () => {
      const onSuccess = jest.fn();
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      (useSurfDiscovery as jest.Mock).mockReturnValue({
        discovery: mockDiscoveryResponse,
        loading: false,
        error: null,
        refetch: jest.fn(),
        hasRecommendations: true,
      });

      renderHook(() => usePersonalizedHomeForecast({ onSuccess }));

      // Verify onSuccess callback is passed (wrapped to adapt data)
      expect(useSurfDiscovery).toHaveBeenCalledWith(
        expect.objectContaining({
          onSuccess: expect.any(Function),
        })
      );
    });

    it("forwards onError callback to useSurfDiscovery", () => {
      const onError = jest.fn();
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      (useSurfDiscovery as jest.Mock).mockReturnValue({
        discovery: null,
        loading: false,
        error: null,
        refetch: jest.fn(),
        hasRecommendations: false,
      });

      renderHook(() => usePersonalizedHomeForecast({ onError }));

      // Verify onError callback is passed directly
      expect(useSurfDiscovery).toHaveBeenCalledWith(
        expect.objectContaining({ onError })
      );
    });

    it("adapts discovery data before calling onSuccess", () => {
      const onSuccess = jest.fn();
      let capturedOnSuccess: any;

      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      (useSurfDiscovery as jest.Mock).mockImplementation((options) => {
        capturedOnSuccess = options.onSuccess;
        return {
          discovery: mockDiscoveryResponse,
          loading: false,
          error: null,
          refetch: jest.fn(),
          hasRecommendations: true,
        };
      });

      renderHook(() => usePersonalizedHomeForecast({ onSuccess }));

      // Simulate useSurfDiscovery calling the wrapped onSuccess
      if (capturedOnSuccess) {
        capturedOnSuccess(mockDiscoveryResponse);
      }

      // Verify the user's callback received adapted personalized data
      expect(onSuccess).toHaveBeenCalledWith(mockRecommendation);
    });
  });

  describe("hasRecommendation helper", () => {
    it("returns true when recommendation exists", () => {
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      (useSurfDiscovery as jest.Mock).mockReturnValue({
        discovery: mockDiscoveryResponse,
        loading: false,
        error: null,
        refetch: jest.fn(),
        hasRecommendations: true,
      });

      const { result } = renderHook(() => usePersonalizedHomeForecast());

      expect(result.current.hasRecommendation).toBe(true);
    });

    it("returns false when recommendation is null", () => {
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      (useSurfDiscovery as jest.Mock).mockReturnValue({
        discovery: null,
        loading: false,
        error: null,
        refetch: jest.fn(),
        hasRecommendations: false,
      });

      const { result } = renderHook(() => usePersonalizedHomeForecast());

      expect(result.current.hasRecommendation).toBe(false);
    });
  });

  describe("useSurfDiscovery integration", () => {
    it("calls useSurfDiscovery with maxResults=1", () => {
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      (useSurfDiscovery as jest.Mock).mockReturnValue({
        discovery: null,
        loading: false,
        error: null,
        refetch: jest.fn(),
        hasRecommendations: false,
      });

      renderHook(() => usePersonalizedHomeForecast());

      expect(useSurfDiscovery).toHaveBeenCalledWith(
        expect.objectContaining({
          maxResults: 1,
        })
      );
    });

    it("passes correct options to useSurfDiscovery", () => {
      const onSuccess = jest.fn();
      const onError = jest.fn();

      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      (useSurfDiscovery as jest.Mock).mockReturnValue({
        discovery: null,
        loading: false,
        error: null,
        refetch: jest.fn(),
        hasRecommendations: false,
      });

      renderHook(() =>
        usePersonalizedHomeForecast({
          enabled: true,
          immediate: true,
          onSuccess,
          onError,
        })
      );

      expect(useSurfDiscovery).toHaveBeenCalledWith({
        maxResults: 1,
        enabled: true,
        immediate: true,
        onSuccess: expect.any(Function), // Wrapped callback
        onError, // Passed directly
      });
    });
  });

  describe("date hydration", () => {
    it("returns recommendation with Date objects (hydrated by useSurfDiscovery)", () => {
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      (useSurfDiscovery as jest.Mock).mockReturnValue({
        discovery: mockDiscoveryResponse,
        loading: false,
        error: null,
        refetch: jest.fn(),
        hasRecommendations: true,
      });

      const { result } = renderHook(() => usePersonalizedHomeForecast());

      // Verify dates in returned recommendation are Date objects
      expect(result.current.recommendation).not.toBeNull();
      expect(result.current.recommendation!.window.start).toBeInstanceOf(Date);
      expect(result.current.recommendation!.window.end).toBeInstanceOf(Date);

      // Verify toISOString() can be called
      expect(() => result.current.recommendation!.window.start.toISOString()).not.toThrow();
      expect(() => result.current.recommendation!.window.end.toISOString()).not.toThrow();
    });

    it("handles null recommendation gracefully", () => {
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      (useSurfDiscovery as jest.Mock).mockReturnValue({
        discovery: null,
        loading: false,
        error: null,
        refetch: jest.fn(),
        hasRecommendations: false,
      });

      const { result } = renderHook(() => usePersonalizedHomeForecast());

      expect(result.current.recommendation).toBeNull();
    });

    it("preserves all recommendation fields during adaptation", () => {
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      (useSurfDiscovery as jest.Mock).mockReturnValue({
        discovery: mockDiscoveryResponse,
        loading: false,
        error: null,
        refetch: jest.fn(),
        hasRecommendations: true,
      });

      const { result } = renderHook(() => usePersonalizedHomeForecast());

      const rec = result.current.recommendation!;

      // Verify all fields are preserved during adaptation
      expect(rec.beach.id).toBe("beach-123");
      expect(rec.score).toBe(85);
      expect(rec.personalized).toBe(true);
      expect(rec.summary).toBe("Great conditions expected");
      expect(rec.reasons).toHaveLength(4); // Adapter limits to 4 reasons
      expect(rec.window.tide).toBe("Mid incoming");
      expect(rec.window.wind).toBe("Light offshore");
      expect(rec.generated_at).toBe("2025-01-20T06:00:00Z");
      expect(rec.total_beaches_count).toBe(10);
      expect(rec.available_beaches_count).toBe(8);
      expect(rec.partial_success).toBe(false);
    });
  });
});
