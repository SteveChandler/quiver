/**
 * @jest-environment node
 *
 * /api/forecasts/scored board picks under the founding access switch: a signed-in
 * free user gets board picks while it is on, and `plan` keeps reporting real Pro.
 */

import { NextRequest } from "next/server";
import { featureAccessOff, featureAccessOn } from "@/__tests__/setup/founding-access";

const BEACH_ID = "00000000-0000-4000-8000-000000000101";
const USER_ID = "00000000-0000-4000-8000-000000000800";

const mockFetchUserBoardContext = jest.fn();
const mockResolveFeatureAccess = jest.fn(featureAccessOff);
let mockAuthContext: unknown;
let mockEntitlementRow: Record<string, unknown> | null = null;
let mockEntitlementError: { code: string; message: string } | null = null;

jest.mock("@ducanh2912/next-pwa", () => ({ __esModule: true, default: () => (config: unknown) => config }));
jest.mock("@sentry/nextjs", () => ({ withSentryConfig: (config: unknown) => config }));
jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/middleware/api-wrappers");
  return {
    ...actual,
    withAuth: (handler: (request: NextRequest, context: unknown) => unknown) => (request: NextRequest) =>
      handler(request, mockAuthContext),
  };
});
jest.mock("@/lib/recommendations/major-event-hold/service", () => ({
  evaluateMajorEventHoldCandidates: jest.fn(async ({ candidates }: { candidates: Array<{ candidateId: string }> }) =>
    candidates.map(({ candidateId }) => ({ candidateId, state: "available" }))),
}));
jest.mock("@/lib/profile/skill-level", () => ({ getProfileExperienceLevel: jest.fn(async () => "intermediate") }));
jest.mock("@/lib/services/forecast/v5-display-gate", () => ({
  applyV51DisplayOverrideToForecasts: jest.fn(async (rows: unknown[]) => rows),
}));
jest.mock("@/lib/services/observations/nowcast-anchor", () => ({ fetchLatestObservation: jest.fn(async () => null) }));
jest.mock("@/lib/services/discovery/surf-discovery-orchestrator", () => ({
  ...jest.requireActual("@/lib/services/discovery/surf-discovery-orchestrator"),
  fetchUserBoardContext: (...args: unknown[]) => mockFetchUserBoardContext(...args),
}));
jest.mock("@/lib/flags/founding-access", () => ({
  resolveFeatureAccess: (...args: Parameters<typeof featureAccessOff>) => mockResolveFeatureAccess(...args),
}));

function supabaseStub() {
  const chain = (result: () => unknown) => {
    const c: Record<string, unknown> = {};
    for (const key of ["select", "eq", "gte", "lt", "order"]) c[key] = () => c;
    c.single = async () => result();
    c.maybeSingle = async () => result();
    c.limit = async () => ({ data: [], error: null });
    return c;
  };
  return {
    from: (table: string) => {
      if (table === "beaches") {
        return chain(() => ({ data: { id: BEACH_ID, name: "Test", timezone: "America/Los_Angeles", shoaling_factors: null }, error: null }));
      }
      if (table === "user_entitlements") {
        return chain(() => ({ data: mockEntitlementError ? null : mockEntitlementRow, error: mockEntitlementError }));
      }
      return chain(() => ({ data: null, error: null }));
    },
  };
}

async function get(): Promise<{ plan: string; boardPicksEnabled: boolean }> {
  mockAuthContext = { params: { beachId: BEACH_ID }, user: { id: USER_ID }, supabase: supabaseStub() };
  const { GET } = await import("@/app/api/forecasts/scored/[beachId]/route");
  const response = await GET(new NextRequest(`http://localhost/api/forecasts/scored/${BEACH_ID}`));
  expect(response.status).toBe(200);
  return (await response.json()).data;
}

const savedBoardPicksFree = process.env.BOARD_PICKS_FREE_ENABLED;

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.BOARD_PICKS_FREE_ENABLED;
  mockEntitlementRow = null;
  mockEntitlementError = null;
  mockResolveFeatureAccess.mockImplementation(featureAccessOff);
  mockFetchUserBoardContext.mockResolvedValue({ dominantBoardClass: null, boardClasses: [], boardsForPicks: [] });
});

afterAll(() => {
  if (savedBoardPicksFree === undefined) delete process.env.BOARD_PICKS_FREE_ENABLED;
  else process.env.BOARD_PICKS_FREE_ENABLED = savedBoardPicksFree;
});

it("ON: a free user gets board picks and plan stays free", async () => {
  mockResolveFeatureAccess.mockImplementation(featureAccessOn);
  const data = await get();
  expect(mockResolveFeatureAccess).toHaveBeenCalledWith(USER_ID, false, { billingIssue: false });
  expect(mockFetchUserBoardContext).toHaveBeenCalledWith(expect.anything(), USER_ID, true);
  expect(data).toMatchObject({ plan: "free", boardPicksEnabled: true });
});

it("OFF: a free user keeps board picks off", async () => {
  const data = await get();
  expect(mockFetchUserBoardContext).toHaveBeenCalledWith(expect.anything(), USER_ID, false);
  expect(data).toMatchObject({ plan: "free", boardPicksEnabled: false });
});

it("Pro keeps plan pro and board picks on", async () => {
  mockEntitlementRow = { is_pro: true };
  const data = await get();
  expect(mockResolveFeatureAccess).toHaveBeenCalledWith(USER_ID, true, { billingIssue: false });
  expect(data).toMatchObject({ plan: "pro", boardPicksEnabled: true });
});

it("fails instead of scoring a Pro user as free when the entitlement read fails", async () => {
  mockEntitlementRow = { is_pro: true };
  mockEntitlementError = { code: "57014", message: "canceling statement due to statement timeout" };
  mockAuthContext = { params: { beachId: BEACH_ID }, user: { id: USER_ID }, supabase: supabaseStub() };
  const { GET } = await import("@/app/api/forecasts/scored/[beachId]/route");

  await expect(GET(new NextRequest(`http://localhost/api/forecasts/scored/${BEACH_ID}`))).rejects.toThrow(
    "canceling statement due to statement timeout",
  );
  expect(mockResolveFeatureAccess).not.toHaveBeenCalled();
  expect(mockFetchUserBoardContext).not.toHaveBeenCalled();
});
