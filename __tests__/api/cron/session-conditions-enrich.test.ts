/**
 * @jest-environment node
 */
import { readFileSync } from "fs";
import { GET } from "@/app/api/cron/session-conditions-enrich/route";
import { withCronOutcome } from "@/lib/cron/outcome";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  createSupabaseSessionConditionsStore,
  enrichSessionConditions,
} from "@/lib/sessions/session-conditions-enrich";

jest.mock("@/lib/cron/outcome", () => ({
  withCronOutcome: jest.fn(async (_options: unknown, handler: () => Promise<unknown>) => handler()),
}));
jest.mock("@/lib/cron/observability", () => ({
  withObservedCron: jest.fn((_route: string, handler) => handler),
}));
jest.mock("@/lib/middleware/api-wrappers", () => ({
  createSuccessResponse: jest.fn((data, status = 200) => ({ json: async () => ({ success: true, data }), status })),
  createErrorResponse: jest.fn((error, details, status = 500) => ({ json: async () => ({ success: false, error, details }), status })),
  handleApiError: jest.fn((error) => ({ json: async () => ({ success: false, error: String(error) }), status: 500 })),
  validateCronRequest: jest.fn(() => true),
}));
jest.mock("@/lib/supabase/server", () => ({ createSupabaseServiceRoleClient: jest.fn(() => ({ client: true })) }));
jest.mock("@/lib/sessions/session-conditions-enrich", () => ({
  createSupabaseSessionConditionsStore: jest.fn(() => ({ store: true })),
  enrichSessionConditions: jest.fn(),
}));

const SUMMARY = { selected: 3, updated: 3, conditionsFilled: 3, nearshoreFilled: 2, unavailable: 0, unmapped: 1, errors: 0 };
const request = (query = "") => new Request(`https://www.quiversurf.app/api/cron/session-conditions-enrich${query}`);

describe("session conditions enrich cron", () => {
  const original = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SESSION_CONDITIONS_ENRICH_ENABLED = "true";
    require("@/lib/middleware/api-wrappers").validateCronRequest.mockReturnValue(true);
    (enrichSessionConditions as jest.Mock).mockResolvedValue(SUMMARY);
  });
  afterEach(() => { process.env = { ...original }; });

  it("rejects a request without the cron secret", async () => {
    require("@/lib/middleware/api-wrappers").validateCronRequest.mockReturnValue(false);
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(enrichSessionConditions).not.toHaveBeenCalled();
  });

  it("does nothing while the flag is off", async () => {
    delete process.env.SESSION_CONDITIONS_ENRICH_ENABLED;
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(createSupabaseServiceRoleClient).not.toHaveBeenCalled();
    expect(enrichSessionConditions).not.toHaveBeenCalled();
  });

  it("runs live mode with the service-role store under a cron outcome", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(createSupabaseSessionConditionsStore).toHaveBeenCalledWith({ client: true });
    expect(enrichSessionConditions).toHaveBeenCalledWith({ store: true }, { mode: "live", since: undefined, now: expect.any(Date) });
    const [options] = (withCronOutcome as jest.Mock).mock.calls[0];
    expect(options).toMatchObject({ job: "/api/cron/session-conditions-enrich", unit: "sessions_enriched", expectedMin: 1 });
    expect(options.getProduced(SUMMARY)).toBe(3);
    expect(options.legitimatelyZero({ ...SUMMARY, selected: 0 })).toEqual({ reason: expect.any(String) });
    expect(options.legitimatelyZero(SUMMARY)).toBeUndefined();
  });

  it("runs backfill from the requested date", async () => {
    await GET(request("?mode=backfill&since=2025-04-01"));
    expect(enrichSessionConditions).toHaveBeenCalledWith(
      { store: true },
      { mode: "backfill", since: new Date("2025-04-01T00:00:00Z"), now: expect.any(Date) },
    );
  });

  it("refuses an unreadable since", async () => {
    const response = await GET(request("?mode=backfill&since=yesterday-ish"));
    expect(response.status).toBe(400);
    expect(enrichSessionConditions).not.toHaveBeenCalled();
  });

  it("is scheduled hourly at :20, after MOP's nowcast lands", () => {
    const crons = JSON.parse(readFileSync("vercel.json", "utf8")).crons as Array<{ path: string; schedule: string }>;
    expect(crons).toContainEqual({ path: "/api/cron/session-conditions-enrich", schedule: "20 * * * *" });
  });
});
