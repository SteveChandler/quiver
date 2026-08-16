/**
 * @jest-environment node
 */

import { readFileSync } from "fs";
import { GET } from "@/app/api/cron/update-buoy-conditions/route";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { fetchLatestNDBCObservation } from "@/lib/services/ndbc-service";

jest.mock("@/lib/cron/outcome", () => ({
  withCronOutcome: jest.fn(async (_options: unknown, handler: () => Promise<unknown>) => handler()),
}));

jest.mock("@/lib/middleware/api-wrappers", () => ({
  createSuccessResponse: jest.fn((data, status = 200) => ({
    json: async () => ({
      success: true,
      data,
      timestamp: "2026-05-26T00:00:00.000Z",
    }),
    status,
  })),
  createErrorResponse: jest.fn((error, details, status = 500) => ({
    json: async () => ({
      success: false,
      error,
      details,
      timestamp: "2026-05-26T00:00:00.000Z",
    }),
    status,
  })),
  handleApiError: jest.fn((error) => ({
    json: async () => ({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: "2026-05-26T00:00:00.000Z",
    }),
    status: 500,
  })),
  validateCronRequest: jest.fn(() => true),
}));

jest.mock("@/lib/cron/observability", () => ({
  withObservedCron: jest.fn((_route: string, handler) => handler),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

jest.mock("@/lib/services/ndbc-service", () => ({
  fetchLatestNDBCObservation: jest.fn(),
}));

type BuoysQueryResult = {
  data: Array<{ buoy_uuid: string; buoy_name: string }> | null;
  error: { message: string } | null;
};

type BuoysSelectQuery = {
  select: jest.Mock<BuoysSelectQuery, [string]>;
  eq: jest.Mock<Promise<BuoysQueryResult>, [string, boolean]>;
};

function createBuoysSelectQuery(result: BuoysQueryResult): BuoysSelectQuery {
  const query = {} as BuoysSelectQuery;
  query.select = jest.fn<BuoysSelectQuery, [string]>(() => query);
  query.eq = jest.fn<Promise<BuoysQueryResult>, [string, boolean]>(() =>
    Promise.resolve(result)
  );
  return query;
}

describe("update buoy conditions cron route", () => {
  const routeSource = readFileSync(
    "app/api/cron/update-buoy-conditions/route.ts",
    "utf8"
  );

  let buoysSelectQuery: BuoysSelectQuery;
  let supabase: { from: jest.Mock<BuoysSelectQuery, [string]> };
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  function mockBuoysQuery(result: BuoysQueryResult): void {
    buoysSelectQuery = createBuoysSelectQuery(result);
    supabase = {
      from: jest.fn<BuoysSelectQuery, [string]>(() => buoysSelectQuery),
    };
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    require("@/lib/middleware/api-wrappers").validateCronRequest.mockReturnValue(
      true
    );
    (fetchLatestNDBCObservation as jest.Mock).mockResolvedValue(null);
    mockBuoysQuery({ data: [], error: null });
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("uses the API wrapper barrel for response helpers and cron request validation", () => {
    expect(routeSource).not.toContain("@/lib/api-utils");
    expect(routeSource).toContain("@/lib/middleware/api-wrappers");
  });

  it("rejects unauthorized cron requests before creating a Supabase client", async () => {
    const { validateCronRequest } = require("@/lib/middleware/api-wrappers");
    validateCronRequest.mockReturnValue(false);

    const response = await GET(
      new Request("http://localhost/api/cron/update-buoy-conditions")
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({
      success: false,
      error: "Unauthorized",
      details: "Invalid cron authentication",
      timestamp: "2026-05-26T00:00:00.000Z",
    });
    expect(createSupabaseServiceRoleClient).not.toHaveBeenCalled();
    expect(fetchLatestNDBCObservation).not.toHaveBeenCalled();
  });

  it("queries active buoys and returns an empty summary when none are active", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/update-buoy-conditions")
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(supabase.from).toHaveBeenCalledWith("buoys");
    expect(buoysSelectQuery.select).toHaveBeenCalledWith(
      "buoy_uuid, buoy_name"
    );
    expect(buoysSelectQuery.eq).toHaveBeenCalledWith("active", true);
    expect(fetchLatestNDBCObservation).not.toHaveBeenCalled();
    expect(data).toEqual({
      success: true,
      data: {
        summary: { total: 0, updated: 0, failed: 0 },
        message: "No active buoys to update",
      },
      timestamp: "2026-05-26T00:00:00.000Z",
    });
  });

  it("treats missing NDBC observations as no-data rather than failures", async () => {
    mockBuoysQuery({
      data: [{ buoy_uuid: "46258", buoy_name: "Mission Bay West" }],
      error: null,
    });

    const response = await GET(
      new Request("http://localhost/api/cron/update-buoy-conditions")
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(fetchLatestNDBCObservation).toHaveBeenCalledWith("46258");
    expect(data).toEqual({
      success: true,
      data: {
        summary: { total: 1, updated: 0, failed: 0, noData: 1 },
        message: "Updated 0 of 1 buoys",
      },
      timestamp: "2026-05-26T00:00:00.000Z",
    });
  });

  it("returns active-buoy query failures as database errors", async () => {
    mockBuoysQuery({
      data: null,
      error: { message: "select failed" },
    });

    const response = await GET(
      new Request("http://localhost/api/cron/update-buoy-conditions")
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({
      success: false,
      error: "Database error",
      details: "select failed",
      timestamp: "2026-05-26T00:00:00.000Z",
    });
    expect(fetchLatestNDBCObservation).not.toHaveBeenCalled();
  });
});
