import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import { buildSurfWindowRecommendations } from "@/lib/recommendations/surf-window-recommendations";

jest.mock("@/lib/utils/timezone-utils.server", () => ({
  getTimezoneFromCoords: jest.fn(() => "America/Los_Angeles"),
}));

let mockStripReasons = false;
jest.mock("@/lib/services/discovery/window-selector", () => {
  const actual = jest.requireActual("@/lib/services/discovery/window-selector");
  return {
    ...actual,
    scoreWindowWithComposite: (...args: unknown[]) => {
      const result = actual.scoreWindowWithComposite(...args);
      return mockStripReasons ? { ...result, reasons: [] } : result;
    },
  };
});

const NOW = new Date("2024-01-15T16:00:00Z");

const beach = {
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
  swell_window_center_deg: 270,
  swell_window_halfwidth_deg: 45,
} as Beach;

const forecast = {
  id: "forecast-15",
  beach_id: "beach-1",
  forecast_at: "2024-01-15T17:00:00Z",
  forecast_date: "2024-01-15",
  forecast_time: "09:00",
  wave_height: "4",
  wave_period: "12s",
  swell_1_height: "4",
  swell_1_period: "12s",
  swell_1_direction: "270",
  wind_speed: "5",
  wind_direction: "NE",
  wind_direction_deg: 45,
  tide_status: "Rising",
  tide_height: "3.5",
  confidence_score: 85,
  data_source: "NOAA_NWS",
} as EnhancedForecastEntity;

function build() {
  return buildSurfWindowRecommendations([{ beach, forecasts: [forecast] }], { now: NOW });
}

describe("buildSurfWindowRecommendations positives", () => {
  afterEach(() => {
    mockStripReasons = false;
  });

  it("returns no stand-in positive when the scorer gives no reason, and keeps the score, verdict and rank", () => {
    const withReasons = build().recommendations;
    mockStripReasons = true;
    const withoutReasons = build().recommendations;

    expect(withoutReasons).toHaveLength(withReasons.length);
    expect(withoutReasons[0].positives).toEqual([]);
    expect(withoutReasons.map((r) => [r.beach.id, r.rank, r.score, r.verdict])).toEqual(
      withReasons.map((r) => [r.beach.id, r.rank, r.score, r.verdict]),
    );
  });
});
