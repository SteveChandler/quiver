import { renderHook, act, waitFor } from "@testing-library/react";
import { useSessionForecast } from "@/hooks/use-session-forecast";

jest.mock("@/actions/forecast-actions", () => ({
  getEnhancedBeachForecasts: jest.fn(),
}));

const mockGetEnhanced = require("@/actions/forecast-actions")
  .getEnhancedBeachForecasts as jest.Mock;

describe("useSessionForecast", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null when inputs are incomplete", () => {
    const { result } = renderHook(() => useSessionForecast(null, null, null));
    expect(result.current.forecastData).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("fetches and maps closest forecast to session time", async () => {
    mockGetEnhanced.mockResolvedValue({
      success: true,
      data: [
        {
          forecast_date: "2024-01-17",
          forecast_time: "06:00",
          wave_height: 4,
          wind_speed: 8,
          wind_direction: "NW",
          water_temp: 60,
        },
        {
          forecast_date: "2024-01-17",
          forecast_time: "08:00",
          wave_height: 5,
          wind_speed: 10,
          wind_direction: "W",
          water_temp: 61,
        },
      ],
    });

    const { result } = renderHook(() =>
      useSessionForecast("beach-1", "2024-01-17", "07:30")
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGetEnhanced).toHaveBeenCalledWith("beach-1", 10);
    expect(result.current.forecastData).toEqual({
      wave_height: 5,
      wind_speed: 10,
      wind_direction: "W",
      water_temp: 61,
    });
    expect(result.current.error).toBeNull();
  });

  it("handles no forecasts found for date", async () => {
    mockGetEnhanced.mockResolvedValue({ success: true, data: [] });

    const { result } = renderHook(() =>
      useSessionForecast("beach-1", "2099-01-17", "06:00")
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.forecastData).toBeNull();
    // Future date with no data => generic message
    expect(result.current.error).toBe("No forecasts found for this date");
  });

  it("handles action error", async () => {
    mockGetEnhanced.mockResolvedValue({ success: false, error: "Boom" });

    const { result } = renderHook(() =>
      useSessionForecast("beach-1", "2024-01-17", "06:00")
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Boom");
  });
});
