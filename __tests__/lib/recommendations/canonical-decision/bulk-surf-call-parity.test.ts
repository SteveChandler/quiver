/**
 * @jest-environment node
 *
 * The Explore pin preview reads /api/forecasts/bulk and Beach Detail reads
 * /api/surf/call. Both must reach the same canonical decision for one beach,
 * hour and profile, including the skill gate and its reason.
 */
import type { BulkDecisionContext } from "@/lib/services/forecast/bulk-decision-context";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";

jest.mock("server-only", () => ({}));
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));
jest.mock("@/lib/recommendations/selection", () => ({
  rankBeaches: jest.fn(async (beaches: Array<{ id: string }>) => beaches),
}));
jest.mock("@/lib/services/discovery/window-selector/window-scorer", () => ({
  ...jest.requireActual("@/lib/services/discovery/window-selector/window-scorer"),
  scoreWindowWithComposite: jest.fn(() => ({ effects: [] })),
}));

const { bulkSessionDecision } = require("@/lib/services/forecast/bulk-decision-context");
const { resolveCanonicalSessionDecisionContext } = require("@/lib/recommendations/canonical-decision/service");

const AT = "2026-10-13T18:00:00.000Z";
const END = "2026-10-13T19:00:00.000Z";
const TIMEZONE = "America/Los_Angeles";
const SCORE = 54;

function beach(skillLevel: string): Beach {
  return {
    id: "blacks",
    name: "Blacks Beach",
    lat: 32.889,
    lon: -117.253,
    timezone: TIMEZONE,
    skill_level: skillLevel,
  } as unknown as Beach;
}

function forecast(): EnhancedForecastEntity {
  return {
    id: "forecast-blacks",
    beach_id: "blacks",
    forecast_at: AT,
    wave_height: "5 ft",
  } as unknown as EnhancedForecastEntity;
}

function bulkContext(): BulkDecisionContext {
  return {
    beaches: [],
    boards: [],
    skillLevel: "intermediate",
    boardClasses: [],
    sunTimes: new Map(),
    matches: new Map(),
    rowDurationsMs: new Map([[`blacks:${AT}`, 60 * 60_000]]),
    waterQuality: { from: jest.fn() } as unknown as BulkDecisionContext["waterQuality"],
  };
}

async function surfCallDecision(skillLevel: string) {
  const discoverSurfSpots = jest.fn().mockResolvedValue({
    recommendations: [],
    includedRecommendations: [
      {
        recommendationId: `beach:blacks:${AT}`,
        beach: { id: "blacks", name: "Blacks Beach", skill_level: skillLevel },
        window: { start: new Date(AT), end: new Date(END), timezone: TIMEZONE },
        forecast: { id: "forecast-blacks", beach_id: "blacks", forecast_at: AT, wave_height: "5 ft" },
        score: SCORE,
        recommendationLabel: "Maybe",
      },
    ],
    recommendationAvailability: { state: "available", holdEpoch: "bulk" },
  });
  const context = await resolveCanonicalSessionDecisionContext(
    {
      userId: "user-1",
      profileExperience: "intermediate",
      anchorTime: AT,
      candidateBeachIds: ["blacks"],
      scope: { kind: "plan_next_session", windowStart: AT, windowEnd: END, timezone: TIMEZONE },
      discoveryOptions: { horizonHours: 24, includeBeachIds: ["blacks"], forecastAt: AT },
    },
    { discoverSurfSpots },
  );
  return context.decision;
}

function basis(decision: { verdict: string; decisionBasis: string; reasonCode: string }) {
  return {
    verdict: decision.verdict,
    decisionBasis: decision.decisionBasis,
    reasonCode: decision.reasonCode,
  };
}

describe("bulk and surf call share the canonical decision", () => {
  it("vetoes an advanced break for an intermediate with the same safety reason on both endpoints", async () => {
    const bulk = bulkSessionDecision(bulkContext(), beach("advanced"), forecast(), SCORE, new Date(AT));
    const call = await surfCallDecision("advanced");

    expect(basis(bulk)).toEqual({
      verdict: "no",
      decisionBasis: "safety_override",
      reasonCode: "beach_skill_exceeds_user",
    });
    expect(basis(call)).toEqual(basis(bulk));
  });

  it("agrees on a conditions verdict when the break fits the surfer", async () => {
    const bulk = bulkSessionDecision(bulkContext(), beach("intermediate"), forecast(), SCORE, new Date(AT));
    const call = await surfCallDecision("intermediate");

    expect(bulk.decisionBasis).not.toBe("safety_override");
    expect(basis(call)).toEqual(basis(bulk));
  });
});
