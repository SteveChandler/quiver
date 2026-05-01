/**
 * Tests for `computeSetupSuitability` — hero-only post-process factor.
 *
 * Foundation: reuses `calculateWindowAlignment` (wraparound-safe). Adds a
 * hard ≤8s exposure-vs-selectivity dimension that the engine doesn't have.
 */

import { computeSetupSuitability } from "@/lib/services/discovery/hero-ranking/setup-suitability";
import { createSpotProfile } from "@/lib/domains/spot-profile/spot-profile";
import { createBeach, createForecast } from "@/__tests__/lib/domains/__fixtures__";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";

// `createForecast` returns a TestForecast (Partial<EnhancedForecastEntity> with
// extra required test keys). Cast through unknown to satisfy the strict entity
// shape — every field the function reads is set explicitly via overrides.
function fx(overrides: Partial<EnhancedForecastEntity>): EnhancedForecastEntity {
  return createForecast(overrides) as unknown as EnhancedForecastEntity;
}

describe("computeSetupSuitability", () => {
  const wideExposedBeach = createSpotProfile(
    createBeach({
      swell_window_min_deg: 200,
      swell_window_max_deg: 320, // halfWidthDeg = 60
    }) as Beach,
  );

  const wraparoundBeach = createSpotProfile(
    createBeach({
      swell_window_min_deg: 220,
      swell_window_max_deg: 5, // wraps through north; halfWidthDeg ≈ 72.5
    }) as Beach,
  );

  const selectiveSouthBeach = createSpotProfile(
    createBeach({
      swell_window_min_deg: 210,
      swell_window_max_deg: 250, // halfWidthDeg = 20
    }) as Beach,
  );

  it("rewards exposed beach on short-period W swell (270° @ 6s)", () => {
    const f = fx({
      wave_direction: "270",
      wave_period: "6s",
      swell_1_period: "6s",
    });
    expect(computeSetupSuitability(wideExposedBeach, f)).toBeGreaterThanOrEqual(75);
  });

  it("rewards wraparound-window beach on short-period W swell (270° @ 6s)", () => {
    const f = fx({
      wave_direction: "270",
      wave_period: "6s",
      swell_1_period: "6s",
    });
    // 270° must be inside a 220→5° wraparound window. If this fails, the
    // wraparound math is broken — surface as a pre-existing bug.
    expect(computeSetupSuitability(wraparoundBeach, f)).toBeGreaterThanOrEqual(70);
  });

  it("penalizes selective beach on the same short-period W swell", () => {
    const f = fx({
      wave_direction: "270",
      wave_period: "6s",
      swell_1_period: "6s",
    });
    // 270° is OUTSIDE 210-250 window
    expect(computeSetupSuitability(selectiveSouthBeach, f)).toBeLessThan(50);
  });

  it("rewards selective south beach on long-period SW (220° @ 14s)", () => {
    const f = fx({
      wave_direction: "220",
      wave_period: "14s",
      swell_1_period: "14s",
    });
    expect(computeSetupSuitability(selectiveSouthBeach, f)).toBeGreaterThanOrEqual(75);
  });
});
