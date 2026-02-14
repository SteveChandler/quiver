import { renderHook, waitFor } from "@testing-library/react";
import { useForecastCalibration } from "@/hooks/use-forecast-calibration";
import * as forecastActions from "@/actions/forecast-calibration-actions";
import { toast } from "sonner";

// Mock dependencies
jest.mock("@/actions/forecast-calibration-actions");
jest.mock("@/hooks/use-data-fetcher");
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockBeachAccuracy = {
  id: "accuracy-1",
  beach_id: "beach-1",
  avg_wave_height_delta: 0.5,
  avg_wind_speed_delta: 2.0,
  total_sessions_count: 25,
  last_30_days_count: 8,
  last_7_days_count: 3,
  overall_accuracy_score: 78,
  calculation_date: "2024-01-15",
  created_at: "2024-01-15T08:00:00Z",
  updated_at: "2024-01-15T08:00:00Z",
};

const mockSessionSnapshots = [
  {
    id: "snapshot-1",
    session_id: "session-1",
    user_id: "user-1",
    beach_id: "beach-1",
    forecast_snapshot: {
      wave_height: "4-6 ft",
      wind_speed: "8 mph",
      confidence_score: 85,
    },
    actual_conditions: {
      wave_height: 5,
      wind_condition: "light_offshore",
      overall_accuracy: 4,
    },
    forecast_confidence_score: 85,
    data_source: "NOAA_NWS",
    session_date: "2024-01-15",
    created_at: "2024-01-15T12:00:00Z",
    updated_at: "2024-01-15T12:00:00Z",
  },
];

const mockSession = {
  id: "session-1",
  user_id: "user-1",
  profile_id: "user-1",
  beach_id: "beach-1",
  arrival_time: "2024-01-15T10:00:00Z",
  status: "completed",
  rating: 4,
  duration_minutes: 120,
  wave_quality: 4,
  crowd_level: 2,
  water_temp: "68°F",
  created_at: "2024-01-15T09:00:00Z",
  updated_at: "2024-01-15T12:30:00Z",
} as any;

const mockForecast = {
  id: "forecast-1",
  beach_id: "beach-1",
  forecast_at: "2024-01-15T10:00:00Z",
  valid_time: "2024-01-15T10:00:00Z",
  forecast_time: "2024-01-15T10:00:00Z", // Hook uses forecast_time
  forecast_date: "2024-01-15",
  wave_height: "4-6 ft",
  wind_speed: "8 mph",
  wind_direction: "NW",
  water_temp: "65°F",
  confidence_score: 85,
  data_source: "NOAA_NWS",
  created_at: "2024-01-15T08:00:00Z",
  updated_at: "2024-01-15T08:00:00Z",
};

// Mock useDataFetcher
const mockUseDataFetcher = require("@/hooks/use-data-fetcher").useDataFetcher;

