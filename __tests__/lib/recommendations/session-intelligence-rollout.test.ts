import {
  PHASE_18_SESSION_INTELLIGENCE_ALLOWLIST,
  canRenderBestSurfWindowsForSurface,
  getSessionIntelligenceSurfacePolicy,
  isPhase18BestTimePath,
  isPhase18SpotPath,
  isPhase18WaterTempPath,
  requiresPublicBasicAnswer,
} from "@/lib/recommendations/session-intelligence-rollout";

describe("Phase 18 Session Intelligence rollout policy", () => {
  it("allowlists the selected water-temp paths without enabling full surf-window cards", () => {
    expect(PHASE_18_SESSION_INTELLIGENCE_ALLOWLIST.waterTempCityPaths).toEqual([
      "/water-temp/huntington-beach",
      "/water-temp/santa-cruz",
      "/water-temp/santa-monica",
      "/water-temp/kailua-kona",
    ]);
    expect(PHASE_18_SESSION_INTELLIGENCE_ALLOWLIST.waterTempBeachPaths).toEqual([
      "/ca/del-mar/del-mar/water-temp",
      "/nj/long-branch/long-branch-long-branch-nj/water-temp",
    ]);

    for (const path of [
      ...PHASE_18_SESSION_INTELLIGENCE_ALLOWLIST.waterTempCityPaths,
      ...PHASE_18_SESSION_INTELLIGENCE_ALLOWLIST.waterTempBeachPaths,
    ]) {
      expect(isPhase18WaterTempPath(path)).toBe(true);
    }

    expect(isPhase18WaterTempPath("/water-temp/random-city")).toBe(false);
    expect(canRenderBestSurfWindowsForSurface("water-temp")).toBe(false);
  });

  it("allowlists Malibu and the Phase 17 pilot spot without making all spots eligible", () => {
    expect(isPhase18SpotPath("/ca/malibu/malibu-surfrider-first-point-malibu-ca")).toBe(true);
    expect(isPhase18SpotPath("/ca/san-diego/blacks")).toBe(true);
    expect(isPhase18SpotPath("/ca/la-jolla/blacks")).toBe(true);
    expect(isPhase18SpotPath("/ca/random/not-allowlisted")).toBe(false);
    expect(canRenderBestSurfWindowsForSurface("spot", "/ca/random/not-allowlisted")).toBe(false);
    expect(canRenderBestSurfWindowsForSurface("spot", "/ca/malibu/malibu-surfrider-first-point-malibu-ca")).toBe(true);
  });

  it("allowlists the best-time split pages as handoff surfaces", () => {
    expect(isPhase18BestTimePath("/best-time-to-surf/la-jolla")).toBe(true);
    expect(isPhase18BestTimePath("/best-time-to-surf/westport")).toBe(true);
    expect(isPhase18BestTimePath("/best-time-to-surf/cocoa-beach")).toBe(true);
    expect(isPhase18BestTimePath("/best-time-to-surf/unknown")).toBe(false);

    const policy = getSessionIntelligenceSurfacePolicy("best-time");
    expect(policy.handoffOnly).toBe(true);
    expect(policy.fullBestSurfWindows).toBe(false);
  });

  it("requires public basic answers for SEO-facing intent surfaces", () => {
    expect(requiresPublicBasicAnswer("generic-intent")).toBe(true);
    expect(requiresPublicBasicAnswer("beginner")).toBe(true);
    expect(requiresPublicBasicAnswer("tide")).toBe(true);
    expect(requiresPublicBasicAnswer("water-temp")).toBe(true);
    expect(requiresPublicBasicAnswer("spot")).toBe(true);
  });

  it("keeps utility pages handoff-only and source-light", () => {
    for (const surface of ["tide", "water-temp", "dawn-patrol", "sunset"] as const) {
      const policy = getSessionIntelligenceSurfacePolicy(surface);
      expect(policy.handoffOnly).toBe(true);
      expect(policy.fullBestSurfWindows).toBe(false);
      expect(policy.sourceHints).toEqual({});
    }
  });
});
