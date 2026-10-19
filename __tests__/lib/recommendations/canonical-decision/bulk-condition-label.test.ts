/**
 * @jest-environment node
 *
 * Home's bulk conditionLabels come from the canonical decision, which reads the
 * selected row's character: a wind-blown-out MAYBE reads MEH, as on the beach call.
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
jest.mock("@/lib/services/discovery/recommendation-label", () => ({
  resolveRecommendationLabel: jest.fn(),
}));

const { bulkSessionDecision } = require("@/lib/services/forecast/bulk-decision-context");
const { resolveRecommendationLabel } = require("@/lib/services/discovery/recommendation-label");

const AT = "2026-10-13T18:00:00.000Z";
const beach = {
  id: "blacks",
  name: "Blacks Beach",
  lat: 32.889,
  lon: -117.253,
  timezone: "America/Los_Angeles",
  skill_level: "intermediate",
} as unknown as Beach;
const forecast = {
  id: "f1",
  beach_id: "blacks",
  forecast_at: AT,
  wave_height: "5 ft",
} as unknown as EnhancedForecastEntity;
const context = {
  beaches: [],
  boards: [],
  skillLevel: "intermediate",
  boardClasses: [],
  sunTimes: new Map(),
  matches: new Map(),
  rowDurationsMs: new Map([[`blacks:${AT}`, 60 * 60_000]]),
  waterQuality: { from: jest.fn() },
} as unknown as BulkDecisionContext;

function decisionWithCharacter(category: string) {
  resolveRecommendationLabel.mockReturnValue({
    label: "Maybe",
    character: { label: "x", category },
  });
  return bulkSessionDecision(context, beach, forecast, 54, new Date(AT));
}

describe("bulk condition label", () => {
  it("reads MEH for a MAYBE whose selected row is blown out", () => {
    const decision = decisionWithCharacter("skip");
    expect(decision.verdict).toBe("maybe");
    expect(decision.conditionLabel).toBe("MEH");
  });

  it("keeps FAIR for a MAYBE with any other character", () => {
    const decision = decisionWithCharacter("medium-mixed");
    expect(decision.verdict).toBe("maybe");
    expect(decision.conditionLabel).toBe("FAIR");
  });
});
