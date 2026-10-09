import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import { buildSurfWindowRecommendations, type SurfWindowForecastGroup } from "@/lib/recommendations/surf-window-recommendations";

jest.mock("@/lib/utils/timezone-utils.server", () => ({
  getTimezoneFromCoords: jest.fn(() => "America/Los_Angeles"),
}));

const NOW = new Date("2024-01-15T16:00:00Z"); // 8am PST

function makeBeach(overrides: Partial<Beach> = {}): Beach {
  return {
    id: "beach-1",
    name: "Test Beach",
    slug: "test-beach",
    city: "San Diego",
    state: "CA",
    country: "USA",
    region: "Southern California",
    lat: 32.75,
    lon: -117.25,
    is_private: false,
    wind_offshore_deg: 45,
    wind_offshore_tol_deg: 35,
    preferred_tide_ft_min: 2,
    preferred_tide_ft_max: 5,
    preferred_tide_direction: "rising",
    swell_window_center_deg: 270,
    swell_window_halfwidth_deg: 45,
    real_takeaways: ["Works best with clean W swell"],
    ...overrides,
  } as Beach;
}

function makeForecast(overrides: Partial<EnhancedForecastEntity> = {}): EnhancedForecastEntity {
  return {
    id: "forecast-1",
    beach_id: "beach-1",
    forecast_at: "2024-01-15T17:00:00Z",
    forecast_date: "2024-01-15",
    forecast_time: "09:00",
    wave_height: "4",
    wave_period: "12s",
    wave_direction: "W",
    swell_1_height: "4",
    swell_1_period: "12s",
    swell_1_direction: "270",
    wind_speed: "5",
    wind_direction: "NE",
    wind_direction_deg: 45,
    tide_status: "Rising",
    tide_height: "3.5",
    next_tide_at: "2024-01-15T20:00:00Z",
    next_tide_type: "High",
    confidence_score: 85,
    data_source: "NOAA_NWS",
    water_temp: "62",
    created_at: "2024-01-15T00:00:00Z",
    updated_at: "2024-01-15T00:00:00Z",
    ...overrides,
  } as EnhancedForecastEntity;
}

function dayForecast(day: number, overrides: Partial<EnhancedForecastEntity> = {}): EnhancedForecastEntity {
  const date = `2024-01-${String(day).padStart(2, "0")}`;
  return makeForecast({
    id: `forecast-${day}`,
    forecast_at: `${date}T17:00:00Z`,
    forecast_date: date,
    forecast_time: "09:00",
    ...overrides,
  });
}

describe("buildSurfWindowRecommendations", () => {

  it("uses shared source and link helpers in built recommendations", () => {
    const result = buildSurfWindowRecommendations(
      [
        {
          beach: makeBeach({
            id: "beach-hints",
            slug: "hint-beach",
          }),
          forecasts: [
            dayForecast(15, {
              id: "hint-forecast",
              beach_id: "beach-hints",
              data_source: "NOAA_NWS",
            }),
          ],
          sourceHints: {
            hasBuoy: true,
            hasCam: true,
            hasUserReport: true,
          },
        },
      ],
      {
        now: NOW,
        baseUrl: "https://example.com/",
        sourceHints: {
          hasCam: false,
        },
      }
    );

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].sources).toMatchObject({
      buoy: true,
      cam: true,
      userReport: true,
    });
    expect(result.recommendations[0].dataNotes).not.toContain(
      "No buoy source is attached to this window"
    );
    expect(result.recommendations[0].dataNotes).not.toContain(
      "No cam source is attached to this window"
    );
    expect(result.recommendations[0].dataNotes).not.toContain(
      "No user-report source is attached to this window"
    );
    expect(result.recommendations[0].appDeepLink).toContain(
      "/app/spot/hint-beach?window="
    );
    expect(result.recommendations[0].universalLink).toMatch(
      /^https:\/\/example.com\/app\/spot\/hint-beach\?window=/
    );
    expect(result.recommendations[0].canonicalWebUrl).toBe(
      "https://example.com/ca/san-diego/hint-beach"
    );
    expect(result.recommendations[0].canonicalWebUrl).not.toContain("window=");
  });

  it("ranks region input with multiple beaches deterministically", () => {
    const groups: SurfWindowForecastGroup[] = [
      {
        beach: makeBeach({ id: "beach-b", name: "Beach B", slug: "beach-b" }),
        forecasts: [dayForecast(16, { id: "b-forecast", beach_id: "beach-b", wave_height: "4" })],
      },
      {
        beach: makeBeach({ id: "beach-a", name: "Beach A", slug: "beach-a" }),
        forecasts: [dayForecast(16, { id: "a-forecast", beach_id: "beach-a", wave_height: "4" })],
      },
    ];

    const first = buildSurfWindowRecommendations(groups, { now: NOW });
    const second = buildSurfWindowRecommendations(groups, { now: NOW });

    expect(first.recommendations.map((item) => item.windowId)).toEqual(
      second.recommendations.map((item) => item.windowId)
    );
    expect(first.recommendations.map((item) => item.rank)).toEqual([1, 2]);
  });
});