describe("useForecastCalibration", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    mockUseDataFetcher
      .mockReturnValueOnce({
        data: mockBeachAccuracy,
        loading: false,
        error: null,
        refetch: jest.fn(),
      })
      .mockReturnValueOnce({
        data: mockSessionSnapshots,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });
  });

  it("returns beach accuracy data", () => {
    const { result } = renderHook(() =>
      useForecastCalibration({ beachId: "beach-1" })
    );

    expect(result.current.beachAccuracy).toEqual(mockBeachAccuracy);
    expect(result.current.sessionSnapshots).toEqual(mockSessionSnapshots);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it("returns accuracy statistics", () => {
    const { result } = renderHook(() =>
      useForecastCalibration({ beachId: "beach-1" })
    );

    const stats = result.current.accuracyStats;
    expect(stats).toEqual({
      overallScore: 78,
      waveHeightDelta: 0.5,
      windSpeedDelta: 2.0,
      totalSessions: 25,
      last30Days: 8,
      last7Days: 3,
      lastUpdated: "2024-01-15T08:00:00Z",
    });
  });

  it("returns correct confidence levels", () => {
    const { result } = renderHook(() =>
      useForecastCalibration({ beachId: "beach-1" })
    );

    // High confidence (85+)
    expect(result.current.getConfidenceLevel(90)).toMatchObject({
      level: "high",
    });

    // Medium confidence (70-84)
    expect(result.current.getConfidenceLevel(75)).toMatchObject({
      level: "medium",
    });

    // Low confidence (<70)
    expect(result.current.getConfidenceLevel(60)).toMatchObject({
      level: "low",
    });

    // Unknown confidence
    expect(result.current.getConfidenceLevel(null)).toMatchObject({
      level: "unknown",
    });
  });

  it("checks if feedback exists for session", () => {
    const { result } = renderHook(() =>
      useForecastCalibration({ beachId: "beach-1" })
    );

    expect(result.current.hasFeedbackForSession("session-1")).toBe(true);
    expect(result.current.hasFeedbackForSession("session-2")).toBe(false);
  });

  it("submits forecast feedback successfully", async () => {
    const mockCreateSnapshot = jest.spyOn(
      forecastActions,
      "createForecastSnapshot"
    );
    mockCreateSnapshot.mockResolvedValue({
      success: true,
      data: mockSessionSnapshots[0],
    } as any);

    const mockRefetchAccuracy = jest.fn();
    const mockRefetchSnapshots = jest.fn();

    // Reset the mock and set up fresh mocks
    mockUseDataFetcher.mockReset();
    mockUseDataFetcher
      .mockReturnValueOnce({
        data: mockBeachAccuracy,
        loading: false,
        error: null,
        refetch: mockRefetchAccuracy,
      })
      .mockReturnValueOnce({
        data: mockSessionSnapshots,
        loading: false,
        error: null,
        refetch: mockRefetchSnapshots,
      });

    const { result } = renderHook(() =>
      useForecastCalibration({ beachId: "beach-1" })
    );

    const feedback = {
      waveHeight: 5,
      windCondition: "light_offshore",
      windSpeed: 5,
      notes: "Great conditions!",
      overallAccuracy: 4,
    };

    await result.current.submitForecastFeedback(
      mockSession,
      mockForecast,
      feedback
    );

    expect(mockCreateSnapshot).toHaveBeenCalledWith(
      "session-1",
      {
        wave_height: "4-6 ft",
        wind_speed: "8 mph",
        wind_direction: "NW",
        water_temp: "65°F",
        air_temperature: undefined,
        confidence_score: 85,
        data_source: "NOAA_NWS",
        forecast_time: "2024-01-15T10:00:00Z",
        swell_1_height: undefined,
        swell_1_period: undefined,
        swell_1_direction: undefined,
        swell_2_height: undefined,
        swell_2_period: undefined,
        swell_2_direction: undefined,
      },
      {
        wave_height: 5,
        wind_condition: "light_offshore",
        wind_speed: 5,
        overall_accuracy: 4,
        notes: "Great conditions!",
        session_rating: 4,
        session_duration: 120,
        wave_quality: 4,
        crowd_level: 2,
        water_temp: "68°F",
      }
    );

    expect(toast.success).toHaveBeenCalledWith(
      "Forecast feedback submitted! Thank you for helping improve forecasts."
    );
    expect(mockRefetchAccuracy).toHaveBeenCalled();
    expect(mockRefetchSnapshots).toHaveBeenCalled();
  });

  it("handles feedback submission errors", async () => {
    const mockCreateSnapshot = jest.spyOn(
      forecastActions,
      "createForecastSnapshot"
    );
    mockCreateSnapshot.mockResolvedValue({
      success: false,
      data: undefined,
      error: "Failed to create snapshot",
    } as any);

    const { result } = renderHook(() =>
      useForecastCalibration({ beachId: "beach-1" })
    );

    const feedback = {
      waveHeight: 5,
      windCondition: "light_offshore",
      windSpeed: 5,
      overallAccuracy: 4,
    };

    await expect(
      result.current.submitForecastFeedback(mockSession, mockForecast, feedback)
    ).rejects.toThrow("Failed to create snapshot");

    expect(toast.error).toHaveBeenCalledWith("Failed to create snapshot");
  });

  it("handles submission without session ID", async () => {
    const { result } = renderHook(() =>
      useForecastCalibration({ beachId: "beach-1" })
    );

    const sessionWithoutId = { ...mockSession, id: "" };
    const feedback = {
      waveHeight: 5,
      windCondition: "light_offshore",
      overallAccuracy: 4,
    };

    await expect(
      result.current.submitForecastFeedback(
        sessionWithoutId,
        mockForecast,
        feedback
      )
    ).rejects.toThrow("Session ID is required");
  });

  it("handles submission without forecast data", async () => {
    const mockCreateSnapshot = jest.spyOn(
      forecastActions,
      "createForecastSnapshot"
    );
    mockCreateSnapshot.mockResolvedValue({
      success: true,
      data: mockSessionSnapshots[0],
    } as any);

    const { result } = renderHook(() =>
      useForecastCalibration({ beachId: "beach-1" })
    );

    const feedback = {
      waveHeight: 5,
      windCondition: "light_offshore",
      overallAccuracy: 4,
    };

    await result.current.submitForecastFeedback(mockSession, null, feedback);

    expect(mockCreateSnapshot).toHaveBeenCalledWith(
      "session-1",
      {}, // Empty forecast snapshot
      expect.any(Object)
    );
  });

  it("handles loading states correctly", () => {
    // Reset the mock completely for this test
    mockUseDataFetcher.mockReset();
    mockUseDataFetcher
      .mockReturnValueOnce({
        data: null,
        loading: true,
        error: null,
        refetch: jest.fn(),
      })
      .mockReturnValueOnce({
        data: [],
        loading: true,
        error: null,
        refetch: jest.fn(),
      });

    const { result } = renderHook(() =>
      useForecastCalibration({ beachId: "beach-1" })
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.accuracyLoading).toBe(true);
    expect(result.current.snapshotsLoading).toBe(true);
  });
});
