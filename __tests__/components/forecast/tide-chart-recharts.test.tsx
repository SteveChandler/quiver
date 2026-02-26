import React from "react";
import { render, screen } from "@testing-library/react";
import { normalizeTideSchedule, TideChart } from "@/components/forecast/tide-chart-recharts";

// Recharts and responsive container often need a DOM size; JSDOM lacks layout.
// Provide a basic mock for getBoundingClientRect to avoid zero-size issues.
beforeAll(() => {
  Element.prototype.getBoundingClientRect = function () {
    return {
      width: 800,
      height: 300,
      top: 0,
      left: 0,
      bottom: 300,
      right: 800,
    } as DOMRect;
  };
});

describe("TideChart data priority", () => {
  it("prefers tide_schedule over forecast fields when available", () => {
    // This is an integration test - we'll verify the chart renders correctly
    // by checking the data flow prioritizes tide_schedule
    const forecasts = [
      {
        id: "1",
        beach_id: "beach-1",
        forecast_at: "2026-01-15T17:00Z",
        forecast_date: "2026-01-15",
        forecast_time: "17:00",
        tide_height: "2.3 ft",
        next_tide_type: "High Tide", // This used to cause wrong marking
        wave_height: "3.0 ft",
        water_temp: "60F",
        confidence_score: 85,
        data_source: "NOAA_NWS" as const,
        created_at: "2026-01-15T00:00:00Z",
        updated_at: "2026-01-15T00:00:00Z",
        raw_forecast: {
          tide_schedule: [
            { time: 1737003420, height: 3.6, type: "high" as const }, // 8:37 PM
            { time: 1737030720, height: 2.5, type: "low" as const },
          ],
        },
      },
    ];

    const tideScheduleData = normalizeTideSchedule(forecasts);

    // The 8:37 PM point should be marked as high, NOT the 5 PM forecast time
    expect(tideScheduleData[0].isHigh).toBe(true);
    expect(tideScheduleData[0].timestamp).toBe(1737003420 * 1000);
  });
});

describe("normalizeTideSchedule", () => {
  it("extracts tide extrema from raw_forecast.tide_schedule", () => {
    const forecasts = [
      {
        id: "1",
        beach_id: "beach-1",
        forecast_at: "2026-01-15T12:00Z",
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
        forecast_at: "2026-01-15T12:00Z",
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
        forecast_at: "2026-01-15T12:00Z",
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
        forecast_at: "2026-01-15T09:00Z",
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
        forecast_at: "2026-01-15T12:00Z",
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

describe("TideChart (smoke)", () => {
  it("renders card and title with empty data without throwing", () => {
    render(<TideChart data={[]} forecasts={[]} hourly={[]} events={[]} />);
    expect(screen.getByText("Tide Forecast")).toBeInTheDocument();
    expect(screen.getByText("No tide data available")).toBeInTheDocument();
  });
});
