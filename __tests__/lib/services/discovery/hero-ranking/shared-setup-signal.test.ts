/**
 * Tests for `cardinalToDeg` and `deriveSharedSetupSignal`.
 *
 * Locks the cluster-wide selection rule:
 *  - longest period across cluster
 *  - tiebreak (within 0.5s): highest height
 *  - tiebreak (within 0.1ft): first encountered
 *  - source = "cluster-majority" when ≥2 recs see the chosen period (±1.0s)
 *  - prefer numeric _om direction siblings; fall back to cardinal mapping
 *  - empty / no-parseable returns the null fallback signal
 */
import {
  cardinalToDeg,
  deriveSharedSetupSignal,
} from "@/lib/services/discovery/hero-ranking/shared-setup-signal";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { SurfDiscoveryRecommendation } from "@/types/personalization";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeRec(forecast: Partial<EnhancedForecastEntity>): SurfDiscoveryRecommendation {
  return {
    forecast: forecast as EnhancedForecastEntity,
  } as unknown as SurfDiscoveryRecommendation;
}

// ---------------------------------------------------------------------------
// cardinalToDeg
// ---------------------------------------------------------------------------

describe("cardinalToDeg", () => {
  it("maps every 16-point cardinal to its expected degree", () => {
    const expected: Array<[string, number]> = [
      ["N", 0], ["NNE", 22.5], ["NE", 45], ["ENE", 67.5],
      ["E", 90], ["ESE", 112.5], ["SE", 135], ["SSE", 157.5],
      ["S", 180], ["SSW", 202.5], ["SW", 225], ["WSW", 247.5],
      ["W", 270], ["WNW", 292.5], ["NW", 315], ["NNW", 337.5],
    ];
    for (const [k, v] of expected) {
      expect(cardinalToDeg(k)).toBe(v);
    }
  });

  it("normalizes case and trims whitespace", () => {
    expect(cardinalToDeg("sw")).toBe(225);
    expect(cardinalToDeg("  SW  ")).toBe(225);
    expect(cardinalToDeg("WnW")).toBe(292.5);
  });

  it("returns null for unknown / empty / missing", () => {
    expect(cardinalToDeg("abc")).toBeNull();
    expect(cardinalToDeg("")).toBeNull();
    expect(cardinalToDeg("   ")).toBeNull();
    expect(cardinalToDeg(null)).toBeNull();
    expect(cardinalToDeg(undefined)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// deriveSharedSetupSignal
// ---------------------------------------------------------------------------

describe("deriveSharedSetupSignal", () => {
  it("returns the null fallback for empty cluster", () => {
    const sig = deriveSharedSetupSignal([]);
    expect(sig).toEqual({
      directionDeg: null,
      periodS: null,
      heightFt: null,
      source: "fallback",
    });
  });

  it("returns the null fallback when no rec has parseable swell", () => {
    const recs = [
      makeRec({}),
      makeRec({ swell_1_period: "abc", swell_1_direction: "??" }),
    ];
    const sig = deriveSharedSetupSignal(recs);
    expect(sig.periodS).toBeNull();
    expect(sig.directionDeg).toBeNull();
    expect(sig.source).toBe("fallback");
  });

  it("single-beach cluster picks that beach's swell_1", () => {
    const recs = [
      makeRec({
        swell_1_period: "10s",
        swell_1_direction: "270",
        swell_1_height: "3.0",
      }),
    ];
    const sig = deriveSharedSetupSignal(recs);
    expect(sig.periodS).toBe(10);
    expect(sig.directionDeg).toBe(270);
    expect(sig.heightFt).toBe(3.0);
    expect(sig.source).toBe("fallback"); // single contributor, not majority
  });

  it("unified cluster picks the shared swell as cluster-majority", () => {
    const recs = [
      makeRec({ swell_1_period: "13s", swell_1_direction: "225", swell_1_height: "2.0" }),
      makeRec({ swell_1_period: "13s", swell_1_direction: "225", swell_1_height: "2.0" }),
      makeRec({ swell_1_period: "13s", swell_1_direction: "225", swell_1_height: "2.0" }),
    ];
    const sig = deriveSharedSetupSignal(recs);
    expect(sig.periodS).toBe(13);
    expect(sig.directionDeg).toBe(225);
    expect(sig.source).toBe("cluster-majority");
  });

  it("divergent (today's case): OB sees 6s WNW only; PB/Crystal see 13s SW combo — picks 13s SW majority", () => {
    const recs = [
      // OB: only short-period WNW
      makeRec({
        swell_1_period: "6s",
        swell_1_direction: "292",
        swell_1_height: "1.4",
      }),
      // PB: 13s SW primary + 7s WNW secondary
      makeRec({
        swell_1_period: "13s",
        swell_1_direction: "225",
        swell_1_height: "2.0",
        swell_2_period: "7s",
        swell_2_direction: "292",
        swell_2_height: "1.0",
      }),
      // Crystal: same as PB
      makeRec({
        swell_1_period: "13s",
        swell_1_direction: "225",
        swell_1_height: "2.0",
        swell_2_period: "7s",
        swell_2_direction: "292",
        swell_2_height: "1.0",
      }),
    ];
    const sig = deriveSharedSetupSignal(recs);
    expect(sig.periodS).toBe(13);
    expect(sig.directionDeg).toBe(225);
    expect(sig.source).toBe("cluster-majority"); // PB + Crystal both contribute
  });

  it("outlier divergence (only 1 beach sees the long period) uses fallback source", () => {
    const recs = [
      makeRec({ swell_1_period: "13s", swell_1_direction: "225", swell_1_height: "2.0" }),
      makeRec({ swell_1_period: "6s", swell_1_direction: "270", swell_1_height: "1.5" }),
      makeRec({ swell_1_period: "6s", swell_1_direction: "270", swell_1_height: "1.5" }),
    ];
    const sig = deriveSharedSetupSignal(recs);
    expect(sig.periodS).toBe(13);
    expect(sig.directionDeg).toBe(225);
    expect(sig.source).toBe("fallback");
  });

  it("prefers numeric _om sibling when both string and _om are present", () => {
    const recs = [
      makeRec({
        swell_1_period: "13s",
        // string says SW (225) but _om says 230 — should win
        swell_1_direction: "SW",
        swell_direction_om: 230,
        swell_1_height: "2.0",
      }),
      makeRec({
        swell_1_period: "13s",
        swell_1_direction: "SW",
        swell_direction_om: 230,
        swell_1_height: "2.0",
      }),
    ];
    const sig = deriveSharedSetupSignal(recs);
    expect(sig.directionDeg).toBe(230);
  });

  it("falls back to cardinal mapping when _om is absent", () => {
    const recs = [
      makeRec({
        swell_1_period: "13s",
        swell_1_direction: "SW",
        swell_1_height: "2.0",
      }),
      makeRec({
        swell_1_period: "13s",
        swell_1_direction: "SW",
        swell_1_height: "2.0",
      }),
    ];
    const sig = deriveSharedSetupSignal(recs);
    expect(sig.directionDeg).toBe(225);
    expect(sig.periodS).toBe(13);
  });

  it("height tiebreaker: equal periods, picks the higher height", () => {
    const recs = [
      makeRec({
        swell_1_period: "12s",
        swell_1_direction: "225",
        swell_1_height: "2.0",
      }),
      makeRec({
        swell_1_period: "12s",
        swell_1_direction: "200",
        swell_1_height: "3.5", // larger swell at same period
      }),
    ];
    const sig = deriveSharedSetupSignal(recs);
    expect(sig.heightFt).toBe(3.5);
    expect(sig.directionDeg).toBe(200);
  });

  it("first-encountered tiebreaker when period AND height are within tolerance", () => {
    const recs = [
      makeRec({
        swell_1_period: "12s",
        swell_1_direction: "225",
        swell_1_height: "2.0",
      }),
      makeRec({
        swell_1_period: "12s",
        swell_1_direction: "230",
        // within 0.1ft tolerance — first encountered should still win
        swell_1_height: "2.05",
      }),
    ];
    const sig = deriveSharedSetupSignal(recs);
    expect(sig.directionDeg).toBe(225);
  });

  it("falls back to wave_* fields when swell_1/2 are missing", () => {
    const recs = [
      makeRec({
        wave_period: "9s",
        wave_direction: "270",
        wave_height: "2.5",
      }),
      makeRec({
        wave_period: "9s",
        wave_direction: "270",
        wave_height: "2.5",
      }),
    ];
    const sig = deriveSharedSetupSignal(recs);
    expect(sig.periodS).toBe(9);
    expect(sig.directionDeg).toBe(270);
    expect(sig.source).toBe("cluster-majority");
  });

  it("ignores swell_2 background within a rec — picks the primary swell_1 across the cluster", () => {
    // A small long-period SW BACKGROUND behind a short-period W primary must
    // NOT hijack the shared signal. This locks the fixture-#4 behavior: a
    // 1ft 12s SW behind a 3ft 7s W stays "7s W shared signal".
    const recs = [
      makeRec({
        swell_1_period: "7s",
        swell_1_direction: "270",
        swell_1_height: "3.0",
        swell_2_period: "12s",
        swell_2_direction: "200",
        swell_2_height: "1.0",
      }),
      makeRec({
        swell_1_period: "7s",
        swell_1_direction: "270",
        swell_1_height: "3.0",
        swell_2_period: "12s",
        swell_2_direction: "200",
        swell_2_height: "1.0",
      }),
    ];
    const sig = deriveSharedSetupSignal(recs);
    expect(sig.periodS).toBe(7);
    expect(sig.directionDeg).toBe(270);
    expect(sig.source).toBe("cluster-majority");
  });

  it("majority window respects ±1.0s tolerance (12.6s and 13.2s count as same)", () => {
    const recs = [
      makeRec({
        swell_1_period: "13.2s",
        swell_1_direction: "225",
        swell_1_height: "2.0",
      }),
      makeRec({
        swell_1_period: "12.6s",
        swell_1_direction: "225",
        swell_1_height: "2.0",
      }),
    ];
    const sig = deriveSharedSetupSignal(recs);
    expect(sig.source).toBe("cluster-majority");
  });
});
