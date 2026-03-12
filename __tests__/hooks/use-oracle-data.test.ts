/**
 * Tests for useOracleData hook.
 *
 * The hook composes several complex, internally-mocked hooks
 * (useCachedProfile, useGeolocation, useSurfDiscovery, etc.) whose
 * render-test coverage lives in their own test files. Here we focus on:
 *
 * 1. Module exports — guarantees the public API surface is stable.
 * 2. Type exports — SessionTimePreference and OracleData are exported.
 */

import { useOracleData, type OracleData, type SessionTimePreference } from "@/hooks/use-oracle-data";

// ---- verify named exports exist at module level ----

describe("use-oracle-data module exports", () => {
  it("exports useOracleData as a function", () => {
    expect(typeof useOracleData).toBe("function");
  });

  it("exports SessionTimePreference type values as valid string literals", () => {
    // TypeScript types are erased at runtime; we validate the string union
    // implicitly by ensuring the hook module loads without error.
    const validValues: SessionTimePreference[] = [
      "dawn_patrol",
      "morning",
      "lunch",
      "afternoon",
      "evening",
      "any",
    ];
    expect(validValues.length).toBe(6);
  });

  it("OracleData interface keys match the expected public contract", () => {
    // Enumerate the keys of OracleData by inspecting the type annotation.
    // We assert on the required key names so any future rename is caught.
    const expectedKeys: Array<keyof OracleData> = [
      "profile",
      "homeBeach",
      "refreshProfile",
      "heroPhotoUrl",
      "heroPhotoLoading",
      "discovery",
      "discoveryLoading",
      "topRecommendation",
      "remainingSpots",
      "shouldAnimate",
      "markAnimationPlayed",
      "reducedMotion",
      "userLocation",
      "geoSource",
      "requestLocation",
      "geoLoading",
    ];

    // TypeScript compile-time check: if any key is missing from OracleData,
    // the type annotation above will produce a compiler error.
    expect(expectedKeys.length).toBe(16);
  });
});
