/**
 * Tests for `computeSetupSuitability` — hero-only post-process factor.
 *
 * Foundation: reuses `calculateWindowAlignment` (wraparound-safe). Adds a
 * hard ≤8s exposure-vs-selectivity dimension that the engine doesn't have.
 *
 * Task 8: input shape changed from per-beach forecast to a cluster-shared
 * `SharedSetupSignal`. Test outcomes are unchanged — only the input is.
 */

import { computeSetupSuitability } from "@/lib/services/discovery/hero-ranking/setup-suitability";
import type { SharedSetupSignal } from "@/lib/services/discovery/hero-ranking/shared-setup-signal";
import { createSpotProfile } from "@/lib/domains/spot-profile/spot-profile";
import { createBeach } from "@/__tests__/lib/domains/__fixtures__";
import type { Beach } from "@/types/database";

function signal(overrides: Partial<SharedSetupSignal>): SharedSetupSignal {
  return {
    directionDeg: null,
    periodS: null,
    heightFt: null,
    source: "cluster-majority",
    ...overrides,
  };
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
    const s = signal({ directionDeg: 270, periodS: 6, heightFt: 3 });
    expect(computeSetupSuitability(wideExposedBeach, s)).toBeGreaterThanOrEqual(75);
  });

  it("rewards wraparound-window beach on short-period W swell (270° @ 6s)", () => {
    const s = signal({ directionDeg: 270, periodS: 6, heightFt: 3 });
    // 270° must be inside a 220→5° wraparound window. If this fails, the
    // wraparound math is broken — surface as a pre-existing bug.
    expect(computeSetupSuitability(wraparoundBeach, s)).toBeGreaterThanOrEqual(70);
  });

  it("penalizes selective beach on the same short-period W swell", () => {
    const s = signal({ directionDeg: 270, periodS: 6, heightFt: 3 });
    // 270° is OUTSIDE 210-250 window
    expect(computeSetupSuitability(selectiveSouthBeach, s)).toBeLessThan(50);
  });

  it("rewards selective south beach on long-period SW (220° @ 14s)", () => {
    const s = signal({ directionDeg: 220, periodS: 14, heightFt: 4 });
    expect(computeSetupSuitability(selectiveSouthBeach, s)).toBeGreaterThanOrEqual(75);
  });
});
