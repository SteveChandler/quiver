import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { SurfDiscoveryRecommendation } from "@/types/personalization";
import {
  buildHomepageSurfWindowRecommendations,
  buildRegionalSurfWindowRecommendations,
  buildSpotSurfWindowRecommendations,
} from "@/lib/recommendations/session-intelligence-surface-adapters";

jest.mock("@/lib/utils/timezone-utils.server", () => ({
  getTimezoneFromCoords: jest.fn(() => "America/Los_Angeles"),
}));

const NOW = new Date("2026-02-10T15:00:00Z");

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
    wave_height: "2",
    wave_period: "12s",
    wave_direction: "W",
    swell_1_height: "2",
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
    id: `discovery-beach-${index}`,
    name: `Discovery Beach ${index}`,
    slug: `discovery-beach-${index}`,
  });
  const forecast = makeForecast(
    `discovery-forecast-${index}`,
    `2026-02-${10 + index}T16:00:00Z`,
    {
      beach_id: beach.id,
      id: `discovery-forecast-${index}`,
    }
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
    warnings: ["Watch the tide swing"],
    generated_at: "2026-02-10T15:00:00Z",
    similarity: null,
    ...overrides,
  } as SurfDiscoveryRecommendation;
}

describe("session intelligence surface adapters", () => {
  it("builds capped spot recommendations with stable ranks and links", () => {
    const recommendations = buildSpotSurfWindowRecommendations({
      beach: makeBeach(),
      forecasts: [
        makeForecast("forecast-1", "2026-02-10T16:00:00Z"),
        makeForecast("forecast-2", "2026-02-11T16:00:00Z"),
        makeForecast("forecast-3", "2026-02-12T16:00:00Z"),
        makeForecast("forecast-4", "2026-02-13T16:00:00Z"),
      ],
      now: NOW,
      baseUrl: "https://example.com",
    });

    expect(recommendations).toHaveLength(3);
    expect(recommendations.map((item) => item.rank)).toEqual([1, 2, 3]);
    expect(recommendations.every((item) => item.appDeepLink)).toBe(true);
    expect(recommendations[0].universalLink).toMatch(
      /^https:\/\/example.com\/app\/spot\/blacks\?window=/
    );
  });

  it("returns no spot recommendations when no forecast data is available", () => {
    const recommendations = buildSpotSurfWindowRecommendations({
      beach: makeBeach(),
      forecasts: [],
      now: NOW,
    });

    expect(recommendations).toEqual([]);
  });

  it("builds first-week spot recommendations when only 7-day data is available", () => {
    const recommendations = buildSpotSurfWindowRecommendations({
      beach: makeBeach(),
      forecasts: [
        makeForecast("forecast-day-1", "2026-02-11T16:00:00Z"),
        makeForecast("forecast-day-3", "2026-02-13T16:00:00Z"),
      ],
      now: NOW,
    });

    expect(recommendations).toHaveLength(2);
    expect(
      recommendations.every(
        (item) => new Date(item.forecastAt).getTime() <=
          new Date("2026-02-17T15:00:00Z").getTime()
      )
    ).toBe(true);
  });

  it("builds week-two spot recommendations when 14-day data is available", () => {
    const recommendations = buildSpotSurfWindowRecommendations({
      beach: makeBeach(),
      forecasts: [makeForecast("forecast-day-9", "2026-02-19T16:00:00Z")],
      now: NOW,
    });

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].forecastAt).toBe("2026-02-19T16:00:00Z");
  });

  it("builds capped regional recommendations from existing forecast groups", () => {
    const recommendations = buildRegionalSurfWindowRecommendations({
      groups: [
        {
          beach: makeBeach({ id: "beach-a", slug: "beach-a" }),
          forecasts: [makeForecast("a-forecast", "2026-02-10T16:00:00Z")],
        },
        {
          beach: makeBeach({ id: "beach-b", slug: "beach-b" }),
          forecasts: [makeForecast("b-forecast", "2026-02-11T16:00:00Z")],
        },
        {
          beach: makeBeach({ id: "beach-c", slug: "beach-c" }),
          forecasts: [makeForecast("c-forecast", "2026-02-12T16:00:00Z")],
        },
        {
          beach: makeBeach({ id: "beach-d", slug: "beach-d" }),
          forecasts: [makeForecast("d-forecast", "2026-02-13T16:00:00Z")],
        },
      ],
      now: NOW,
    });

    expect(recommendations).toHaveLength(3);
    expect(recommendations.map((item) => item.rank)).toEqual([1, 2, 3]);
  });

  it("can expand regional recommendations to five ranked beaches", () => {
    const recommendations = buildRegionalSurfWindowRecommendations({
      groups: Array.from({ length: 7 }, (_, index) => {
        const rank = index + 1;
        const beach = makeBeach({
          id: `beach-${rank}`,
          slug: `beach-${rank}`,
        });
        return {
          beach,
          forecasts: [
            makeForecast(
              `forecast-${rank}`,
              `2026-02-${10 + rank}T16:00:00Z`,
              { beach_id: beach.id }
            ),
          ],
        };
      }),
      maxRecommendations: 5,
      now: NOW,
    });

    expect(recommendations).toHaveLength(5);
    expect(recommendations.map((item) => item.rank)).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  it("maps homepage discovery recommendations without false tide or buoy claims", () => {
    const recommendation = makeDiscoveryRecommendation(1, {
      forecast: makeForecast("sparse", "2026-02-11T16:00:00Z", {
        tide_status: null,
        tide_height: null,
        next_tide_at: null,
        next_tide_time: null,
        next_tide_type: null,
        next_tide_height: null,
        data_source: "NOAA_NWS",
        raw_forecast: null,
      }),
      warnings: ["Tide detail is sparse"],
    });

    const recommendations = buildHomepageSurfWindowRecommendations({
      recommendations: [recommendation],
      now: NOW,
      baseUrl: "https://example.com",
    });

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].sources.tide).toBe(false);
    expect(recommendations[0].sources.buoy).toBe(false);
    expect(recommendations[0].sources.cam).toBe(false);
    expect(recommendations[0].sources.userReport).toBe(false);
    expect(recommendations[0].watchouts).toContain("Tide detail is sparse");
    expect(recommendations[0].dataNotes).toContain(
      "Tide data is unavailable for this window"
    );
    expect(recommendations[0].dataNotes).toContain(
      "No buoy source is attached to this window"
    );
    expect(recommendations[0].dataNotes).toContain(
      "No cam source is attached to this window"
    );
    expect(recommendations[0].dataNotes).toContain(
      "No user-report source is attached to this window"
    );
  });

  it("preserves low-confidence copy for model-only homepage recommendations", () => {
    const recommendation = makeDiscoveryRecommendation(1, {
      window: {
        ...makeDiscoveryRecommendation(1).window,
        confidence: 25,
      },
      forecast: makeForecast("model-only", "2026-02-11T16:00:00Z", {
        data_source: "NOAA_NWS",
        raw_forecast: null,
        tide_status: null,
        tide_height: null,
        next_tide_at: null,
        next_tide_time: null,
        next_tide_type: null,
        next_tide_height: null,
      }),
      warnings: ["Sparse model confidence"],
    });

    const recommendations = buildHomepageSurfWindowRecommendations({
      recommendations: [recommendation],
      now: NOW,
    });

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].confidence.level).toBe("low");
    expect(recommendations[0].sources).toMatchObject({
      forecastModel: true,
      tide: false,
      buoy: false,
      cam: false,
      userReport: false,
    });
    expect(recommendations[0].dataNotes).toContain("Forecast confidence is low");
    expect(recommendations[0].watchouts).toContain("Sparse model confidence");
  });

  it("caps homepage discovery output at five with stable ranks and CTA links", () => {
    const recommendations = buildHomepageSurfWindowRecommendations({
      recommendations: [
        makeDiscoveryRecommendation(1),
        makeDiscoveryRecommendation(2),
        makeDiscoveryRecommendation(3),
        makeDiscoveryRecommendation(4),
        makeDiscoveryRecommendation(5),
        makeDiscoveryRecommendation(6),
        makeDiscoveryRecommendation(7),
      ],
      now: NOW,
      baseUrl: "https://example.com",
    });

    expect(recommendations).toHaveLength(5);
    expect(recommendations.map((item) => item.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(recommendations.every((item) => item.appDeepLink)).toBe(true);
    expect(recommendations.every((item) => item.universalLink)).toBe(true);
  });

  it("carries discovery beach photos into homepage surf windows", () => {
    const baseRecommendation = makeDiscoveryRecommendation(1);

    const [recommendation] = buildHomepageSurfWindowRecommendations({
      recommendations: [
        {
          ...baseRecommendation,
          beach: {
            ...baseRecommendation.beach,
            photo_url: "https://example.com/blacks.jpg",
          },
        },
      ],
      now: NOW,
    });

    expect(recommendation.beach.photoUrl).toBe("https://example.com/blacks.jpg");
  });

  it("preserves custom recommendation ownership for exact handoff context", () => {
    const baseRecommendation = makeDiscoveryRecommendation(1);
    const recommendationId =
      "custom:22222222-2222-4222-8222-222222222222:2026-02-11T16:00:00.000Z";

    const [recommendation] = buildHomepageSurfWindowRecommendations({
      recommendations: [{
        ...baseRecommendation,
        recommendationId,
        kind: "custom_spot",
        customSpotId: "22222222-2222-4222-8222-222222222222",
      }],
      now: NOW,
    });

    expect(recommendation.recommendationId).toBe(recommendationId);
  });

  describe("verdict/score consistency", () => {
    it("overrides a gate-capped label with the score-band verdict and surfaces a character watchout first", () => {
      const recommendation = makeDiscoveryRecommendation(1, {
        score: 92,
        recommendationLabel: "Maybe",
        character: { label: "Rough", category: "rough" },
      });

      const [result] = buildHomepageSurfWindowRecommendations({
        recommendations: [recommendation],
        now: NOW,
      });

      expect(result.score).toBe(92);
      expect(result.verdict).toBe("Worth it");
      expect(result.watchouts[0]).toMatch(/rough/i);
      expect(result.watchouts[0]).toMatch(/despite the high score/i);
    });

    it("uses a generic watchout when the gate fired without a character label", () => {
      const recommendation = makeDiscoveryRecommendation(1, {
        score: 92,
        recommendationLabel: "Maybe",
        character: undefined,
      });

      const [result] = buildHomepageSurfWindowRecommendations({
        recommendations: [recommendation],
        now: NOW,
      });

      expect(result.verdict).toBe("Worth it");
      expect(result.watchouts[0]).toMatch(/high score but mixed conditions/i);
    });

    it("keeps the label when it agrees with the score band and injects no watchout", () => {
      const recommendation = makeDiscoveryRecommendation(1, {
        score: 92,
        recommendationLabel: "Worth it",
      });

      const [result] = buildHomepageSurfWindowRecommendations({
        recommendations: [recommendation],
        now: NOW,
      });

      expect(result.verdict).toBe("Worth it");
      expect(result.watchouts).toEqual(["Watch the tide swing"]);
    });

    it("keeps an agreeing Maybe label for a mid-band score", () => {
      const recommendation = makeDiscoveryRecommendation(1, {
        score: 55,
        recommendationLabel: "Maybe",
      });

      const [result] = buildHomepageSurfWindowRecommendations({
        recommendations: [recommendation],
        now: NOW,
      });

      expect(result.verdict).toBe("Maybe");
      expect(result.watchouts).toEqual(["Watch the tide swing"]);
    });

    it("falls back to score bands when no label exists", () => {
      const [maybe] = buildHomepageSurfWindowRecommendations({
        recommendations: [
          makeDiscoveryRecommendation(1, { score: 65, recommendationLabel: undefined }),
        ],
        now: NOW,
      });
      const [skip] = buildHomepageSurfWindowRecommendations({
        recommendations: [
          makeDiscoveryRecommendation(1, { score: 35, recommendationLabel: undefined }),
        ],
        now: NOW,
      });

      expect(maybe.verdict).toBe("Maybe");
      expect(skip.verdict).toBe("Skip");
    });
  });

  it("handles cached homepage discovery peak times restored as strings", () => {
    const recommendation = makeDiscoveryRecommendation(1, {
      window: {
        ...makeDiscoveryRecommendation(1).window,
        peakTime: "2026-02-11T17:00:00Z" as unknown as Date,
      },
    });

    const recommendations = buildHomepageSurfWindowRecommendations({
      recommendations: [recommendation],
      now: NOW,
    });

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].peakIso).toBe("2026-02-11T17:00:00.000Z");
  });
});
