/**
 * @jest-environment node
 */

import { GET } from "@/app/api/cron/earn-pro-evaluate/route";
import { grantPromotionalEntitlement } from "@/lib/subscription/grant-promotional-entitlement";

const mockFrom = jest.fn();
const mockRpc = jest.fn();
const mockGrantPromotionalEntitlement = grantPromotionalEntitlement as jest.MockedFunction<
  typeof grantPromotionalEntitlement
>;

jest.mock("@/lib/cron/outcome", () => ({
  withCronOutcome: jest.fn(async (_options: unknown, handler: () => Promise<unknown>) => handler()),
}));

jest.mock("@/lib/cron/observability", () => ({
  withObservedCron: jest.fn((_route: string, handler) => handler),
}));

jest.mock("@/lib/middleware/api-wrappers", () => ({
  createSuccessResponse: jest.fn((data, status = 200) => ({
    json: jest.fn(() =>
      Promise.resolve({ success: true, data, timestamp: new Date().toISOString() }),
    ),
    status,
  })),
  createErrorResponse: jest.fn((error, details, status = 500) => ({
    json: jest.fn(() =>
      Promise.resolve({ success: false, error, details, timestamp: new Date().toISOString() }),
    ),
    status,
  })),
  handleApiError: jest.fn((error) => ({
    json: jest.fn(() =>
      Promise.resolve({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      }),
    ),
    status: 500,
  })),
  validateCronRequest: jest.fn(() => true),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

jest.mock("@/lib/subscription/grant-promotional-entitlement", () => {
  const actual = jest.requireActual(
    "@/lib/subscription/grant-promotional-entitlement",
  );
  return {
    ...actual,
    grantPromotionalEntitlement: jest.fn(),
  };
});

const originalEarnProEnabled = process.env.EARN_PRO_ENABLED;
const originalEarnProTestUserIds = process.env.EARN_PRO_TEST_USER_IDS;

function mockRequest(): Request {
  return {
    headers: { get: jest.fn(() => "Bearer test-cron-secret") },
  } as unknown as Request;
}

function mockProfilesQuery(rows: Array<{ id: string }>): void {
  const inFilter = jest.fn(async () => ({ data: rows, error: null }));
  const select = jest.fn(() => ({ in: inFilter }));
  mockFrom.mockReturnValue({ select });
}

async function readJson(response: Response): Promise<Record<string, any>> {
  return response.json() as Promise<Record<string, any>>;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  delete process.env.EARN_PRO_ENABLED;
  delete process.env.EARN_PRO_TEST_USER_IDS;
  mockGrantPromotionalEntitlement.mockResolvedValue({
    status: "granted",
    expiresAt: "2026-06-29T00:00:00.000Z",
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  if (originalEarnProEnabled === undefined) {
    delete process.env.EARN_PRO_ENABLED;
  } else {
    process.env.EARN_PRO_ENABLED = originalEarnProEnabled;
  }
  if (originalEarnProTestUserIds === undefined) {
    delete process.env.EARN_PRO_TEST_USER_IDS;
  } else {
    process.env.EARN_PRO_TEST_USER_IDS = originalEarnProTestUserIds;
  }
});

describe("earn-pro-evaluate cron", () => {
  it("does nothing when EARN_PRO_ENABLED is off", async () => {
    process.env.EARN_PRO_TEST_USER_IDS = "u-eligible";

    const response = await GET(mockRequest());
    const body = await readJson(response as Response);

    expect(body.data.summary.enabled).toBe(false);
    expect(body.data.summary.skipped.flagDisabled).toBe(1);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockGrantPromotionalEntitlement).not.toHaveBeenCalled();
  });

  it("does nothing when enabled without a test-user allowlist", async () => {
    process.env.EARN_PRO_ENABLED = "true";

    const response = await GET(mockRequest());
    const body = await readJson(response as Response);

    expect(body.data.summary.enabled).toBe(true);
    expect(body.data.summary.skipped.missingAllowlist).toBe(1);
    expect(mockGrantPromotionalEntitlement).not.toHaveBeenCalled();
  });

  it("grants only allowlisted users who satisfy the weekly-primary eligibility rule", async () => {
    process.env.EARN_PRO_ENABLED = "true";
    process.env.EARN_PRO_TEST_USER_IDS =
      "u-eligible,u-weekly-short,u-boundary,u-missing-profile";
    mockProfilesQuery([
      { id: "u-eligible" },
      { id: "u-weekly-short" },
      { id: "u-boundary" },
    ]);
    mockRpc.mockImplementation(async (_fn: string, args: { p_user_id: string }) => {
      const rows: Record<string, Record<string, number>> = {
        "u-eligible": {
          weekly_session_streak_current: 3,
          weekly_session_streak_best: 3,
        },
        "u-weekly-short": {
          weekly_session_streak_current: 1,
          weekly_session_streak_best: 1,
        },
        "u-boundary": {
          weekly_session_streak_current: 2,
          weekly_session_streak_best: 2,
        },
      };
      return { data: rows[args.p_user_id], error: null };
    });

    const response = await GET(mockRequest());
    const body = await readJson(response as Response);

    expect(body.data.summary.candidates).toBe(3);
    expect(body.data.summary.eligible).toBe(2);
    expect(body.data.summary.granted).toBe(2);
    expect(body.data.summary.skipped.ineligible).toBe(1);
    expect(body.data.summary.skipped.missingProfile).toBe(1);
    expect(mockGrantPromotionalEntitlement).toHaveBeenCalledTimes(2);
    expect(mockGrantPromotionalEntitlement).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        userId: "u-eligible",
        streakSnapshot: expect.objectContaining({
          weeklySessionStreakCurrent: 3,
        }),
      }),
    );
    expect(mockGrantPromotionalEntitlement).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        userId: "u-boundary",
        streakSnapshot: expect.objectContaining({
          weeklySessionStreakCurrent: 2,
        }),
      }),
    );
  });

  it("counts active grants as idempotent skips", async () => {
    process.env.EARN_PRO_ENABLED = "true";
    process.env.EARN_PRO_TEST_USER_IDS = "u-active";
    mockProfilesQuery([{ id: "u-active" }]);
    mockRpc.mockResolvedValue({
      data: {
        weekly_session_streak_current: 2,
        weekly_session_streak_best: 2,
      },
      error: null,
    });
    mockGrantPromotionalEntitlement.mockResolvedValue({
      status: "skipped_active",
      expiresAt: "2026-06-29T00:00:00.000Z",
    });

    const response = await GET(mockRequest());
    const body = await readJson(response as Response);

    expect(body.data.summary.granted).toBe(0);
    expect(body.data.summary.skipped.activeGrant).toBe(1);
  });
});
