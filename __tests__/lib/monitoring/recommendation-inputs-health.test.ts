/**
 * @jest-environment node
 */

import {
  checkRecommendationInputsHealth,
  type RecommendationInputsReads,
} from "@/lib/monitoring/recommendation-inputs-health";

const NOW = new Date("2026-10-02T14:00:00.000Z");
const minutesAgo = (minutes: number): string => new Date(NOW.getTime() - minutes * 60_000).toISOString();

function reads(overrides: Partial<RecommendationInputsReads> = {}): RecommendationInputsReads {
  return {
    latestCountyRunAt: async () => minutesAgo(20),
    latestCanaryRun: async () => ({ startedAt: minutesAgo(15), status: "ok" }),
    sessionsAwaitingConditions: async () => 0,
    ...overrides,
  };
}

describe("checkRecommendationInputsHealth", () => {
  it("is healthy when the County feed, canary and session conditions are current", async () => {
    const result = await checkRecommendationInputsHealth(reads(), NOW);

    expect(result).toMatchObject({ status: "healthy", issues: [] });
  });

  // 2026-10-02: the County snapshot went stale at 02:30 UTC and nothing noticed.
  it("is critical once the County feed is past the two-hour staleness limit", async () => {
    const result = await checkRecommendationInputsHealth(reads({ latestCountyRunAt: async () => minutesAgo(125) }), NOW);

    expect(result.status).toBe("critical");
    expect(result.issues).toEqual([
      "County water-quality data is 125 min old; San Diego County picks are withheld past 120 min",
    ]);
  });

  it("is degraded when the County feed has missed a run", async () => {
    const result = await checkRecommendationInputsHealth(reads({ latestCountyRunAt: async () => minutesAgo(75) }), NOW);

    expect(result.status).toBe("degraded");
  });

  it("is critical when the latest Week Scout canary failed", async () => {
    const result = await checkRecommendationInputsHealth(
      reads({ latestCanaryRun: async () => ({ startedAt: minutesAgo(10), status: "error" }) }),
      NOW,
    );

    expect(result.status).toBe("critical");
    expect(result.issues).toEqual(["The Week Scout canary failed its latest run"]);
  });

  it("is degraded when the canary has not run for over an hour", async () => {
    const result = await checkRecommendationInputsHealth(
      reads({ latestCanaryRun: async () => ({ startedAt: minutesAgo(90), status: "ok" }) }),
      NOW,
    );

    expect(result.status).toBe("degraded");
    expect(result.issues).toEqual(["The Week Scout canary has not run for 90 min"]);
  });

  it("is degraded when logged sessions are still waiting for conditions", async () => {
    const result = await checkRecommendationInputsHealth(reads({ sessionsAwaitingConditions: async () => 3 }), NOW);

    expect(result.status).toBe("degraded");
    expect(result.issues).toEqual(["3 logged sessions are still waiting for conditions 3 h after paddle-out"]);
  });

  it("reports an unreadable input as degraded instead of throwing", async () => {
    const result = await checkRecommendationInputsHealth(
      reads({ latestCountyRunAt: async () => { throw new Error("private db error"); } }),
      NOW,
    );

    expect(result.status).toBe("degraded");
    expect(result.issues).toEqual(["County water-quality freshness could not be read"]);
    expect(JSON.stringify(result)).not.toContain("private");
  });
});
