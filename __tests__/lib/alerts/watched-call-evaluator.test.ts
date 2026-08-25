import {
  evaluateWatchedCall,
  type WatchedCallEvaluationInput,
} from "@/lib/alerts/watched-call-evaluator";

const NOW = new Date("2026-08-25T12:00:00.000Z");

const base: WatchedCallEvaluationInput = {
  alertRule: { id: "rule-1", beach_id: "beach-1" },
  watched: {
    recommendationId: "recommendation-1",
    beachId: "beach-1",
    windowStart: "2026-08-25T14:00:00.000Z",
    windowEnd: "2026-08-25T16:00:00.000Z",
    forecastAt: "2026-08-25T10:00:00.000Z",
    recommendationState: "ready_today",
    conditionScore: 82,
    personalMatchScore: 76,
    overallScore: 80,
    reasonType: "forecast_conditions",
  },
  localDate: "2026-08-25",
  generatedAt: "2026-08-25T12:00:00.000Z",
  scorerVersion: "canonical-v1",
  candidateFingerprint: "beach-1",
  requestFingerprint: "watch-1",
  bestWindowId: "recommendation-1",
  windows: [
    {
      id: "recommendation-1",
      bucket: "morning",
      start: "2026-08-25T14:00:00.000Z",
      end: "2026-08-25T16:00:00.000Z",
      peakTime: "2026-08-25T15:00:00.000Z",
      beachId: "beach-1",
      rankingScore: 81,
      verdict: "worth_it",
      rideable: true,
      safe: true,
    },
  ],
  now: NOW,
  alreadyResponded: false,
  lastStillOnAt: null,
};

describe("evaluateWatchedCall", () => {
  it("suppresses a minor revision outside the still-on window and keeps the watch active", () => {
    expect(evaluateWatchedCall({
      ...base,
      now: new Date("2026-08-24T12:00:00.000Z"),
    })).toMatchObject({
      delivery: "suppressed",
      reason: "no_meaningful_change",
      keepWatchActive: true,
    });
  });

  it("emits still_on only near the watched window", () => {
    expect(evaluateWatchedCall(base)).toMatchObject({
      delivery: "eligible",
      category: "still_on",
      update: { type: "still_on", cause: "forecast_refreshed" },
    });
  });

  it("uses canonical stability materiality for a same-beach call change", () => {
    const replacement = {
      ...base.windows[0],
      id: "recommendation-2",
      start: "2026-08-25T17:00:00.000Z",
      end: "2026-08-25T19:00:00.000Z",
      peakTime: "2026-08-25T18:00:00.000Z",
      rankingScore: 95,
    };
    expect(evaluateWatchedCall({
      ...base,
      bestWindowId: replacement.id,
      windows: [{ ...base.windows[0], rankingScore: 80 }, replacement],
    })).toMatchObject({
      delivery: "eligible",
      category: "call_changed",
      update: {
        type: "call_changed",
        cause: "forecast_materially_changed",
        materiality: { status: "replaced", reason: "challenger_margin" },
      },
    });
  });

  it("emits better_nearby only for a viable, materially stronger comparable call", () => {
    expect(evaluateWatchedCall({
      ...base,
      nearbyRecommendation: {
        ...base.watched,
        recommendationId: "nearby-1",
        beachId: "beach-2",
        overallScore: 92,
      },
    })).toMatchObject({
      delivery: "eligible",
      category: "better_nearby",
      update: { type: "better_nearby", cause: "stronger_nearby_candidate" },
    });
  });

  it("emits post_window once after the watched window passes", () => {
    expect(evaluateWatchedCall({
      ...base,
      now: new Date("2026-08-25T16:01:00.000Z"),
      windows: [],
      bestWindowId: null,
    })).toMatchObject({
      delivery: "eligible",
      category: "post_window",
    });
  });

  it("suppresses post_window after the user already responded", () => {
    expect(evaluateWatchedCall({
      ...base,
      now: new Date("2026-08-25T16:01:00.000Z"),
      alreadyResponded: true,
      windows: [],
      bestWindowId: null,
    })).toMatchObject({
      delivery: "suppressed",
      reason: "already_responded",
      keepWatchActive: false,
    });
  });
});
