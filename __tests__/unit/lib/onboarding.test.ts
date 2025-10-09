import { shouldShowOnboarding } from "@/lib/onboarding";

function params(search: string) {
  return new URLSearchParams(search);
}

describe("shouldShowOnboarding", () => {
  it("forces show when ?showTour=1", () => {
    expect(shouldShowOnboarding({ id: "u", onboarding_completed_at: "2025-01-01" }, params("showTour=1"))).toBe(true);
    expect(shouldShowOnboarding(null, params("showTour=1"))).toBe(true);
    expect(shouldShowOnboarding(undefined, params("showTour=1"))).toBe(true);
  });

  it("returns false while loading (profile undefined)", () => {
    expect(shouldShowOnboarding(undefined, undefined)).toBe(false);
    expect(shouldShowOnboarding(undefined, params(""))).toBe(false);
  });

  it("returns true when onboarding not completed", () => {
    expect(shouldShowOnboarding({ id: "u", onboarding_completed_at: null }, params(""))).toBe(true);
    expect(shouldShowOnboarding({ id: "u", onboarding_completed_at: null }, undefined)).toBe(true);
  });

  it("returns false when onboarding completed", () => {
    expect(shouldShowOnboarding({ id: "u", onboarding_completed_at: "2025-01-01T00:00:00Z" }, params(""))).toBe(false);
  });
});


