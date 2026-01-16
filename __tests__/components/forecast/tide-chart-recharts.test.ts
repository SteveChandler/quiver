import { normalizeTideSchedule } from "@/components/forecast/tide-chart-recharts";

describe("normalizeTideSchedule", () => {
  it("extracts tide extrema from raw_forecast.tide_schedule", () => {
    const forecasts = [
      {
        id: "1",
        beach_id: "beach-1",
        forecast_date: "2026-01-15",
        forecast_time: "12:00",
        wave_height: "3.0 ft",
        water_temp: "60F",
        confidence_score: 85,
        data_source: "NOAA_NWS" as const,
        created_at: "2026-01-15T00:00:00Z",
        updated_at: "2026-01-15T00:00:00Z",
        raw_forecast: {
          tide_schedule: [
            { time: 1737003420, height: 3.6, type: "high" as const },
            { time: 1737030720, height: 2.5, type: "low" as const },
          ],
        },
      },
    ];

    const result = normalizeTideSchedule(forecasts);

    expect(result).toHaveLength(2);
    expect(result[0].h).toBe(3.6);
    expect(result[0].isHigh).toBe(true);
    expect(result[0].isLow).toBe(false);
    expect(result[1].h).toBe(2.5);
    expect(result[1].isHigh).toBe(false);
    expect(result[1].isLow).toBe(true);
  });

  it("returns empty array when no tide_schedule exists", () => {
    const forecasts = [
      {
        id: "1",
        beach_id: "beach-1",
        forecast_date: "2026-01-15",
        forecast_time: "12:00",
        wave_height: "3.0 ft",
        water_temp: "60F",
        confidence_score: 85,
        data_source: "NOAA_NWS" as const,
        created_at: "2026-01-15T00:00:00Z",
        updated_at: "2026-01-15T00:00:00Z",
        raw_forecast: null,
      },
    ];

    const result = normalizeTideSchedule(forecasts);
    expect(result).toHaveLength(0);
  });

  it("returns empty array when forecasts is undefined", () => {
    const result = normalizeTideSchedule(undefined);
    expect(result).toHaveLength(0);
  });

  it("returns empty array when forecasts is empty array", () => {
    const result = normalizeTideSchedule([]);
    expect(result).toHaveLength(0);
  });

  it("correctly converts Unix timestamp to Date objects", () => {
    const testTimestamp = 1737003420; // seconds
    const forecasts = [
      {
        id: "1",
        beach_id: "beach-1",
        forecast_date: "2026-01-15",
        forecast_time: "12:00",
        wave_height: "3.0 ft",
        water_temp: "60F",
        confidence_score: 85,
        data_source: "NOAA_NWS" as const,
        created_at: "2026-01-15T00:00:00Z",
        updated_at: "2026-01-15T00:00:00Z",
        raw_forecast: {
          tide_schedule: [
            { time: testTimestamp, height: 3.6, type: "high" as const },
          ],
        },
      },
    ];

    const result = normalizeTideSchedule(forecasts);

    expect(result).toHaveLength(1);
    expect(result[0].t).toBeInstanceOf(Date);
    expect((result[0].t as Date).getTime()).toBe(testTimestamp * 1000);
    expect(result[0].timestamp).toBe(testTimestamp * 1000);
  });

  it("finds tide_schedule from first forecast that has one", () => {
    const forecasts = [
      {
        id: "1",
        beach_id: "beach-1",
        forecast_date: "2026-01-15",
        forecast_time: "09:00",
        wave_height: "3.0 ft",
        water_temp: "60F",
        confidence_score: 85,
        data_source: "NOAA_NWS" as const,
        created_at: "2026-01-15T00:00:00Z",
        updated_at: "2026-01-15T00:00:00Z",
        raw_forecast: null, // First forecast has no tide_schedule
      },
      {
        id: "2",
        beach_id: "beach-1",
        forecast_date: "2026-01-15",
        forecast_time: "12:00",
        wave_height: "3.5 ft",
        water_temp: "60F",
        confidence_score: 85,
        data_source: "NOAA_NWS" as const,
        created_at: "2026-01-15T00:00:00Z",
        updated_at: "2026-01-15T00:00:00Z",
        raw_forecast: {
          tide_schedule: [
            { time: 1737003420, height: 4.2, type: "high" as const },
          ],
        },
      },
    ];

    const result = normalizeTideSchedule(forecasts);

    expect(result).toHaveLength(1);
    expect(result[0].h).toBe(4.2);
  });
});
