/**
 * Shared discovery API fixtures for E2E tests.
 * Use these fixtures to mock the /api/surf/discover endpoint.
 */

export interface DiscoveryFixtureOptions {
  /** Override beach properties */
  beach?: Partial<{
    id: string;
    name: string;
    slug: string | null;
    city: string | null;
    state: string | null;
    country?: string | null;
    lat: number;
    lon: number;
    region: string;
  }>;
  /** Override score (0-100) */
  score?: number;
  /** Override match quality */
  matchQuality?: string;
  /** Number of recommendations to include (default: 1) */
  recommendationCount?: number;
  /** Return empty recommendations */
  empty?: boolean;
}

/**
 * Creates a discovery API response fixture with sensible defaults.
 *
 * @example
 * // Default fixture with Marine Street Beach
 * const fixture = createDiscoveryFixture();
 *
 * @example
 * // Custom beach
 * const fixture = createDiscoveryFixture({
 *   beach: { name: "Windansea Beach", slug: "windansea-beach" }
 * });
 *
 * @example
 * // Empty recommendations
 * const fixture = createDiscoveryFixture({ empty: true });
 */
export function createDiscoveryFixture(options: DiscoveryFixtureOptions = {}) {
  const now = Date.now();
  const start = new Date(now + 60 * 60 * 1000); // +1h
  const end = new Date(now + 3 * 60 * 60 * 1000); // +3h

  if (options.empty) {
    return {
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        recommendations: [],
        searchCriteria: { maxResults: 6 },
        metadata: {
          totalBeachesConsidered: 0,
          successfulForecasts: 0,
          partialSuccess: false,
          failedBeaches: 0,
          staleBeaches: 0,
          generated_at: new Date().toISOString(),
        },
      },
    };
  }

  const defaultBeach = {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Marine Street Beach",
    slug: "marine-street-beach",
    city: "La Jolla",
    state: "CA",
    lat: 32.832,
    lon: -117.281,
    region: "California",
    ...options.beach,
  };

  const defaultRecommendation = {
    beach: defaultBeach,
    window: {
      start: start.toISOString(),
      end: end.toISOString(),
      tide: "Rising",
      wind: "5 mph NE",
      waveHeight: "3.3 ft",
      wavePeriod: "12s",
      dataSource: "NOAA_NWS",
      confidence: 78,
      timezone: "America/Los_Angeles",
    },
    forecast: {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      beach_id: defaultBeach.id,
      forecast_date: new Date().toISOString().split("T")[0],
      forecast_time: "12:00",
      wave_height: "3.3",
      wave_period: "12",
      water_temp: "63",
      wind_speed: "5 mph",
      wind_direction: "NE",
      tide_status: "Rising",
      confidence_score: 78,
      data_source: "NOAA_NWS",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    score: options.score ?? 86,
    matchQuality: options.matchQuality ?? "excellent",
    subscores: {
      waveHeightFit: 20,
      periodEnergyScore: 16,
      windAlignment: 14,
      tideFit: 10,
      affinityBonus: 6,
      distancePenalty: 0,
    },
    summary: "Great window with clean wind and rising tide.",
    reasons: ["Rising tide", "Clean winds", "Solid period"],
    warnings: [],
    generated_at: new Date().toISOString(),
  };

  // Generate multiple recommendations if requested
  const recommendationCount = options.recommendationCount ?? 1;
  const recommendations = [];
  for (let i = 0; i < recommendationCount; i++) {
    if (i === 0) {
      recommendations.push(defaultRecommendation);
    } else {
      // Generate additional recommendations with unique IDs
      recommendations.push({
        ...defaultRecommendation,
        beach: {
          ...defaultBeach,
          id: `${i + 1}${i + 1}${i + 1}${i + 1}${i + 1}${i + 1}${i + 1}${i + 1}-${i + 1}${i + 1}${i + 1}${i + 1}-4${i + 1}${i + 1}${i + 1}-8${i + 1}${i + 1}${i + 1}-${i + 1}${i + 1}${i + 1}${i + 1}${i + 1}${i + 1}${i + 1}${i + 1}${i + 1}${i + 1}${i + 1}${i + 1}`,
          name: `Beach ${i + 1}`,
          slug: `beach-${i + 1}`,
        },
        score: Math.max(50, (options.score ?? 86) - i * 5),
      });
    }
  }

  return {
    success: true,
    timestamp: new Date().toISOString(),
    data: {
      recommendations,
      searchCriteria: { maxResults: 6 },
      metadata: {
        totalBeachesConsidered: 50,
        successfulForecasts: 50,
        partialSuccess: false,
        failedBeaches: 0,
        staleBeaches: 0,
        generated_at: new Date().toISOString(),
      },
    },
  };
}

/**
 * Cache clearing script to run via page.addInitScript().
 * Clears localStorage entries with the discovery cache prefix.
 */
export function removeSurfDiscoveryCacheInitScript() {
  try {
    const prefix = "quiver_discovery_";
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) keysToRemove.push(key);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}
