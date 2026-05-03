/**
 * Tests for `rerankHero` — hero-lift behavior + non-hero order preservation.
 *
 * Behavior contract:
 *  - Picks the highest heroWindowScore as the new hero.
 *  - Lifts ONLY that candidate to position 0.
 *  - Preserves engine-score order for ALL OTHER candidates.
 *  - If the engine-sort hero already wins, returns the same array reference.
 *  - Diagnostics array is ordered identically to reranked.
 */

import { rerankHero } from "@/lib/services/discovery/hero-ranking";
import { createSpotProfile } from "@/lib/domains/spot-profile/spot-profile";
import { createBeach, createForecast } from "@/__tests__/lib/domains/__fixtures__";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type {
  PersonalizedForecastWindow,
  SurfDiscoveryRecommendation,
} from "@/types/personalization";
import type { SpotProfile } from "@/lib/domains/spot-profile/types";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function fx(overrides: Partial<EnhancedForecastEntity>): EnhancedForecastEntity {
  return createForecast(overrides) as unknown as EnhancedForecastEntity;
}

function makeWindow(durationHours: number): PersonalizedForecastWindow {
  const start = new Date("2026-05-01T14:00:00Z");
  const end = new Date(start.getTime() + durationHours * 3_600_000);
  return {
    start,
    end,
    tide: "Rising",
    wind: "5 mph E",
    waveHeight: "3-4 ft",
    wavePeriod: "12s",
    dataSource: "NOAA_NWS",
    confidence: 80,
    timezone: "America/Los_Angeles",
  };
}

interface MakeRecOptions {
  slug: string;
  name: string;
  /** Engine total score (0-100). Drives engine-sort order. */
  score: number;
  /** Beach swell window — controls setupSuitability via wraparound math. */
  swellWindowMin: number;
  swellWindowMax: number;
  /** Forecast direction/period — controls setupSuitability. */
  waveDirection: string;
  wavePeriod: string;
  /** Per-slot raw scorer outputs across the window. */
  windowSlotScores: number[];
  /** Window duration (hours). */
  durationHours: number;
  /** Subscore inputs (raw scales: tideFit 0-15, windAlignment 0-20). */
  tideFit: number;
  windAlignment: number;
}

