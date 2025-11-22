import { renderHook } from "@testing-library/react";
import { usePersonalizedHomeForecast } from "@/hooks/use-personalized-home-forecast";
import type { PersonalizedForecastRecommendation } from "@/types/personalization";

// Mock dependencies
jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/hooks/use-data-fetcher", () => ({
  useDataFetcher: jest.fn(),
}));

import { useAuth } from "@/context/auth-context";
import { useDataFetcher } from "@/hooks/use-data-fetcher";

describe("usePersonalizedHomeForecast", () => {
  const mockUser = { id: "user-123", email: "test@example.com" };
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
      confidence: 0.85,
    },
    forecast: {} as any,
    score: 8.5,
    personalized: true,
    breakdown: {
      base: 7.0,
      onboardingPrefs: 1.0,
      learnedPrefs: 0.5,
      affinity: 0,
    },
    summary: "Great conditions expected",
    reasons: ["Clean waves", "Offshore wind", "Good tide"],
    generated_at: "2025-01-20T06:00:00Z",
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
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockRecommendation,
        loading: false,
        error: null,
        refetch: mockRefetch,
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
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: null,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => usePersonalizedHomeForecast());

      expect(result.current.recommendation).toBeNull();
      expect(result.current.hasRecommendation).toBe(false);
    });
  });

  describe("loading states", () => {
    it("shows loading state while fetching", () => {
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: null,
        loading: true,
        error: null,
        refetch: jest.fn(),
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
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: null,
        loading: false,
        error: errorMessage,
        refetch: jest.fn(),
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
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockRecommendation,
        loading: false,
        error: null,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => usePersonalizedHomeForecast());

      expect(result.current.refetch).toBe(mockRefetch);
    });

    it("exposes refetch function for manual refresh", () => {
      const mockRefetch = jest.fn();
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockRecommendation,
        loading: false,
        error: null,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => usePersonalizedHomeForecast());

      result.current.refetch();

      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("authentication handling", () => {
    it("skips fetch when user is not authenticated", () => {
      (useAuth as jest.Mock).mockReturnValue({ user: null });
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: null,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => usePersonalizedHomeForecast());

      expect(result.current.recommendation).toBeNull();
      expect(result.current.hasRecommendation).toBe(false);
    });

    it("passes skip: true to useDataFetcher when user is null", () => {
      (useAuth as jest.Mock).mockReturnValue({ user: null });
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: null,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      renderHook(() => usePersonalizedHomeForecast());

      expect(useDataFetcher).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ skip: true })
      );
    });
  });

  describe("enabled parameter", () => {
    it("skips fetch when enabled is false", () => {
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: null,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      renderHook(() => usePersonalizedHomeForecast({ enabled: false }));

      expect(useDataFetcher).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ skip: true })
      );
    });

    it("fetches when enabled is true", () => {
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockRecommendation,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      renderHook(() => usePersonalizedHomeForecast({ enabled: true }));

      expect(useDataFetcher).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ skip: false })
      );
    });
  });

  describe("homeBeachId parameter", () => {
    it("accepts homeBeachId parameter", () => {
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockRecommendation,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() =>
        usePersonalizedHomeForecast({ homeBeachId: "beach-456" })
      );

      expect(result.current.recommendation).toEqual(mockRecommendation);
    });
  });

  describe("callback handling", () => {
    it("passes onSuccess callback to useDataFetcher", () => {
      const onSuccess = jest.fn();
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockRecommendation,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      renderHook(() => usePersonalizedHomeForecast({ onSuccess }));

      expect(useDataFetcher).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ onSuccess })
      );
    });

    it("passes onError callback to useDataFetcher", () => {
      const onError = jest.fn();
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: null,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      renderHook(() => usePersonalizedHomeForecast({ onError }));

      expect(useDataFetcher).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ onError })
      );
    });
  });

  describe("hasRecommendation helper", () => {
    it("returns true when recommendation exists", () => {
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockRecommendation,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => usePersonalizedHomeForecast());

      expect(result.current.hasRecommendation).toBe(true);
    });

    it("returns false when recommendation is null", () => {
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: null,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { result } = renderHook(() => usePersonalizedHomeForecast());

      expect(result.current.hasRecommendation).toBe(false);
    });
  });

  describe("useDataFetcher integration", () => {
    it("calls useDataFetcher with a fetch function", () => {
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: null,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      renderHook(() => usePersonalizedHomeForecast());

      expect(useDataFetcher).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Object)
      );
    });

    it("passes correct options to useDataFetcher", () => {
      const onSuccess = jest.fn();
      const onError = jest.fn();

      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: null,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      renderHook(() =>
        usePersonalizedHomeForecast({
          enabled: true,
          onSuccess,
          onError,
        })
      );

      expect(useDataFetcher).toHaveBeenCalledWith(expect.any(Function), {
        immediate: true,
        skip: false,
        onSuccess,
        onError,
      });
    });
  });
});
