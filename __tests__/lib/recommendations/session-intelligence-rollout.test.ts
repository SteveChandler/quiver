import { getSessionIntelligenceSurfacePolicy, isPhase18BestTimePath } from "@/lib/recommendations/session-intelligence-rollout";

describe("Phase 18 Session Intelligence rollout policy", () => {

  it("allowlists the best-time split pages as handoff surfaces", () => {
    expect(isPhase18BestTimePath("/best-time-to-surf/la-jolla")).toBe(true);
    expect(isPhase18BestTimePath("/best-time-to-surf/westport")).toBe(true);
    expect(isPhase18BestTimePath("/best-time-to-surf/cocoa-beach")).toBe(true);
    expect(isPhase18BestTimePath("/best-time-to-surf/unknown")).toBe(false);

    const policy = getSessionIntelligenceSurfacePolicy("best-time");
    expect(policy.handoffOnly).toBe(true);
    expect(policy.fullBestSurfWindows).toBe(false);
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