function makeRec(opts: MakeRecOptions): SurfDiscoveryRecommendation {
  const beach = createBeach({
    id: opts.slug,
    slug: opts.slug,
    name: opts.name,
    swell_window_min_deg: opts.swellWindowMin,
    swell_window_max_deg: opts.swellWindowMax,
  });
  const profile: SpotProfile = createSpotProfile(beach as Beach);
  const forecast = fx({
    wave_direction: opts.waveDirection,
    wave_period: opts.wavePeriod,
    // Mirror direction onto swell_1 so the shared-signal extractor picks up
    // the test's intended setup (it prefers swell_1_* over wave_*).
    swell_1_period: opts.wavePeriod,
    swell_1_direction: opts.waveDirection,
  });
  return {
    beach: beach as Beach & { photo_url?: string | null },
    window: makeWindow(opts.durationHours),
    forecast,
    score: opts.score,
    matchQuality: "good",
    subscores: {
      waveHeightFit: 20,
      periodEnergyScore: 15,
      windAlignment: opts.windAlignment,
      tideFit: opts.tideFit,
      affinityBonus: 0,
      personalizationBonus: 0,
      distancePenalty: 0,
    },
    summary: opts.name,
    reasons: [],
    warnings: [],
    spotProfile: profile,
    windowSlotScores: opts.windowSlotScores,
    similarity: null,
    generated_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("rerankHero", () => {
  it("returns empty result for an empty input", () => {
    const result = rerankHero([]);
    expect(result.reranked).toEqual([]);
    expect(result.diagnostics).toEqual([]);
  });

  it("lifts OB to position 0 and preserves engine order for non-hero candidates", () => {
    // Engine order [PB, OB, Crystal, Other] by `score`.
    // PB has the highest engine score but a SELECTIVE swell window
    // (210→250, halfWidth=20) on short-period W swell (270° @ 6s) — gets
    // selectivity penalty in setupSuitability.
    // OB has a WIDE wraparound window (220→5, halfWidth ≈ 72.5) on the same
    // short-period W swell — gets exposure bonus.
    const pb = makeRec({
      slug: "pacific-beach",
      name: "Pacific Beach",
      score: 80,
      swellWindowMin: 210,
      swellWindowMax: 250,
      waveDirection: "270",
      wavePeriod: "6s",
      windowSlotScores: [80, 78, 75, 72],
      durationHours: 4,
      tideFit: 12,
      windAlignment: 16,
    });
    const ob = makeRec({
      slug: "ocean-beach-pier",
      name: "Ocean Beach Pier",
      score: 75,
      swellWindowMin: 220,
      swellWindowMax: 5,
      waveDirection: "270",
      wavePeriod: "6s",
      windowSlotScores: [75, 76, 75, 74],
      durationHours: 4,
      tideFit: 10,
      windAlignment: 16,
    });
    const crystal = makeRec({
      slug: "crystal-pier",
      name: "Crystal Pier",
      score: 70,
      swellWindowMin: 220,
      swellWindowMax: 280,
      waveDirection: "270",
      wavePeriod: "6s",
      windowSlotScores: [70, 70, 70, 70],
      durationHours: 4,
      tideFit: 10,
      windAlignment: 14,
    });
    const other = makeRec({
      slug: "other-beach",
      name: "Other Beach",
      score: 65,
      swellWindowMin: 210,
      swellWindowMax: 250,
      waveDirection: "270",
      wavePeriod: "6s",
      windowSlotScores: [65, 65, 65, 65],
      durationHours: 4,
      tideFit: 8,
      windAlignment: 12,
    });

    const recs = [pb, ob, crystal, other];
    const { reranked, diagnostics } = rerankHero(recs);

    expect(reranked.map((r) => r.beach.slug)).toEqual([
      "ocean-beach-pier",
      "pacific-beach",
      "crystal-pier",
      "other-beach",
    ]);

    // Diagnostics ordered identically to reranked.
    expect(diagnostics.map((d) => d.beachSlug)).toEqual(
      reranked.map((r) => r.beach.slug),
    );
    expect(diagnostics[0].isHero).toBe(true);
    expect(diagnostics[0].finalRank).toBe(0);
    expect(diagnostics[1].isHero).toBe(false);
    expect(diagnostics[1].finalRank).toBe(1);
  });

  it("returns the same array reference when the engine-sort hero already wins", () => {
    // PB has both highest engine score AND the best setup (long-period SW
    // 220° @ 14s into a selective 210→250 window — alignment dominates).
    const pb = makeRec({
      slug: "pacific-beach",
      name: "Pacific Beach",
      score: 88,
      swellWindowMin: 210,
      swellWindowMax: 250,
      waveDirection: "220",
      wavePeriod: "14s",
      windowSlotScores: [88, 86, 85, 84],
      durationHours: 4,
      tideFit: 14,
      windAlignment: 18,
    });
    const ob = makeRec({
      slug: "ocean-beach-pier",
      name: "Ocean Beach Pier",
      score: 70,
      swellWindowMin: 220,
      swellWindowMax: 5,
      waveDirection: "220",
      wavePeriod: "14s",
      windowSlotScores: [70, 70, 68, 65],
      durationHours: 3,
      tideFit: 8,
      windAlignment: 10,
    });
    const recs = [pb, ob];
    const result = rerankHero(recs);
    expect(result.reranked).toBe(recs); // referential equality
    expect(result.diagnostics).toHaveLength(2);
    expect(result.diagnostics[0].isHero).toBe(true);
  });

  it("populates diagnostic fields from each rec's subscores", () => {
    const rec = makeRec({
      slug: "test-beach",
      name: "Test Beach",
      score: 75,
      swellWindowMin: 200,
      swellWindowMax: 320,
      waveDirection: "270",
      wavePeriod: "6s",
      windowSlotScores: [75, 75, 75, 75],
      durationHours: 4,
      tideFit: 12,
      windAlignment: 16,
    });
    const { diagnostics } = rerankHero([rec]);
    const d = diagnostics[0];
    expect(d.beachSlug).toBe("test-beach");
    expect(d.representativeSlotScore).toBe(75);
    expect(d.tideFit).toBe(12);
    expect(d.windAlignment).toBe(16);
    expect(d.windowDurationHours).toBe(4);
    expect(d.windowPersistence).toBe(100); // all-equal slots
    expect(d.setupSuitability).toBeGreaterThan(0);
    expect(d.heroWindowScore).toBeGreaterThan(0);
    expect(d.heroWindowScore).toBeLessThanOrEqual(100);
  });

  it("handles ISO-string window start/end (not just Date objects)", () => {
    const rec = makeRec({
      slug: "test-beach",
      name: "Test Beach",
      score: 75,
      swellWindowMin: 200,
      swellWindowMax: 320,
      waveDirection: "270",
      wavePeriod: "6s",
      windowSlotScores: [75, 75, 75, 75],
      durationHours: 4,
      tideFit: 12,
      windAlignment: 16,
    });
    // Force the window dates to ISO strings to mimic JSON-serialized payloads.
    const start = "2026-05-01T14:00:00Z";
    const end = "2026-05-01T18:00:00Z";
    rec.window = {
      ...rec.window,
      start: start as unknown as Date,
      end: end as unknown as Date,
    };
    const { diagnostics } = rerankHero([rec]);
    expect(diagnostics[0].windowDurationHours).toBe(4);
  });
});
