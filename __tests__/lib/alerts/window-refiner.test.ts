import {
  refineWindow,
  roundToFiveMinutes,
} from "@/lib/alerts/window-refiner";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";

const beach = {
  id: "beach-1",
  name: "Test Beach",
  aspect_deg: 270,
  max_wind_onshore_mph: 8,
  preferred_tide_ft_min: 2,
  preferred_tide_ft_max: 4,
  swell_window_center_deg: 270,
  swell_window_halfwidth_deg: 45,
  wind_offshore_deg: 90,
  wind_offshore_tol_deg: 45,
} as Beach;

function forecast(
  at: string,
  overrides: Partial<EnhancedForecastEntity> = {},
): EnhancedForecastEntity {
  return {
    id: at,
    beach_id: beach.id,
    forecast_at: at,
    forecast_date: at.slice(0, 10),
    forecast_time: at.slice(11, 19),
    wave_height: "3",
    wave_direction: "270",
    wind_direction_deg: 270,
    wind_speed: "4",
    tide_height: "3",
    tide_status: "Rising",
    water_temp: "65",
    confidence_score: 80,
    data_source: "NOAA_NWS",
    created_at: at,
    updated_at: at,
    ...overrides,
  };
}

describe("refineWindow", () => {
  it("interpolates and rounds a wind-driven end", () => {
    const forecasts = [
      forecast("2026-09-16T15:00:00Z"),
      forecast("2026-09-16T16:00:00Z"),
      forecast("2026-09-16T17:00:00Z"),
      forecast("2026-09-16T18:00:00Z", { wind_speed: "12" }),
    ];

    const result = refineWindow({
      coarse: {
        start: "2026-09-16T15:00:00Z",
        end: "2026-09-16T18:00:00Z",
      },
      forecasts,
      beach,
      tideSamples: null,
      daylight: {
        sunrise: "2026-09-16T13:30:00Z",
        sunset: "2026-09-17T02:00:00Z",
      },
      verdictAt: (row) => Number(row.wind_speed) <= 8 ? "go" : "no",
    });

    expect(result?.end).toBe("2026-09-16T17:30:00.000Z");
    expect(result?.drivers).toContainEqual(expect.objectContaining({
      kind: "wind",
      edge: "end",
      at: "2026-09-16T17:30:00.000Z",
      approximate: true,
    }));
  });

  it("uses an exact sub-hour tide crossing for the start", () => {
    const forecasts = [
      forecast("2026-09-16T15:00:00Z", { tide_height: "1.4" }),
      forecast("2026-09-16T16:00:00Z", { tide_height: "2.4" }),
      forecast("2026-09-16T17:00:00Z"),
    ];
    const tideSamples = Array.from({ length: 11 }, (_, index) => ({
      at: new Date(Date.UTC(2026, 8, 16, 15, index * 6)).toISOString(),
      heightFt: 1.4 + index * 0.1,
    }));

    const result = refineWindow({
      coarse: {
        start: "2026-09-16T16:00:00Z",
        end: "2026-09-16T18:00:00Z",
      },
      forecasts,
      beach,
      tideSamples,
      daylight: {
        sunrise: "2026-09-16T13:30:00Z",
        sunset: "2026-09-17T02:00:00Z",
      },
      verdictAt: (row) => Number(row.tide_height) >= 2 ? "go" : "no",
    });

    expect(result?.start).toBe("2026-09-16T15:36:00.000Z");
    expect(result?.drivers).toContainEqual(expect.objectContaining({
      kind: "tide",
      edge: "start",
      at: "2026-09-16T15:36:00.000Z",
      approximate: false,
    }));
  });

  it("uses sunset as an exact daylight end", () => {
    const forecasts = [
      forecast("2026-09-16T15:00:00Z"),
      forecast("2026-09-16T16:00:00Z"),
      forecast("2026-09-16T17:00:00Z"),
      forecast("2026-09-16T18:00:00Z"),
    ];

    const result = refineWindow({
      coarse: {
        start: "2026-09-16T15:00:00Z",
        end: "2026-09-16T19:00:00Z",
      },
      forecasts,
      beach,
      tideSamples: null,
      daylight: {
        sunrise: "2026-09-16T13:30:00Z",
        sunset: "2026-09-16T18:42:00Z",
      },
      verdictAt: () => "go",
    });

    expect(result?.end).toBe("2026-09-16T18:42:00.000Z");
    expect(result?.drivers).toContainEqual({
      kind: "daylight",
      edge: "end",
      at: "2026-09-16T18:42:00.000Z",
      approximate: false,
      label: "sunset",
    });
  });

  it("discards a refined span under 60 minutes", () => {
    expect(refineWindow({
      coarse: {
        start: "2026-09-16T15:00:00Z",
        end: "2026-09-16T15:50:00Z",
      },
      forecasts: [forecast("2026-09-16T15:00:00Z")],
      beach,
      tideSamples: null,
      daylight: {
        sunrise: "2026-09-16T13:30:00Z",
        sunset: "2026-09-17T02:00:00Z",
      },
      verdictAt: () => "go",
    })).toBeNull();
  });
});

describe("roundToFiveMinutes", () => {
  it("rounds to the nearest five minutes", () => {
    expect(roundToFiveMinutes("2026-09-16T17:33:00Z"))
      .toBe("2026-09-16T17:35:00.000Z");
  });
});
