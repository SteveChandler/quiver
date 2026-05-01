/**
 * Tests for `computeWindowSlotScores` — the orchestrator helper that runs
 * the full 8-scorer engine across every hourly forecast row inside a
 * candidate's selected window.
 *
 * Contract under test:
 *  - Filters allHourly to forecast_at ∈ [window.start, window.end) (inclusive
 *    start, exclusive end).
 *  - Sorts ascending by forecast_at.
 *  - Returns one number per row.
 *  - Empty window → [].
 *  - Missing-data rows are passed to the engine as-is; if scoring throws on
 *    a row, that row's score is 0 (engine handles nulls otherwise).
 */
import { computeWindowSlotScores } from "@/lib/services/discovery/surf-discovery-orchestrator";
import { createDiscoveryScoringEngine, beachToSpotProfile } from "@/lib/domains/scoring";
import { createBeach, createForecast } from "@/__tests__/lib/domains/__fixtures__";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type {
  PersonalizedForecastWindow,
  SurfDiscoveryRecommendation,
} from "@/types/personalization";

function makeWindow(startISO: string, endISO: string): PersonalizedForecastWindow {
  return {
    start: new Date(startISO),
    end: new Date(endISO),
    tide: "Rising",
    wind: "5 mph E",
    waveHeight: "3-4 ft",
    wavePeriod: "12s",
    dataSource: "NOAA_NWS",
    confidence: 80,
    timezone: "America/Los_Angeles",
  };
}

function makeRec(
  beach: Beach,
  window: PersonalizedForecastWindow,
  forecast: EnhancedForecastEntity,
): SurfDiscoveryRecommendation {
  return {
    beach: beach as Beach & { photo_url?: string | null },
    window,
    forecast,
    score: 70,
    matchQuality: "good",
    subscores: {
      waveHeightFit: 18,
      periodEnergyScore: 15,
      windAlignment: 15,
      tideFit: 10,
      affinityBonus: 0,
      personalizationBonus: 0,
      distancePenalty: 0,
    },
    summary: "test",
    reasons: [],
    warnings: [],
    conditionBadges: [],
    spotProfile: beachToSpotProfile(beach),
    generated_at: new Date().toISOString(),
  };
}

function fx(at: string, overrides: Partial<EnhancedForecastEntity> = {}): EnhancedForecastEntity {
  return createForecast({
    forecast_at: at as `${string}T${string}Z`,
    forecast_date: at.slice(0, 10),
    forecast_time: at.slice(11, 16),
    wave_height: "3.5",
    wave_period: "10s",
    wave_direction: "270",
    swell_1_height: "3.5",
    swell_1_period: "10s",
    swell_1_direction: "270",
    wind_speed: "4",
    wind_direction: "E",
    wind_direction_deg: 90,
    tide_height: "2.5",
    tide_status: "rising",
    ...overrides,
  }) as unknown as EnhancedForecastEntity;
}

describe("computeWindowSlotScores", () => {
  const engine = createDiscoveryScoringEngine();
  const beach = createBeach({
    swell_window_min_deg: 220,
    swell_window_max_deg: 320,
    preferred_tide_ft_min: 0,
    preferred_tide_ft_max: 5,
  }) as unknown as Beach;

  it("scores every row inside a typical 4-hour window, sorted ascending", () => {
    const window = makeWindow("2026-05-01T14:00:00Z", "2026-05-01T18:00:00Z");
    // Intentionally out of order to verify ascending sort.
    const allHourly = [
      fx("2026-05-01T16:00:00Z"),
      fx("2026-05-01T14:00:00Z"),
      fx("2026-05-01T17:00:00Z"),
      fx("2026-05-01T15:00:00Z"),
      // Outside window: must be excluded.
      fx("2026-05-01T13:00:00Z"),
      fx("2026-05-01T19:00:00Z"),
    ];
    const rec = makeRec(beach, window, allHourly[1]!);

    const scores = computeWindowSlotScores(rec, allHourly, engine);
    expect(scores).toHaveLength(4);
    scores.forEach((s) => {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    });
  });

  it("excludes the exact end timestamp (end is exclusive)", () => {
    const window = makeWindow("2026-05-01T14:00:00Z", "2026-05-01T17:00:00Z");
    const allHourly = [
      fx("2026-05-01T14:00:00Z"),
      fx("2026-05-01T15:00:00Z"),
      fx("2026-05-01T16:00:00Z"),
      // This row sits exactly at the end boundary and must be excluded.
      fx("2026-05-01T17:00:00Z"),
    ];
    const rec = makeRec(beach, window, allHourly[0]!);
    const scores = computeWindowSlotScores(rec, allHourly, engine);
    expect(scores).toHaveLength(3);
  });

  it("returns one score for a single-row window", () => {
    const window = makeWindow("2026-05-01T14:00:00Z", "2026-05-01T15:00:00Z");
    const allHourly = [
      fx("2026-05-01T13:00:00Z"),
      fx("2026-05-01T14:00:00Z"),
      fx("2026-05-01T15:30:00Z"),
    ];
    const rec = makeRec(beach, window, allHourly[1]!);
    const scores = computeWindowSlotScores(rec, allHourly, engine);
    expect(scores).toHaveLength(1);
    expect(scores[0]).toBeGreaterThanOrEqual(0);
    expect(scores[0]).toBeLessThanOrEqual(100);
  });

  it("returns [] for an empty window (no rows in range)", () => {
    const window = makeWindow("2026-05-01T14:00:00Z", "2026-05-01T18:00:00Z");
    const allHourly = [
      fx("2026-05-01T11:00:00Z"),
      fx("2026-05-01T12:00:00Z"),
      fx("2026-05-01T20:00:00Z"),
    ];
    const rec = makeRec(beach, window, allHourly[0]!);
    expect(computeWindowSlotScores(rec, allHourly, engine)).toEqual([]);
  });

  it("returns [] when allHourly is empty", () => {
    const window = makeWindow("2026-05-01T14:00:00Z", "2026-05-01T18:00:00Z");
    const rec = makeRec(beach, window, fx("2026-05-01T14:00:00Z"));
    expect(computeWindowSlotScores(rec, [], engine)).toEqual([]);
  });

  it("scores a row with a missing tide field as-is (engine handles nulls)", () => {
    const window = makeWindow("2026-05-01T14:00:00Z", "2026-05-01T16:00:00Z");
    const allHourly = [
      fx("2026-05-01T14:00:00Z"),
      // Row with tide stripped to null — engine should still produce a score.
      fx("2026-05-01T15:00:00Z", { tide_height: null, tide_status: null }),
    ];
    const rec = makeRec(beach, window, allHourly[0]!);
    const scores = computeWindowSlotScores(rec, allHourly, engine);
    expect(scores).toHaveLength(2);
    scores.forEach((s) => {
      expect(Number.isFinite(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    });
  });

  it("returns [] when window.start or window.end is missing", () => {
    const allHourly = [fx("2026-05-01T14:00:00Z")];
    const recNoEnd = makeRec(
      beach,
      // Force-cast: simulating a malformed window from a downstream caller.
      { ...makeWindow("2026-05-01T14:00:00Z", "2026-05-01T18:00:00Z"), end: undefined as unknown as Date },
      allHourly[0]!,
    );
    expect(computeWindowSlotScores(recNoEnd, allHourly, engine)).toEqual([]);
  });
});
