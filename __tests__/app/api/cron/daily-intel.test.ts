/**
 * @jest-environment node
 */

import { readFileSync } from "fs";
import { GET } from "@/app/api/cron/daily-intel/route";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { IntelGenerationService } from "@/lib/services/intel-generation-service";

const mockGenerateIntel = jest.fn();
const mockSaveIntel = jest.fn();

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
  handleApiError: jest.fn((error, message) => ({
    json: async () => ({
      success: false,
      error: message,
      details: error instanceof Error ? error.message : String(error),
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

jest.mock("@/lib/services/intel-generation-service", () => ({
  IntelGenerationService: jest.fn(() => ({
    generateIntel: mockGenerateIntel,
    saveIntel: mockSaveIntel,
  })),
}));

jest.mock("@/lib/utils/timezone-utils.server", () => ({
  getTimezoneFromCoords: jest.fn(() => "America/Los_Angeles"),
}));

type BeachRow = {
  id: string;
  lat: number | null;
  lon: number | null;
  preferred_tide_ft_min: number;
  preferred_tide_ft_max: number;
};

type BeachesQueryResult = {
  data: BeachRow[] | null;
  error: { message: string } | null;
};

type BeachesQuery = {
  select: jest.Mock<BeachesQuery, [string]>;
  not: jest.Mock<BeachesQuery, [string, string, null]>;
  order: jest.Mock<BeachesQuery, [string, { ascending: boolean }]>;
  limit: jest.Mock<Promise<BeachesQueryResult>, [number]>;
};

function createBeachesQuery(result: BeachesQueryResult): BeachesQuery {
  const query = {} as BeachesQuery;
  query.select = jest.fn<BeachesQuery, [string]>(() => query);
  query.not = jest.fn<BeachesQuery, [string, string, null]>(() => query);
  query.order = jest.fn<BeachesQuery, [string, { ascending: boolean }]>(
    () => query
  );
  query.limit = jest.fn<Promise<BeachesQueryResult>, [number]>(() =>
    Promise.resolve(result)
  );
  return query;
}

describe("daily intel cron route", () => {
  const routeSource = readFileSync("app/api/cron/daily-intel/route.ts", "utf8");
  const originalSupabaseUrl = process.env.SUPABASE_URL;
  const originalPublicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const originalTimeBudget = process.env.DAILY_INTEL_CRON_TIME_BUDGET_MS;

  let beachesQuery: BeachesQuery;
  let supabase: { from: jest.Mock<BeachesQuery, [string]> };
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  function mockBeachesQuery(result: BeachesQueryResult): void {
    beachesQuery = createBeachesQuery(result);
    supabase = {
      from: jest.fn<BeachesQuery, [string]>(() => beachesQuery),
    };
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    require("@/lib/middleware/api-wrappers").validateCronRequest.mockReturnValue(
      true
    );
    process.env.SUPABASE_URL = "https://supabase.example";
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    process.env.DAILY_INTEL_CRON_TIME_BUDGET_MS = "250000";
    mockBeachesQuery({ data: [], error: null });
    mockGenerateIntel.mockResolvedValue({ recommendation: { decision: "go" } });
    mockSaveIntel.mockResolvedValue(undefined);
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  afterAll(() => {
    if (originalSupabaseUrl === undefined) {
      delete process.env.SUPABASE_URL;
    } else {
      process.env.SUPABASE_URL = originalSupabaseUrl;
    }

    if (originalPublicSupabaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalPublicSupabaseUrl;
    }

    if (originalServiceRoleKey === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRoleKey;
    }

    if (originalTimeBudget === undefined) {
      delete process.env.DAILY_INTEL_CRON_TIME_BUDGET_MS;
    } else {
      process.env.DAILY_INTEL_CRON_TIME_BUDGET_MS = originalTimeBudget;
    }
  });

  it("uses the API wrapper barrel for response helpers and cron request validation", () => {
    expect(routeSource).not.toContain("@/lib/api-utils");
    expect(routeSource).toContain("@/lib/middleware/api-wrappers");
  });

  it("rejects unauthorized cron requests before checking Supabase configuration", async () => {
    const { validateCronRequest } = require("@/lib/middleware/api-wrappers");
    validateCronRequest.mockReturnValue(false);

    const response = await GET(
      new Request("http://localhost/api/cron/daily-intel")
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
    expect(IntelGenerationService).not.toHaveBeenCalled();
  });

  it("rejects missing Supabase configuration before creating clients", async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const response = await GET(
      new Request("http://localhost/api/cron/daily-intel")
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({
      success: false,
      error: "Missing Supabase configuration",
      details:
        "Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY",
      timestamp: "2026-05-26T00:00:00.000Z",
    });
    expect(createSupabaseServiceRoleClient).not.toHaveBeenCalled();
    expect(IntelGenerationService).not.toHaveBeenCalled();
  });

  it("queries eligible beaches with the clamped max beach limit", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/daily-intel?maxBeaches=900")
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(supabase.from).toHaveBeenCalledWith("beaches");
    expect(beachesQuery.select).toHaveBeenCalledWith(
      "id, lat, lon, preferred_tide_ft_min, preferred_tide_ft_max"
    );
    expect(beachesQuery.not).toHaveBeenCalledWith(
      "preferred_tide_ft_min",
      "is",
      null
    );
    expect(beachesQuery.not).toHaveBeenCalledWith(
      "preferred_tide_ft_max",
      "is",
      null
    );
    expect(beachesQuery.order).toHaveBeenCalledWith("id", {
      ascending: true,
    });
    expect(beachesQuery.limit).toHaveBeenCalledWith(500);
    expect(IntelGenerationService).toHaveBeenCalledWith(
      "https://supabase.example",
      "service-role-key"
    );
    expect(data.success).toBe(true);
    expect(data.data.summary).toMatchObject({
      maxBeaches: 500,
      processed: 0,
      successful: 0,
      failed: 0,
    });
    expect(typeof data.data.summary.durationMs).toBe("number");
  });

  it("generates and saves intel for an eligible beach", async () => {
    mockBeachesQuery({
      data: [
        {
          id: "beach-1",
          lat: 32.75,
          lon: -117.25,
          preferred_tide_ft_min: 1,
          preferred_tide_ft_max: 4,
        },
      ],
      error: null,
    });

    const response = await GET(
      new Request(
        "http://localhost/api/cron/daily-intel?generationTime=07:30&maxBeaches=1"
      )
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(beachesQuery.limit).toHaveBeenCalledWith(1);
    expect(mockGenerateIntel).toHaveBeenCalledWith(
      "beach-1",
      "07:30",
      "America/Los_Angeles"
    );
    expect(mockSaveIntel).toHaveBeenCalledWith(
      "beach-1",
      { recommendation: { decision: "go" } },
      "07:30",
      "America/Los_Angeles"
    );
    expect(data.data.results).toEqual([
      { beachId: "beach-1", timezone: "America/Los_Angeles", ok: true },
    ]);
    expect(data.data.summary).toMatchObject({
      maxBeaches: 1,
      processed: 1,
      successful: 1,
      failed: 0,
    });
  });
});
