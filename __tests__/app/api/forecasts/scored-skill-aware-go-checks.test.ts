/**
 * @jest-environment node
 *
 * With skill-aware go checks on, /api/forecasts/scored rates a no-skill user as a beginner,
 * like Week Scout. The hold gate and the response shape keep the raw skill.
 */

import { NextRequest } from "next/server";
import { featureAccessOff } from "@/__tests__/setup/founding-access";
import { resetEntitlementReadReportingForTests } from "@/lib/subscription/read-entitlement-row";

const BEACH_ID = "00000000-0000-4000-8000-000000000101";
const USER_ID = "00000000-0000-4000-8000-000000000800";
const OTHER_USER_ID = "00000000-0000-4000-8000-000000000999";
const ENV_KEYS = ["SKILL_AWARE_GO_CHECKS_ENABLED", "SKILL_AWARE_GO_CHECKS_USER_ALLOWLIST"] as const;
const savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

const mockFetchUserBoardContext = jest.fn();
const mockGetProfileExperienceLevel = jest.fn();
const mockScoreDetails = jest.fn();
const mockEvaluateHolds = jest.fn();
let mockAuthContext: unknown;

jest.mock("@ducanh2912/next-pwa", () => ({ __esModule: true, default: () => (config: unknown) => config }));
jest.mock("@sentry/nextjs", () => ({ withSentryConfig: (config: unknown) => config, captureException: jest.fn() }));
jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/middleware/api-wrappers");
  return {
    ...actual,
    withAuth: (handler: (request: NextRequest, context: unknown) => unknown) => (request: NextRequest) =>
      handler(request, mockAuthContext),
  };
});
jest.mock("@/lib/recommendations/major-event-hold/service", () => ({
  evaluateMajorEventHoldCandidates: (...args: unknown[]) => mockEvaluateHolds(...args),
}));
jest.mock("@/lib/profile/skill-level", () => ({
  getProfileExperienceLevel: (...args: unknown[]) => mockGetProfileExperienceLevel(...args),
}));
jest.mock("@/lib/services/forecast/v5-display-gate", () => ({
  applyV51DisplayOverrideToForecasts: jest.fn(async (rows: unknown[]) => rows),
}));
jest.mock("@/lib/services/observations/nowcast-anchor", () => ({ fetchLatestObservation: jest.fn(async () => null) }));
jest.mock("@/lib/services/discovery/surf-discovery-orchestrator", () => ({
  ...jest.requireActual("@/lib/services/discovery/surf-discovery-orchestrator"),
  fetchUserBoardContext: (...args: unknown[]) => mockFetchUserBoardContext(...args),
}));
jest.mock("@/lib/services/discovery/window-selector/window-scorer", () => {
  const actual = jest.requireActual("@/lib/services/discovery/window-selector/window-scorer");
  return {
    ...actual,
    scoreWindowConditionDetails: (...args: unknown[]) => {
      mockScoreDetails(...args);
      return actual.scoreWindowConditionDetails(...args);
    },
  };
});
jest.mock("@/lib/flags/founding-access", () => ({ resolveFeatureAccess: featureAccessOff }));

const FORECAST_ROW = {
  beach_id: BEACH_ID, confidence_score: 90, forecast_at: "2099-09-23T12:00:00Z", wave_height: "3.7 ft",
  wave_period: "15s", wind_speed: "3 mph", wind_direction_deg: 150, tide_height: "3 ft", tide_status: "Rising",
};

function supabaseStub(): unknown {
  const chain = (result: () => unknown): Record<string, unknown> => {
    const c: Record<string, unknown> = {};
    for (const key of ["select", "eq", "gte", "lt", "order"]) c[key] = () => c;
    c.single = async () => result();
    c.maybeSingle = async () => result();
    c.limit = async () => ({ data: [FORECAST_ROW], error: null });
    return c;
  };
  return {
    from: (table: string) => {
      if (table === "beaches") {
        return chain(() => ({ data: { id: BEACH_ID, name: "Test", timezone: "America/Los_Angeles", shoaling_factors: null }, error: null }));
      }
      return chain(() => ({ data: null, error: null }));
    },
  };
}

async function get(): Promise<Record<string, unknown>> {
  mockAuthContext = { params: { beachId: BEACH_ID }, user: { id: USER_ID }, supabase: supabaseStub() };
  const { GET } = await import("@/app/api/forecasts/scored/[beachId]/route");
  const response = await GET(new NextRequest(`http://localhost/api/forecasts/scored/${BEACH_ID}`));
  expect(response.status).toBe(200);
  return (await response.json()).data;
}

/** The skill the slot score used: the call that carries the user's board classes. */
function scoredSkills(): unknown[] {
  return mockScoreDetails.mock.calls
    .filter((call) => Array.isArray(call[4]) && call[4].length > 0)
    .map((call) => call[2]);
}

function setFlag(enabled: boolean, allowlist = ""): void {
  process.env.SKILL_AWARE_GO_CHECKS_ENABLED = enabled ? "true" : "false";
  process.env.SKILL_AWARE_GO_CHECKS_USER_ALLOWLIST = allowlist;
}

beforeEach(() => {
  jest.clearAllMocks();
  resetEntitlementReadReportingForTests();
  mockGetProfileExperienceLevel.mockResolvedValue(null);
  mockFetchUserBoardContext.mockResolvedValue({ dominantBoardClass: null, boardClasses: ["longboard"], boardsForPicks: [] });
  mockEvaluateHolds.mockImplementation(async ({ candidates }: { candidates: Array<{ candidateId: string }> }) =>
    candidates.map(({ candidateId }) => ({ candidateId, state: "available" })));
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

it("rates an allowlisted no-skill user with boards as a beginner", async () => {
  setFlag(true, USER_ID);
  await get();
  expect(scoredSkills()).toEqual(["beginner"]);
});

it.each([
  ["the flag is off", false, USER_ID],
  ["the user is not allowlisted", true, OTHER_USER_ID],
])("keeps today's unknown skill when %s", async (_label: string, enabled: boolean, allowlist: string) => {
  setFlag(enabled, allowlist);
  await get();
  expect(scoredSkills()).toEqual([null]);
});

it("keeps a known skill unchanged with the flag on", async () => {
  setFlag(true, USER_ID);
  mockGetProfileExperienceLevel.mockResolvedValue("advanced");
  await get();
  expect(scoredSkills()).toEqual(["advanced"]);
});

it("keeps the hold gate on the raw skill and the response keys unchanged", async () => {
  setFlag(false);
  const flagOff = await get();
  setFlag(true, USER_ID);
  mockEvaluateHolds.mockClear();
  const flagOn = await get();

  expect(mockEvaluateHolds).toHaveBeenCalledWith(expect.objectContaining({ profileExperience: null }));
  expect(Object.keys(flagOn).sort()).toEqual(Object.keys(flagOff).sort());
  expect(flagOn).not.toHaveProperty("skillDefaultApplied");
  expect(flagOn.generalProfile).toEqual({ skill: "beginner", board: null });
});
