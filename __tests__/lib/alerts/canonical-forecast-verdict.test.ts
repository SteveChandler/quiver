/**
 * @jest-environment node
 */

import snapshot from "@/__tests__/fixtures/grandview-crossing-swells-20260911.json";
import { evaluateForecastVerdict } from "@/lib/alerts/canonical-forecast-verdict";
import { buildCanonicalSessionDecision } from "@/lib/recommendations/canonical-decision";
import { getRecommendationLabel } from "@/lib/services/discovery/response-formatter";
import { scoreWindowConditionScore } from "@/lib/services/discovery/window-selector";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";

const NOW = new Date("2026-09-11T13:00:00.000Z");
const TIMEZONE = "America/Los_Angeles";
const beach = snapshot.beach as unknown as Beach;
const crossing = snapshot.forecast as EnhancedForecastEntity;
const clean: EnhancedForecastEntity = {
  ...crossing,
  swell_2_direction: crossing.swell_1_direction,
};
const overhead: EnhancedForecastEntity = {
  ...clean,
  id: "overhead",
  wave_height: "7-9 ft",
};
const headHigh: EnhancedForecastEntity = {
  ...clean,
  id: "head-high",
  wave_height: "4.5 ft",
};
const flat: EnhancedForecastEntity = {
  ...clean,
  id: "flat",
  wave_height: "0.5 ft",
  wave_period: "6s",
  swell_1_height: "0.4 ft",
  swell_1_period: "6s",
};

// The daily call's evaluateForecast before the extraction, verbatim.
function legacyDailyCallEvaluation(
  forecast: EnhancedForecastEntity,
  experienceLevel: string | null,
) {
  const score = scoreWindowConditionScore(forecast, beach, experienceLevel);
  const start = new Date(forecast.forecast_at);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const decision = buildCanonicalSessionDecision({
    anchorTime: NOW.toISOString(),
    scope: {
      kind: "plan_next_session",
      windowStart: start.toISOString(),
      windowEnd: end.toISOString(),
      timezone: TIMEZONE,
    },
    profileExperience: experienceLevel,
    recommendationAvailability: {
      state: "available",
      holdEpoch: "daily-call",
      resolutionAsOf: NOW.toISOString(),
    },
    candidates: [{
      candidateId: `daily-call:${beach.id}:${forecast.forecast_at}`,
      beachId: beach.id,
      beachName: beach.name,
      beachSkillLevel: beach.skill_level,
      windowStart: start.toISOString(),
      windowEnd: end.toISOString(),
      timezone: TIMEZONE,
      forecastId: forecast.id,
      forecastAt: forecast.forecast_at,
      waveHeight: forecast.wave_height,
      utilityScore: score,
      recommendationLabel: getRecommendationLabel(score),
    }],
  });
  return { forecast, score, verdict: decision.verdict, decision };
}

function evaluate(
  forecast: EnhancedForecastEntity,
  experienceLevel: string | null,
  candidateIdPrefix = "daily-call",
) {
  return evaluateForecastVerdict({
    forecast,
    beach,
    experienceLevel,
    timezone: TIMEZONE,
    now: NOW,
    candidateIdPrefix,
  });
}

describe("evaluateForecastVerdict", () => {
  it.each([
    ["clean swell, intermediate", clean, "intermediate", "go"],
    ["crossing swells, intermediate", crossing, "intermediate", "maybe"],
    ["overhead for an intermediate", overhead, "intermediate", "no"],
    ["flat", flat, "advanced", "no"],
    ["clean swell, unknown skill", clean, null, "go"],
    ["head high, unknown skill", headHigh, null, "no"],
  ] as const)("matches the daily call's previous evaluation: %s", (_label, forecast, skill, verdict) => {
    const result = evaluate(forecast, skill);

    expect(result).toEqual(legacyDailyCallEvaluation(forecast, skill));
    expect(result.verdict).toBe(verdict);
  });

  it("vetoes a swell above the beginner range for an unknown skill even though its score clears 70", () => {
    const result = evaluate(headHigh, null);

    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.verdict).toBe("no");
    expect(result.decision.reasonCode).toBe("wave_height_exceeds_skill");
  });

  it("changes only the candidate and hold identity with the prefix", () => {
    const daily = evaluate(clean, "intermediate");
    const swell = evaluate(clean, "intermediate", "swell-alert");

    expect(swell.score).toBe(daily.score);
    expect(swell.verdict).toBe(daily.verdict);
    expect(swell.decision.selection?.candidateId).toBe(
      `swell-alert:${beach.id}:${clean.forecast_at}`,
    );
    expect(swell.decision.holdEpoch).toBe("swell-alert");
    expect(daily.decision.holdEpoch).toBe("daily-call");
    expect(swell.decision.decisionId).not.toBe(daily.decision.decisionId);
  });
});
