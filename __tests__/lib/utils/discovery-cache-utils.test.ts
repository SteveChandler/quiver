import {
  CACHE_KEY_PREFIX,
  clearDiscoveryRecommendationCache,
  hashDiscoveryOptions,
} from "@/lib/utils/discovery-cache-utils";

describe("discovery-cache-utils", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("keeps option hashes stable and distinguishes safety-relevant inputs", () => {
    const base = hashDiscoveryOptions({
      userLocation: { lat: 32.715, lon: -117.161 },
      timeSlot: "any",
      userSkillLevel: "beginner",
    });

    expect(
      hashDiscoveryOptions({
        userLocation: { lat: 32.715, lon: -117.161 },
        timeSlot: "any",
        userSkillLevel: "beginner",
      }),
    ).toBe(base);
    expect(
      hashDiscoveryOptions({
        userLocation: { lat: 32.715, lon: -117.161 },
        timeSlot: "afternoon",
        userSkillLevel: "beginner",
      }),
    ).not.toBe(base);
    expect(
      hashDiscoveryOptions({
        userLocation: { lat: 32.715, lon: -117.161 },
        timeSlot: "any",
        userSkillLevel: "intermediate",
      }),
    ).not.toBe(base);
  });

  it("removes every legacy recommendation entry without touching other caches", () => {
    window.localStorage.setItem(`${CACHE_KEY_PREFIX}user-one`, "positive");
    window.localStorage.setItem(`${CACHE_KEY_PREFIX}user-two`, "positive");
    window.localStorage.setItem("quiver_forecast_objective", "6 ft");
    window.localStorage.setItem("quiver_profile_cache_user", "profile");

    clearDiscoveryRecommendationCache();

    expect(window.localStorage.getItem(`${CACHE_KEY_PREFIX}user-one`)).toBeNull();
    expect(window.localStorage.getItem(`${CACHE_KEY_PREFIX}user-two`)).toBeNull();
    expect(window.localStorage.getItem("quiver_forecast_objective")).toBe("6 ft");
    expect(window.localStorage.getItem("quiver_profile_cache_user")).toBe(
      "profile",
    );
  });
});
