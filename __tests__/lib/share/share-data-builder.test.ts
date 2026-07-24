import { buildSurfCallShareData } from "@/lib/share/share-data-builder";
import type { CanonicalSessionDecision } from "@/lib/recommendations/canonical-decision";
import type { SurfDiscoveryRecommendation } from "@/types/personalization";

jest.mock("@/lib/utils/date-time", () => ({
  formatTimeWindowCompact: () => "7-10am",
}));

const NOW = new Date("2026-07-22T18:00:00.000Z");

function recommendation(
  overrides: Partial<SurfDiscoveryRecommendation> = {},
): SurfDiscoveryRecommendation {
  return {
    recommendationId: "recommendation-1",
    beach: {
      id: "test-beach-id",
      name: "Big Jetty",
      slug: "big-jetty",
      timezone: "America/Los_Angeles",
    },
    score: 85,
    window: {
      start: new Date("2026-07-23T14:00:00.000Z"),
      end: new Date("2026-07-23T17:00:00.000Z"),
      timezone: "America/Los_Angeles",
    },
    matchQuality: "high",
    recommendationLabel: "Worth it",
    message: "Good wave size",
    conditionBadges: [
      { label: "Clean Swell", contribution: 10 },
      { label: "Light Offshore", contribution: 8 },
    ],
    waveHeightBadge: "3-5ft",
    ...overrides,
  } as SurfDiscoveryRecommendation;
}

function sessionDecision(
  verdict: "go" | "maybe" | "no" = "go",
  overrides: Partial<CanonicalSessionDecision> = {},
): CanonicalSessionDecision {
  return {
    schemaVersion: "canonical-session-decision.v1",
    engineVersion: "rules.v1",
    decisionId: "c".repeat(64),
    createdAt: NOW.toISOString(),
    expiresAt: "2026-07-22T18:15:00.000Z",
    scope: {
      kind: "plan_next_session",
      windowStart: NOW.toISOString(),
      windowEnd: "2026-07-23T18:00:00.000Z",
      timezone: "America/Los_Angeles",
    },
    verdict,
    decisionBasis:
      verdict === "no" ? "safety_override" : "physical_fallback",
    reasonCode:
      verdict === "go"
        ? "selected_go"
        : verdict === "maybe"
          ? "selected_maybe"
          : "below_minimum_utility",
    selection: verdict === "no" ? null : {
      candidateId: "recommendation-1",
      beachId: "test-beach-id",
      beachName: "Big Jetty",
      windowStart: "2026-07-23T14:00:00.000Z",
      windowEnd: "2026-07-23T17:00:00.000Z",
      timezone: "America/Los_Angeles",
      forecastRef: {
        forecastId: "forecast-1",
        beachId: "test-beach-id",
        forecastAt: "2026-07-23T14:00:00.000Z",
      },
      skillEligibility: {
        skill: "intermediate",
        state: "eligible",
        reasonCodes: [],
      },
      evidence: {
        conditionScore: 85,
        recommendationLabel: "Worth it",
        personalMatch: null,
      },
    },
    skillEligibility: {
      skill: "intermediate",
      state: verdict === "no" ? "ineligible" : "eligible",
      reasonCodes: [],
    },
    holdEpoch: "hold-epoch-1",
    ...overrides,
  };
}

describe("buildSurfCallShareData", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("builds a share from the exact canonical go selection", () => {
    const result = buildSurfCallShareData({
      recommendation: recommendation(),
      sessionDecision: sessionDecision(),
    });

    expect(result).toMatchObject({
      beachName: "Big Jetty",
      title: "Surf Big Jetty",
      text: "Go: Big Jetty, 7-10am",
    });
    expect(result?.imageUrl).toContain("verdict=YES");
    expect(result?.imageUrl).toContain("waveHeight=3-5ft");
    expect(result?.imageUrl).not.toContain("score=");
  });

  it("uses maybe from the decision even when the legacy score is high", () => {
    const result = buildSurfCallShareData({
      recommendation: recommendation({ score: 99 }),
      sessionDecision: sessionDecision("maybe"),
    });

    expect(result?.imageUrl).toContain("verdict=MAYBE");
    expect(result?.text).toBe("Consider: Big Jetty, 7-10am");
  });

  it("returns null for an explicit no decision", () => {
    expect(buildSurfCallShareData({
      recommendation: recommendation(),
      sessionDecision: sessionDecision("no"),
    })).toBeNull();
  });

  it("returns null when the recommendation does not match the selected candidate", () => {
    expect(buildSurfCallShareData({
      recommendation: recommendation({ recommendationId: "other" }),
      sessionDecision: sessionDecision(),
    })).toBeNull();
  });

  it("returns null when the selected beach does not match", () => {
    expect(buildSurfCallShareData({
      recommendation: recommendation(),
      sessionDecision: sessionDecision("go", {
        selection: {
          ...sessionDecision().selection!,
          beachId: "other-beach",
        },
      }),
    })).toBeNull();
  });

  it("returns null when the canonical decision is missing", () => {
    expect(buildSurfCallShareData({
      recommendation: recommendation(),
      sessionDecision: null,
    })).toBeNull();
  });

  it("returns null after the canonical decision expires", () => {
    jest.setSystemTime(new Date("2026-07-22T18:16:00.000Z"));

    expect(buildSurfCallShareData({
      recommendation: recommendation(),
      sessionDecision: sessionDecision(),
    })).toBeNull();
  });

  it("preserves physical context without exposing the internal score", () => {
    const result = buildSurfCallShareData({
      recommendation: recommendation({
        waveHeightBadge: "4-6ft",
        message: "Long-period swell",
      }),
      sessionDecision: sessionDecision(),
    });

    expect(result?.imageUrl).toContain("waveHeight=4-6ft");
    expect(result?.imageUrl).toContain("message=Long-period");
    expect(result?.text).not.toMatch(/\d+(?:\.\d+)?\/10/);
  });
});
