import { readFileSync } from "fs";

const mockRpc = jest.fn();

jest.mock("@/lib/middleware/api-wrappers", () => ({
  validateCronRequest: jest.fn(),
}));

jest.mock("@/lib/cron/observability", () => ({
  withObservedCron: jest.fn((_route: string, handler: unknown) => handler),
}));

jest.mock("@/lib/cron/outcome", () => ({
  withCronOutcome: jest.fn(async (_options: unknown, handler: () => Promise<unknown>) =>
    handler()
  ),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

import { GET } from "@/app/api/cron/major-event-hold-retention/route";
import { withObservedCron } from "@/lib/cron/observability";
import { validateCronRequest } from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const mockWithObservedCron = jest.mocked(withObservedCron);
const mockValidateCronRequest = jest.mocked(validateCronRequest);
const mockCreateServiceClient = jest.mocked(createSupabaseServiceRoleClient);

const mockClient = { rpc: mockRpc };

function makeRequest(): Request {
  return new Request("http://localhost/api/cron/major-event-hold-retention", {
    headers: { authorization: "Bearer cron-secret" },
  });
}

describe("major event hold retention cron", () => {
  beforeEach(() => {
    mockValidateCronRequest.mockReset();
    mockCreateServiceClient.mockReset();
    mockRpc.mockReset();
    process.env.CRON_SECRET = "cron-secret";
    process.env.MAJOR_EVENT_HOLD_MODE = "off";
    process.env.MAJOR_EVENT_HOLD_AUTOMATION_ENABLED = "false";
    mockValidateCronRequest.mockReturnValue(true);
    mockCreateServiceClient.mockReturnValue(mockClient as never);
    mockRpc.mockResolvedValue({
      data: [{ chains_deleted: 2, rows_deleted: 5 }],
      error: null,
    });
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.MAJOR_EVENT_HOLD_MODE;
    delete process.env.MAJOR_EVENT_HOLD_AUTOMATION_ENABLED;
  });

  it("rejects unauthorized requests before any client or RPC call", async () => {
    mockValidateCronRequest.mockReturnValue(false);

    const response = await GET(makeRequest());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      ok: false,
      status: "unauthorized",
      errorCode: "unauthorized",
    });
    expect(mockCreateServiceClient).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("runs independently when hold mode and activation automation are off", async () => {
    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      status: "completed",
      counts: { chainsDeleted: 2, rowsDeleted: 5 },
    });
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith(
      "purge_expired_regional_recommendation_holds_v1",
    );
    expect(mockRpc.mock.instances[0]).toBe(mockClient);
  });

  it("returns a stable safe RPC failure without leaking database detail", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "secret evidence and operator identity" },
    });

    const response = await GET(makeRequest());
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toEqual({
      ok: false,
      status: "error",
      errorCode: "purge_failed",
      counts: { chainsDeleted: 0, rowsDeleted: 0 },
    });
    expect(JSON.stringify(payload)).not.toContain("secret");
    expect(JSON.stringify(payload)).not.toContain("operator");
  });

  it.each([
    null,
    [],
    [{ chains_deleted: -1, rows_deleted: 0 }],
    [{ chains_deleted: 1.5, rows_deleted: 2 }],
    [{ chains_deleted: 1, rows_deleted: 2, evidence: "leak" }],
    [{ chains_deleted: "1", rows_deleted: 2 }],
  ])("rejects an invalid purge result shape %#", async (data) => {
    mockRpc.mockResolvedValue({ data, error: null });

    const response = await GET(makeRequest());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      ok: false,
      status: "error",
      errorCode: "purge_result_invalid",
      counts: { chainsDeleted: 0, rowsDeleted: 0 },
    });
  });

  it("uses node dynamic no-store and observed-cron patterns", async () => {
    const source = readFileSync(
      "app/api/cron/major-event-hold-retention/route.ts",
      "utf8",
    );
    const response = await GET(makeRequest());

    expect(source).toContain('export const runtime = "nodejs"');
    expect(source).toContain('export const dynamic = "force-dynamic"');
    expect(source).toContain("export const revalidate = 0");
    expect(source).toContain("withObservedCron");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mockWithObservedCron).toHaveBeenCalledWith(
      "/api/cron/major-event-hold-retention",
      expect.any(Function),
      {
        slug: "major-event-hold-retention",
        schedule: "15 9 * * 0",
      },
    );
  });

  it("declares the two exact unique Vercel schedules", () => {
    const config = JSON.parse(readFileSync("vercel.json", "utf8")) as {
      crons: Array<{ path: string; schedule: string }>;
    };
    const evaluate = config.crons.filter(
      ({ path }) => path === "/api/cron/major-event-hold-evaluate",
    );
    const retention = config.crons.filter(
      ({ path }) => path === "/api/cron/major-event-hold-retention",
    );

    expect(evaluate).toEqual([
      {
        path: "/api/cron/major-event-hold-evaluate",
        schedule: "55 * * * *",
      },
    ]);
    expect(retention).toEqual([
      {
        path: "/api/cron/major-event-hold-retention",
        schedule: "15 9 * * 0",
      },
    ]);
  });
});
