import { render, screen } from "@testing-library/react";

import { SessionIntelligenceModule } from "@/components/home-screen/session-intelligence-module";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { SurfDiscoveryRecommendation } from "@/types/personalization";

function makeBeach(overrides: Partial<Beach> = {}): Beach {
  return {
    id: "beach-1",
    name: "Blacks",
    slug: "blacks",
    city: "San Diego",
    state: "CA",
    country: "USA",
    region: "Southern California",
    lat: 32.889,
    lon: -117.253,
    is_private: false,
    wind_offshore_deg: 90,
    wind_offshore_tol_deg: 35,
    preferred_tide_ft_min: 1,
    preferred_tide_ft_max: 4,
    preferred_tide_direction: "rising",
    swell_window_center_deg: 270,
    swell_window_halfwidth_deg: 45,
    real_takeaways: ["Works when west swell lines up with light wind"],
    ...overrides,
  } as Beach;
}

function makeForecast(
  id: string,
  forecastAt: string,
  overrides: Partial<EnhancedForecastEntity> = {}
): EnhancedForecastEntity {
  return {
    id,
    beach_id: "beach-1",
    forecast_at: forecastAt,
    forecast_date: forecastAt.slice(0, 10),
    forecast_time: "09:00",
    wave_height: "4",
    wave_period: "12s",
    wave_direction: "W",
    swell_1_height: "4",
    swell_1_period: "12s",
    swell_1_direction: "270",
    wind_speed: "5",
    wind_direction: "E",
    wind_direction_deg: 90,
    tide_status: "Rising",
    tide_height: "2.8",
    next_tide_at: "2026-02-10T20:00:00Z",
    confidence_score: 84,
    data_source: "NOAA_NWS",
    created_at: "2026-02-10T00:00:00Z",
    updated_at: "2026-02-10T00:00:00Z",
    ...overrides,
  } as EnhancedForecastEntity;
}

function makeDiscoveryRecommendation(
  index: number,
  overrides: Partial<SurfDiscoveryRecommendation> = {}
): SurfDiscoveryRecommendation {
  const beach = makeBeach({
    id: `beach-${index}`,
    name: index === 1 ? "Blacks" : `Beach ${index}`,
    slug: index === 1 ? "blacks" : `beach-${index}`,
  });
  const forecast = makeForecast(
    `forecast-${index}`,
    `2026-02-${10 + index}T16:00:00Z`,
    { beach_id: beach.id }
  );

  return {
    beach,
    window: {
      start: new Date(`2026-02-${10 + index}T16:00:00Z`),
      end: new Date(`2026-02-${10 + index}T18:00:00Z`),
      timezone: "America/Los_Angeles",
      tide: "Rising",
      wind: "5 E",
      waveHeight: "4 ft",
      wavePeriod: "12s",
      dataSource: "NOAA_NWS",
      confidence: 82,
      score: 80 - index,
      peakTime: new Date(`2026-02-${10 + index}T17:00:00Z`),
      sourceForecast: forecast,
    },
    forecast,
    score: 80 - index,
    personalized: false,
    matchQuality: "good",
    subscores: {
      waveHeightFit: 20,
      periodEnergyScore: 18,
      windAlignment: 16,
      tideFit: 10,
      affinityBonus: 0,
      personalizationBonus: 0,
      distancePenalty: 0,
    },
    summary: "Clean window",
    message: "Clean window",
    reasons: ["Light offshore wind", "Manageable swell"],
    warnings: [],
    generated_at: "2026-02-10T15:00:00Z",
    similarity: null,
    ...overrides,
  } as SurfDiscoveryRecommendation;
}

describe("SessionIntelligenceModule", () => {
  it("renders a compact homepage module with browse and app CTAs", () => {
    render(
      <SessionIntelligenceModule
        recommendations={[
          makeDiscoveryRecommendation(1),
          makeDiscoveryRecommendation(2),
          makeDiscoveryRecommendation(3),
          makeDiscoveryRecommendation(4),
        ]}
        baseUrl="https://example.com"
      />
    );

    expect(screen.getByTestId("home-session-intelligence-module")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Find your next best surf window" })).toBeVisible();
    expect(screen.getAllByTestId("surf-window-card")).toHaveLength(3);
    expect(screen.getByRole("link", { name: /browse best surf windows/i })).toHaveAttribute(
      "href",
      "/forecast"
    );
    expect(screen.getAllByRole("link", { name: "Open in app" })[0]).toHaveAttribute(
      "href",
      expect.stringMatching(/^https:\/\/example.com\/app\/spot\/blacks\?window=/)
    );
  });

  it("renders a forecast fallback when discovery has no recommendations", () => {
    render(<SessionIntelligenceModule recommendations={[]} />);

    expect(screen.getByTestId("home-session-intelligence-module")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "No best-window picks are ready yet."
    );
    expect(screen.getByRole("link", { name: /browse best surf windows/i })).toHaveAttribute(
      "href",
      "/forecast"
    );
    expect(screen.queryByTestId("surf-window-card")).not.toBeInTheDocument();
  });
});
