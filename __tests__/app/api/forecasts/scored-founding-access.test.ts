/**
 * @jest-environment node
 *
 * /api/forecasts/scored board picks under the founding access switch: a signed-in
 * free user gets board picks while it is on, and `plan` keeps reporting real Pro.
 */

import { NextRequest } from "next/server";
import { featureAccessOff, featureAccessOn } from "@/__tests__/setup/founding-access";
import { resetEntitlementReadReportingForTests } from "@/lib/subscription/read-entitlement-row";

const BEACH_ID = "00000000-0000-4000-8000-000000000101";
const USER_ID = "00000000-0000-4000-8000-000000000800";

const mockFetchUserBoardContext = jest.fn();
const mockResolveFeatureAccess = jest.fn(featureAccessOff);
let mockAuthContext: unknown;
let mockEntitlementRow: Record<string, unknown> | null = null;
let mockEntitlementError: { code: string; message: string } | null = null;

jest.mock("@ducanh2912/next-pwa", () => ({ __esModule: true, default: () => (config: unknown) => config }));
const mockCaptureException = jest.fn();
let mockEntitlementReads = 0;
let mockForecastRows: unknown[] = [];
jest.mock("@sentry/nextjs", () => ({
  withSentryConfig: (config: unknown) => config,
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));
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
    c.limit = async () => ({ data: mockForecastRows, error: null });
    return c;
  };
  return {
    from: (table: string) => {
      if (table === "beaches") {
        return chain(() => ({ data: { id: BEACH_ID, name: "Test", timezone: "America/Los_Angeles", shoaling_factors: null }, error: null }));
      }
      if (table === "user_entitlements") {
        mockEntitlementReads += 1;
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
  mockEntitlementReads = 0;
  mockForecastRows = [];
  resetEntitlementReadReportingForTests();
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

it("scores with no paid features and no plan when the entitlement read fails twice", async () => {
  // The switch is on, so a fallback through founding access would turn board picks on.
  mockResolveFeatureAccess.mockImplementation(featureAccessOn);
  mockEntitlementRow = { is_pro: true };
  mockEntitlementError = { code: "57014", message: "canceling statement due to statement timeout" };
  mockForecastRows = [{
    beach_id: BEACH_ID, confidence_score: 90, forecast_at: "2099-09-23T12:00:00Z", wave_height: "3.7 ft",
    wave_period: "15s", wind_speed: "3 mph", wind_direction_deg: 150, tide_height: "3 ft", tide_status: "Rising",
  }];
  jest.spyOn(console, "warn").mockImplementation(() => {});

  const data = await get() as unknown as { timeSlots: Array<{ forecastAt: string }> } & Record<string, unknown>;

  expect(mockEntitlementReads).toBe(2);
  expect(data.timeSlots).toHaveLength(1);
  expect(data.timeSlots[0].forecastAt).toBe("2099-09-23T12:00:00Z");
  expect(Array.isArray(data.goldenWindows)).toBe(true);
  expect(data).not.toHaveProperty("plan");
  expect(data).toMatchObject({ planStatus: "unknown", boardPicksEnabled: false });
  expect(mockResolveFeatureAccess).not.toHaveBeenCalled();
  expect(mockFetchUserBoardContext).toHaveBeenCalledWith(expect.anything(), USER_ID, false);
  expect(mockCaptureException).toHaveBeenCalledTimes(1);
});

it("keeps board picks on for an unknown plan only when the free board picks flag is on", async () => {
  process.env.BOARD_PICKS_FREE_ENABLED = "true";
  mockEntitlementError = { code: "57014", message: "canceling statement due to statement timeout" };
  jest.spyOn(console, "warn").mockImplementation(() => {});

  const data = await get() as unknown as Record<string, unknown>;

  expect(data).not.toHaveProperty("plan");
  expect(data).toMatchObject({ planStatus: "unknown", boardPicksEnabled: true });
});

it("keeps the success payload unchanged when the read succeeds on the retry", async () => {
  mockEntitlementRow = { is_pro: true };
  let calls = 0;
  const stub = supabaseStub();
  const from = stub.from;
  stub.from = (table: string) => {
    if (table === "user_entitlements") {
      calls += 1;
      mockEntitlementError = calls === 1 ? { code: "57014", message: "timeout" } : null;
    }
    return from(table);
  };
  mockAuthContext = { params: { beachId: BEACH_ID }, user: { id: USER_ID }, supabase: stub };
  const { GET } = await import("@/app/api/forecasts/scored/[beachId]/route");
  const response = await GET(new NextRequest(`http://localhost/api/forecasts/scored/${BEACH_ID}`));
  const data = (await response.json()).data;

  expect(response.status).toBe(200);
  expect(calls).toBe(2);
  expect(data).toMatchObject({ plan: "pro", boardPicksEnabled: true });
  expect(data).not.toHaveProperty("planStatus");
  expect(mockCaptureException).not.toHaveBeenCalled();
});
