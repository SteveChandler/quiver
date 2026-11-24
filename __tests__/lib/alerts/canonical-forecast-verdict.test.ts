/**
 * @jest-environment node
 */

import snapshot from "@/__tests__/fixtures/grandview-crossing-swells-20260911.json";
import { evaluateForecastVerdict } from "@/lib/alerts/canonical-forecast-verdict";
import { buildCanonicalSessionDecision } from "@/lib/recommendations/canonical-decision";
import { resolveRecommendationLabel } from "@/lib/services/discovery/recommendation-label";
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

describe("evaluateForecastVerdict with go checks", () => {
  const beach: Beach = { ...(snapshot.beach as unknown as Beach), skill_level: "beginner" };
  const base = { timezone: TIMEZONE, now: NOW, candidateIdPrefix: "daily-call" };
  const rowAt = (
    id: string,
    ft: string,
    s: string,
    mph: string,
    deg: number,
  ): EnhancedForecastEntity => ({
    ...clean,
    id,
    wave_height: `${ft} ft`,
    wave_period: `${s}s`,
    swell_1_height: `${ft} ft`,
    swell_1_period: `${s}s`,
    swell_2_height: null,
    swell_2_period: null,
    swell_2_direction: null,
    wind_wave_height: null,
    wind_wave_period: null,
    wind_wave_direction: null,
    wind_speed: `${mph} mph`,
    wind_direction_deg: deg,
  });
  const cleanAt = (ft: string, s: string): EnhancedForecastEntity =>
    rowAt(`clean-${ft}-${s}`, ft, s, "3", 45);
  const mixed3 = rowAt("mixed3", "3", "9", "3", 45);

  it("keeps today's score with no boards and adds no key without goChecks", () => {
    const today = evaluateForecastVerdict({
      ...base,
      forecast: clean,
      beach,
      experienceLevel: "intermediate",
    });
    const checked = evaluateForecastVerdict({
      ...base,
      forecast: clean,
      beach,
      experienceLevel: "intermediate",
      goChecks: { boardClasses: [] },
    });

    expect(checked.score).toBe(today.score);
    expect(Object.keys(today).sort()).toEqual(["decision", "forecast", "score", "verdict"]);
  });

  it("scores a clean 1 ft row higher with a longboard", () => {
    const forecast = cleanAt("1", "11");
    const noBoard = evaluateForecastVerdict({
      ...base,
      forecast,
      beach,
      experienceLevel: "beginner",
      goChecks: { boardClasses: [] },
    });
    const longboard = evaluateForecastVerdict({
      ...base,
      forecast,
      beach,
      experienceLevel: "beginner",
      goChecks: { boardClasses: ["longboard"] },
    });

    expect(longboard.score).toBeGreaterThan(noBoard.score);
    expect(longboard.boardClass).toBe("longboard");
    expect(noBoard.boardClass).toBeNull();
  });

  it("never lets a board pass the beginner 4 ft cap", () => {
    const result = evaluateForecastVerdict({
      ...base,
      forecast: headHigh,
      beach,
      experienceLevel: null,
      goChecks: { boardClasses: ["longboard", "foamie"] },
    });

    expect(result.verdict).toBe("no");
    expect(result.decision.reasonCode).toBe("wave_height_exceeds_skill");
  });

  it("vetoes an above-beginner beach for a no-skill user on the go-check path only", () => {
    const intermediateBeach: Beach = { ...beach, skill_level: "intermediate" };
    const today = evaluateForecastVerdict({
      ...base,
      forecast: clean,
      beach: intermediateBeach,
      experienceLevel: null,
    });
    const checked = evaluateForecastVerdict({
      ...base,
      forecast: clean,
      beach: intermediateBeach,
      experienceLevel: null,
      goChecks: { boardClasses: ["longboard"] },
    });

    expect(today.verdict).toBe("go");
    expect(checked.verdict).toBe("no");
    expect(checked.decision.reasonCode).toBe("beach_skill_exceeds_user");
  });

  it("rates a no-skill user as beginner in the score and the engine", () => {
    const result = evaluateForecastVerdict({
      ...base,
      forecast: clean,
      beach,
      experienceLevel: null,
      goChecks: { boardClasses: [] },
    });

    expect(result.score).toBe(scoreWindowConditionScore(clean, beach, "beginner"));
    expect(result.decision.skillEligibility).toMatchObject({
      skill: "beginner",
      state: "eligible",
      reasonCodes: [],
    });
  });

  it("gates a flagged intermediate with no boards on the push path (D1b)", () => {
    // precondition
    expect(
      resolveRecommendationLabel({ beach, forecast: mixed3, score: 75 }).character?.category,
    ).toBe("medium-mixed");
    const today = evaluateForecastVerdict({
      ...base,
      forecast: mixed3,
      beach,
      experienceLevel: "intermediate",
    });
    const checked = evaluateForecastVerdict({
      ...base,
      forecast: mixed3,
      beach,
      experienceLevel: "intermediate",
      goChecks: { boardClasses: [] },
    });

    expect(today.verdict).toBe("go");
    expect(checked.score).toBeGreaterThanOrEqual(70);
    expect(checked.verdict).toBe("maybe");
  });
});
