import type { Beach } from "@/types/database";
import {
  evaluateBeachEditorialIntegrity,
  sanitizeBeachEditorialContent,
} from "@/lib/seo/editorial-integrity";
import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";

function beach(overrides: Record<string, unknown> = {}): Beach {
  return {
    id: "beach-1",
    name: "Oceanside Harbor",
    city: "Oceanside",
    state: "CA",
    description: "A local break near the Siuslaw River with shifting sandbars.",
    wave_tips: "Look for the river mouth on a lower tide.",
    crowd_tips: "Arrive early.",
    best_conditions_prose: "Works best on a clean southwest swell.",
    ...overrides,
  } as Beach;
}

describe("editorial integrity", () => {
  it("quarantines a location reference that conflicts with the beach state", () => {
    expect(evaluateBeachEditorialIntegrity(beach())).toEqual({
      quarantined: true,
      reasons: ["location-reference:Siuslaw River"],
    });
  });

  it("removes questionable editorial fields while preserving forecast identity", () => {
    const sanitized = sanitizeBeachEditorialContent(beach());

    expect(sanitized).toMatchObject({
      id: "beach-1",
      name: "Oceanside Harbor",
      city: "Oceanside",
      state: "CA",
      description: null,
      wave_tips: null,
      crowd_tips: null,
      best_conditions_prose: null,
    });
    expectConsoleWarnings([/Editorial content quarantined/]);
  });

  it("leaves compatible local copy untouched", () => {
    const oregonBeach = beach({ city: "Florence", state: "OR" });
    expect(evaluateBeachEditorialIntegrity(oregonBeach)).toEqual({
      quarantined: false,
      reasons: [],
    });
    expect(sanitizeBeachEditorialContent(oregonBeach)).toBe(oregonBeach);
  });
});
