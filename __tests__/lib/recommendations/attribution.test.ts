import {
  buildRecommendationImpressionInput,
  buildRecommendationLogUrl,
} from "@/lib/recommendations/attribution";
import type { SurfDiscoveryRecommendation } from "@/types/personalization";

const makeRecommendation = (): SurfDiscoveryRecommendation =>
  ({
    recommendationId: "beach:123:2026-07-08T15:00:00.000Z",
    kind: "beach",
    beach: {
      id: "8f7b6110-0b6f-4ba0-8ec7-59f45ce1b7ac",
      name: "Ocean Beach",
    },
    forecast: {
      forecast_at: "2026-07-08T15:00:00.000Z",
    },
    window: {
      start: new Date("2026-07-08T15:00:00.000Z"),
      end: new Date("2026-07-08T17:00:00.000Z"),
    },
    score: 82,
  }) as SurfDiscoveryRecommendation;

describe("recommendation attribution", () => {
  it("keeps known time slots on impression inputs", () => {
    const input = buildRecommendationImpressionInput({
      recommendation: makeRecommendation(),
      rank: 1,
      surface: "home_hero",
      timeSlot: "morning",
    });

    expect(input.timeSlot).toBe("morning");
  });

  it("omits unknown time slots from impression inputs", () => {
    const input = buildRecommendationImpressionInput({
      recommendation: makeRecommendation(),
      rank: 1,
      surface: "home_hero",
      timeSlot: "after-dark",
    });

    expect(input.timeSlot).toBeUndefined();
  });

  it("normalizes null time slots on impression inputs", () => {
    const input = buildRecommendationImpressionInput({
      recommendation: makeRecommendation(),
      rank: 1,
      surface: "home_hero",
      timeSlot: null,
    });

    expect(input.timeSlot).toBeUndefined();
  });

  it("preserves provided time slots on log URLs", () => {
    const url = buildRecommendationLogUrl({
      recommendation: makeRecommendation(),
      rank: 1,
      surface: "home_hero",
      timeSlot: "after-dark",
    });

    expect(url).toContain("recommendation_time_slot=after-dark");
  });
});
