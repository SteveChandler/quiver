import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import { buildSurfWindowLinks } from "@/lib/recommendations/surf-window-links";
import {
  buildSurfWindowDataNotes,
  buildSurfWindowSourceFlags,
} from "@/lib/recommendations/surf-window-source-flags";

function makeBeach(overrides: Partial<Beach> = {}): Beach {
  return {
    id: "beach-1",
    name: "Ocean Beach",
    slug: "ocean-beach",
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
    swell_window_center_deg: 270,
    swell_window_halfwidth_deg: 45,
    real_takeaways: ["Works on clean W swell"],
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
    wind_speed: "5",
    wind_direction: "NE",
    tide_status: "Rising",
    tide_height: "3.5",
    next_tide_at: "2024-01-15T20:00:00Z",
    confidence_score: 85,
    data_source: "NOAA_NWS",
    water_temp: "62",
    created_at: "2024-01-15T00:00:00Z",
    updated_at: "2024-01-15T00:00:00Z",
    ...overrides,
  } as EnhancedForecastEntity;
}

describe("buildSurfWindowSourceFlags", () => {
  it("does not claim unavailable tide, buoy, cam, or user-report sources", () => {
    const flags = buildSurfWindowSourceFlags({
      forecast: makeForecast({
        tide_status: null,
        tide_height: null,
        next_tide_at: null,
        next_tide_time: null,
        next_tide_type: null,
        next_tide_height: null,
        data_source: "NOAA_NWS",
      }),
      beach: makeBeach(),
    });

    expect(flags).toMatchObject({
      forecastModel: true,
      tide: false,
      buoy: false,
      cam: false,
      userReport: false,
      localSpotIntel: true,
    });
  });

  it("sets buoy true only when explicit buoy source evidence exists", () => {
    expect(
      buildSurfWindowSourceFlags({
        forecast: makeForecast({ data_source: "CDIP" }),
        beach: makeBeach(),
      }).buoy
    ).toBe(true);

    expect(
      buildSurfWindowSourceFlags({
        forecast: makeForecast({
          data_source: "NOAA_NWS",
          raw_forecast: { data_sources: ["NOAA_BUOY"] },
        } as Partial<EnhancedForecastEntity>),
        beach: makeBeach(),
      }).buoy
    ).toBe(true);

    expect(
      buildSurfWindowSourceFlags({
        forecast: makeForecast({
          data_source: "NOAA_NWS",
          raw_forecast: {
            data_sources: "CDIP_BUOY" as unknown as string[],
          },
        }),
        beach: makeBeach(),
      }).buoy
    ).toBe(true);

    expect(
      buildSurfWindowSourceFlags({
        forecast: makeForecast({ data_source: "NOAA_NWS" }),
        beach: makeBeach(),
      }).buoy
    ).toBe(false);
  });

  it("uses explicit cam and user-report hints", () => {
    const flags = buildSurfWindowSourceFlags({
      forecast: makeForecast(),
      beach: makeBeach(),
      hints: {
        hasCam: true,
        hasUserReport: true,
      },
    });

    expect(flags.cam).toBe(true);
    expect(flags.userReport).toBe(true);
  });

  it("adds sparse-data notes without converting missing sources into claims", () => {
    const notes = buildSurfWindowDataNotes({
      forecast: makeForecast({
        tide_status: null,
        tide_height: null,
        next_tide_at: null,
        next_tide_time: null,
        next_tide_type: null,
        next_tide_height: null,
        wave_period: null,
      }),
      beach: makeBeach(),
      confidenceScore: 35,
    });

    expect(notes).toEqual(
      expect.arrayContaining([
        "Tide data is unavailable for this window",
        "No buoy source is attached to this window",
        "No cam source is attached to this window",
        "No user-report source is attached to this window",
        "Forecast confidence is low",
        "Wave details are sparse",
      ])
    );
  });
});

describe("buildSurfWindowLinks", () => {
  it("generates relative app path, absolute universal link, and canonical web URL", () => {
    const links = buildSurfWindowLinks({
      beach: makeBeach(),
      windowId: "beach-1-2024-01-15T17-00-00-000Z",
      baseUrl: "https://example.com/",
    });

    expect(links.appDeepLink).toBe(
      "/app/spot/ocean-beach?window=beach-1-2024-01-15T17-00-00-000Z"
    );
    expect(links.universalLink).toBe(
      "https://example.com/app/spot/ocean-beach?window=beach-1-2024-01-15T17-00-00-000Z"
    );
    expect(links.canonicalWebUrl).toBe(
      "https://example.com/ca/san-diego/ocean-beach"
    );
    expect(links.canonicalWebUrl).not.toContain("window=");
  });

  it("uses the canonical forecast instant native can resolve when supplied", () => {
    const links = buildSurfWindowLinks({
      beach: makeBeach(),
      windowId: "beach-1-2026-08-25T14-00-00-000Z",
      forecastAt: "2026-08-25T14:00:00.000Z",
    });

    expect(links.appDeepLink).toBe(
      "/app/spot/ocean-beach?window=2026-08-25T14%3A00%3A00.000Z",
    );
  });

  it("falls back to a safe beach href when slug is missing", () => {
    const links = buildSurfWindowLinks({
      beach: makeBeach({
        id: "beach-id-fallback",
        slug: null,
        city: null,
        state: null,
      }),
      windowId: "window-1",
    });

    expect(links.appDeepLink).toBe("/beach/beach-id-fallback?window=window-1");
    expect(links.universalLink).toBe(
      "https://www.quiversurf.app/beach/beach-id-fallback?window=window-1"
    );
    expect(links.canonicalWebUrl).toBe(
      "https://www.quiversurf.app/beach/beach-id-fallback"
    );
  });
});
