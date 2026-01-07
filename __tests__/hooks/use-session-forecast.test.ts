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
      tide_height: null,
      tide_status: null,
      isNightSession: false, // 08:00 is daytime
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

  it("parses tide data and detects night sessions", async () => {
    mockGetEnhanced.mockResolvedValue({
      success: true,
      data: [
        {
          forecast_date: "2024-01-17",
          forecast_time: "19:00", // 7 PM is night time (>= 18:00)
          wave_height: "3.5 ft",
          wind_speed: "5 mph",
          wind_direction: "SW",
          water_temp: "58°F",
          tide_height: "4.2 ft", // String format from DB
          tide_status: "rising",
        },
      ],
    });

    const { result } = renderHook(() =>
      useSessionForecast("beach-1", "2024-01-17", "19:00")
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.forecastData).toEqual({
      wave_height: 3.5,
      wind_speed: 5,
      wind_direction: "SW",
      water_temp: 58,
      tide_height: 4.2,
      tide_status: "rising",
      isNightSession: true, // 19:00 >= 18:00
    });
  });

  it("detects early morning as night session", async () => {
    mockGetEnhanced.mockResolvedValue({
      success: true,
      data: [
        {
          forecast_date: "2024-01-17",
          forecast_time: "05:00", // 5 AM is night time (< 6:00)
          wave_height: 4,
          wind_speed: 8,
          wind_direction: "N",
          water_temp: 55,
        },
      ],
    });

    const { result } = renderHook(() =>
      useSessionForecast("beach-1", "2024-01-17", "05:00")
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.forecastData?.isNightSession).toBe(true);
  });

  it("detects 6 AM as daytime session", async () => {
    mockGetEnhanced.mockResolvedValue({
      success: true,
      data: [
        {
          forecast_date: "2024-01-17",
          forecast_time: "06:00", // 6 AM is daytime (>= 6:00 and < 18:00)
          wave_height: 4,
          wind_speed: 8,
          wind_direction: "N",
          water_temp: 55,
        },
      ],
    });

    const { result } = renderHook(() =>
      useSessionForecast("beach-1", "2024-01-17", "06:00")
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.forecastData?.isNightSession).toBe(false);
  });

  describe("tide field parsing edge cases", () => {
    it("handles null tide_height and tide_status", async () => {
      mockGetEnhanced.mockResolvedValue({
        success: true,
        data: [
          {
            forecast_date: "2024-01-17",
            forecast_time: "10:00",
            wave_height: 3,
            wind_speed: 7,
            wind_direction: "E",
            water_temp: 62,
            tide_height: null,
            tide_status: null,
          },
        ],
      });

      const { result } = renderHook(() =>
        useSessionForecast("beach-1", "2024-01-17", "10:00")
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.forecastData).toEqual({
        wave_height: 3,
        wind_speed: 7,
        wind_direction: "E",
        water_temp: 62,
        tide_height: null,
        tide_status: null,
        isNightSession: false,
      });
    });

    it("handles missing tide fields (undefined)", async () => {
      mockGetEnhanced.mockResolvedValue({
        success: true,
        data: [
          {
            forecast_date: "2024-01-17",
            forecast_time: "14:00",
            wave_height: 5,
            wind_speed: 12,
            wind_direction: "SW",
            water_temp: 68,
            // tide_height and tide_status not present
          },
        ],
      });

      const { result } = renderHook(() =>
        useSessionForecast("beach-1", "2024-01-17", "14:00")
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.forecastData?.tide_height).toBeNull();
      expect(result.current.forecastData?.tide_status).toBeNull();
    });

    it("parses numeric tide_height correctly", async () => {
      mockGetEnhanced.mockResolvedValue({
        success: true,
        data: [
          {
            forecast_date: "2024-01-17",
            forecast_time: "11:00",
            wave_height: 4,
            wind_speed: 8,
            wind_direction: "NW",
            water_temp: 60,
            tide_height: 5.7, // Numeric format
            tide_status: "high",
          },
        ],
      });

      const { result } = renderHook(() =>
        useSessionForecast("beach-1", "2024-01-17", "11:00")
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.forecastData?.tide_height).toBe(5.7);
      expect(result.current.forecastData?.tide_status).toBe("high");
    });

    it("parses tide_height with decimal from string", async () => {
      mockGetEnhanced.mockResolvedValue({
        success: true,
        data: [
          {
            forecast_date: "2024-01-17",
            forecast_time: "16:00",
            wave_height: 3,
            wind_speed: 5,
            wind_direction: "S",
            water_temp: 66,
            tide_height: "2.75 ft", // String format with units
            tide_status: "falling",
          },
        ],
      });

      const { result } = renderHook(() =>
        useSessionForecast("beach-1", "2024-01-17", "16:00")
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.forecastData?.tide_height).toBe(2.75);
      expect(result.current.forecastData?.tide_status).toBe("falling");
    });

    it("handles all valid tide_status values", async () => {
      const tideStatuses = ["rising", "falling", "high", "low"];

      for (const status of tideStatuses) {
        mockGetEnhanced.mockResolvedValue({
          success: true,
          data: [
            {
              forecast_date: "2024-01-17",
              forecast_time: "12:00",
              wave_height: 4,
              wind_speed: 8,
              wind_direction: "W",
              water_temp: 64,
              tide_height: "3.5 ft",
              tide_status: status,
            },
          ],
        });

        const { result } = renderHook(() =>
          useSessionForecast("beach-1", "2024-01-17", "12:00")
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.forecastData?.tide_status).toBe(status);
      }
    });

    it("handles empty string tide_status", async () => {
      mockGetEnhanced.mockResolvedValue({
        success: true,
        data: [
          {
            forecast_date: "2024-01-17",
            forecast_time: "13:00",
            wave_height: 3,
            wind_speed: 6,
            wind_direction: "NE",
            water_temp: 61,
            tide_height: "4.0 ft",
            tide_status: "",
          },
        ],
      });

      const { result } = renderHook(() =>
        useSessionForecast("beach-1", "2024-01-17", "13:00")
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.forecastData?.tide_height).toBe(4.0);
      expect(result.current.forecastData?.tide_status).toBeNull();
    });

    it("handles invalid tide_height strings gracefully", async () => {
      mockGetEnhanced.mockResolvedValue({
        success: true,
        data: [
          {
            forecast_date: "2024-01-17",
            forecast_time: "15:00",
            wave_height: 4,
            wind_speed: 9,
            wind_direction: "W",
            water_temp: 63,
            tide_height: "invalid", // Non-numeric string
            tide_status: "rising",
          },
        ],
      });

      const { result } = renderHook(() =>
        useSessionForecast("beach-1", "2024-01-17", "15:00")
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.forecastData?.tide_height).toBeNull();
      expect(result.current.forecastData?.tide_status).toBe("rising");
    });
  });

  describe("night detection comprehensive tests", () => {
    it("detects 7 PM as night session", async () => {
      mockGetEnhanced.mockResolvedValue({
        success: true,
        data: [
          {
            forecast_date: "2024-01-17",
            forecast_time: "19:00", // 7 PM
            wave_height: 4,
            wind_speed: 8,
            wind_direction: "W",
            water_temp: 60,
          },
        ],
      });

      const { result } = renderHook(() =>
        useSessionForecast("beach-1", "2024-01-17", "19:00")
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.forecastData?.isNightSession).toBe(true);
    });

    it("detects 8 PM as night session", async () => {
      mockGetEnhanced.mockResolvedValue({
        success: true,
        data: [
          {
            forecast_date: "2024-01-17",
            forecast_time: "20:00", // 8 PM
            wave_height: 3,
            wind_speed: 6,
            wind_direction: "SW",
            water_temp: 58,
          },
        ],
      });

      const { result } = renderHook(() =>
        useSessionForecast("beach-1", "2024-01-17", "20:00")
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.forecastData?.isNightSession).toBe(true);
    });

    it("detects midnight as night session", async () => {
      mockGetEnhanced.mockResolvedValue({
        success: true,
        data: [
          {
            forecast_date: "2024-01-17",
            forecast_time: "00:00", // Midnight
            wave_height: 4,
            wind_speed: 7,
            wind_direction: "N",
            water_temp: 56,
          },
        ],
      });

      const { result } = renderHook(() =>
        useSessionForecast("beach-1", "2024-01-17", "00:00")
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.forecastData?.isNightSession).toBe(true);
    });

    it("detects 3 AM as night session", async () => {
      mockGetEnhanced.mockResolvedValue({
        success: true,
        data: [
          {
            forecast_date: "2024-01-17",
            forecast_time: "03:00", // 3 AM
            wave_height: 5,
            wind_speed: 10,
            wind_direction: "NW",
            water_temp: 55,
          },
        ],
      });

      const { result } = renderHook(() =>
        useSessionForecast("beach-1", "2024-01-17", "03:00")
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.forecastData?.isNightSession).toBe(true);
    });

    it("detects noon as daytime session", async () => {
      mockGetEnhanced.mockResolvedValue({
        success: true,
        data: [
          {
            forecast_date: "2024-01-17",
            forecast_time: "12:00", // Noon
            wave_height: 4,
            wind_speed: 8,
            wind_direction: "W",
            water_temp: 65,
          },
        ],
      });

      const { result } = renderHook(() =>
        useSessionForecast("beach-1", "2024-01-17", "12:00")
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.forecastData?.isNightSession).toBe(false);
    });

    it("detects 5 PM as daytime session (boundary)", async () => {
      mockGetEnhanced.mockResolvedValue({
        success: true,
        data: [
          {
            forecast_date: "2024-01-17",
            forecast_time: "17:00", // 5 PM
            wave_height: 4,
            wind_speed: 9,
            wind_direction: "W",
            water_temp: 64,
          },
        ],
      });

      const { result } = renderHook(() =>
        useSessionForecast("beach-1", "2024-01-17", "17:00")
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.forecastData?.isNightSession).toBe(false);
    });

    it("detects 6 PM as night session (boundary)", async () => {
      mockGetEnhanced.mockResolvedValue({
        success: true,
        data: [
          {
            forecast_date: "2024-01-17",
            forecast_time: "18:00", // 6 PM
            wave_height: 3,
            wind_speed: 7,
            wind_direction: "SW",
            water_temp: 62,
          },
        ],
      });

      const { result } = renderHook(() =>
        useSessionForecast("beach-1", "2024-01-17", "18:00")
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.forecastData?.isNightSession).toBe(true);
    });
  });

  describe("combined tide parsing and night detection", () => {
    it("correctly combines tide data with night detection for evening session", async () => {
      mockGetEnhanced.mockResolvedValue({
        success: true,
        data: [
          {
            forecast_date: "2024-01-17",
            forecast_time: "20:00", // 8 PM - should be night
            wave_height: "3-5 ft",
            wind_speed: "8 mph",
            wind_direction: "offshore",
            water_temp: "60°F",
            tide_height: "6.2 ft",
            tide_status: "high",
          },
        ],
      });

      const { result } = renderHook(() =>
        useSessionForecast("beach-1", "2024-01-17", "20:00")
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.forecastData).toEqual({
        wave_height: 3,
        wind_speed: 8,
        wind_direction: "offshore",
        water_temp: 60,
        tide_height: 6.2,
        tide_status: "high",
        isNightSession: true,
      });
    });

    it("correctly combines tide data with night detection for morning session", async () => {
      mockGetEnhanced.mockResolvedValue({
        success: true,
        data: [
          {
            forecast_date: "2024-01-17",
            forecast_time: "07:00", // 7 AM - should be day
            wave_height: "4 ft",
            wind_speed: "6 mph",
            wind_direction: "NW",
            water_temp: "58°F",
            tide_height: "1.8 ft",
            tide_status: "low",
          },
        ],
      });

      const { result } = renderHook(() =>
        useSessionForecast("beach-1", "2024-01-17", "07:00")
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.forecastData).toEqual({
        wave_height: 4,
        wind_speed: 6,
        wind_direction: "NW",
        water_temp: 58,
        tide_height: 1.8,
        tide_status: "low",
        isNightSession: false,
      });
    });
  });
});
