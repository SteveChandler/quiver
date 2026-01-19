import { renderHook, waitFor } from "@testing-library/react";
import { useBeachPersonalization } from "@/hooks/use-beach-personalization";

// Mock auth context
jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

import { useAuth } from "@/context/auth-context";

describe("useBeachPersonalization", () => {
  // Cast as any since we only need partial data for API call mock
  const mockForecast = {
    id: "forecast-123",
    beach_id: "beach-456",
    forecast_date: "2026-01-18",
    forecast_time: "12:00:00",
    wave_height: "4.5",
    wave_period: "12",
    wind_speed: "10",
    wind_direction: "270",
    tide_status: "rising",
    water_temp: "62",
    confidence_score: 0.85,
    data_source: "noaa",
    created_at: "2026-01-18T00:00:00Z",
    updated_at: "2026-01-18T00:00:00Z",
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  it("returns null when beachId is null", async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "user-123" } });

    const { result } = renderHook(() =>
      useBeachPersonalization({
        beachId: null,
        baseScore: 75,
        forecast: mockForecast,
      })
    );

    // Should not fetch
    expect(global.fetch).not.toHaveBeenCalled();

    // Should return null data
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("returns null when user is not authenticated", async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });

    const { result } = renderHook(() =>
      useBeachPersonalization({
        beachId: "beach-456",
        baseScore: 75,
        forecast: mockForecast,
      })
    );

    // Should not fetch
    expect(global.fetch).not.toHaveBeenCalled();

    // Should return null data
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("fetches personalized score when user and beachId are provided", async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "user-123" } });

    const mockPersonalizedScore = {
      score: 85,
      personalized: true,
      breakdown: {
        base: 75,
        onboardingPrefs: 5,
        learnedPrefs: 3,
        affinity: 2,
      },
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockPersonalizedScore }),
    });

    const { result } = renderHook(() =>
      useBeachPersonalization({
        beachId: "beach-456",
        baseScore: 75,
        forecast: mockForecast,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should fetch from correct endpoint
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/beach/personalized-score",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          beachId: "beach-456",
          baseScore: 75,
          forecast: mockForecast,
        }),
      })
    );

    // Should return personalized score
    expect(result.current.data).toEqual(mockPersonalizedScore);
    expect(result.current.error).toBeNull();
  });

  it("returns null on fetch error", async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "user-123" } });

    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error("Network error")
    );

    const { result } = renderHook(() =>
      useBeachPersonalization({
        beachId: "beach-456",
        baseScore: 75,
        forecast: mockForecast,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should handle error gracefully
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeTruthy();
  });
});
