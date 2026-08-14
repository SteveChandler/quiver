import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GET } from "@/app/api/cron/ccc-sync/route";
import { validateCronRequest } from "@/lib/middleware/api-wrappers";
import {
  fetchCCCLocations,
  matchCCCToBeaches,
  upsertCCCLocations,
} from "@/lib/services/ccc";

jest.mock("@/lib/cron/outcome", () => ({
  withCronOutcome: jest.fn(async (_options: unknown, handler: () => Promise<unknown>) => handler()),
}));

jest.mock("@/lib/cron/observability", () => ({
  withObservedCron:
    <H extends (request: Request) => Promise<Response>>(
      _route: string,
      handler: H
    ): H =>
      handler,
}));

jest.mock("@/lib/middleware/api-wrappers", () => {
  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: {
        "content-type": "application/json",
      },
    });
  }

  return {
    createSuccessResponse: jest.fn((data: unknown, status = 200) =>
      jsonResponse(
        {
          success: true,
          data,
          timestamp: new Date().toISOString(),
        },
        status
      )
    ),
    createErrorResponse: jest.fn(
      (error: string, details: unknown, status = 500) =>
        jsonResponse(
          {
            success: false,
            error,
            details,
            timestamp: new Date().toISOString(),
          },
          status
        )
    ),
    handleApiError: jest.fn((error: unknown) =>
      jsonResponse(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString(),
        },
        500
      )
    ),
    validateCronRequest: jest.fn(() => true),
  };
});

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({ from: jest.fn() })),
}));

jest.mock("@/lib/services/ccc", () => ({
  fetchCCCLocations: jest.fn(),
  upsertCCCLocations: jest.fn(),
  matchCCCToBeaches: jest.fn(),
}));

const mockValidateCronRequest = validateCronRequest as jest.MockedFunction<
  typeof validateCronRequest
>;
const mockFetchCCCLocations = fetchCCCLocations as jest.MockedFunction<
  typeof fetchCCCLocations
>;
const mockUpsertCCCLocations = upsertCCCLocations as jest.MockedFunction<
  typeof upsertCCCLocations
>;
const mockMatchCCCToBeaches = matchCCCToBeaches as jest.MockedFunction<
  typeof matchCCCToBeaches
>;

function createCronRequest(url = "http://localhost/api/cron/ccc-sync"): Request {
  return new Request(url, {
    headers: {
      authorization: "Bearer test-cron-secret",
    },
  });
}

describe("GET /api/cron/ccc-sync", () => {
  let consoleLog: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-05-07T16:23:57Z"));
    jest.clearAllMocks();
    consoleLog = jest.spyOn(console, "log").mockImplementation(() => undefined);

    mockValidateCronRequest.mockReturnValue(true);
    mockFetchCCCLocations.mockResolvedValue({
      locations: [
        {
          ccc_id: 1,
          name: "Test Access",
          lat: 33.1,
          lon: -117.3,
          county: "San Diego",
          has_parking: true,
          has_fee: false,
          has_restrooms: true,
          has_ada_access: false,
          has_dog_friendly: false,
          has_stroller_friendly: false,
          has_campground: false,
          has_boating: false,
          has_fishing: false,
          has_picnic_area: false,
          has_volleyball: false,
          has_bike_path: false,
          has_tidepools: false,
          has_sandy_beach: true,
          has_rocky_shore: false,
          has_bluff_trail: false,
          has_wildlife_viewing: false,
          has_visitor_center: false,
          raw_data: {},
          synced_at: "2026-05-07T16:23:57.000Z",
        },
      ],
      totalRaw: 1,
      skipped: 0,
      notModified: false,
      errors: [],
    });
    mockUpsertCCCLocations.mockResolvedValue({
      upserted: 1,
      batches: 1,
      errors: [],
    });
    mockMatchCCCToBeaches.mockResolvedValue({
      beachesEvaluated: 2,
      matchesFound: 3,
      matchesUpserted: 3,
      viewRefreshed: true,
      errors: [],
    });
  });

  afterEach(() => {
    consoleLog.mockRestore();
    jest.useRealTimers();
  });

  it("uses the shared API wrapper module for response helpers and cron auth", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/cron/ccc-sync/route.ts"),
      "utf8"
    );

    expect(source).not.toMatch(/from\s+["']@\/lib\/api-utils["']/);
    expect(source).toMatch(/from\s+["']@\/lib\/middleware\/api-wrappers["']/);
  });

  it("returns an ok skipped result for an invalid explicit phase", async () => {
    const response = await GET(
      createCronRequest("http://localhost/api/cron/ccc-sync?phase=bogus")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      phase: "skipped",
      accepted_phases: ["import", "match"],
    });
    expect(body.data.reason).toContain('raw phase="bogus"');
    expect(mockFetchCCCLocations).not.toHaveBeenCalled();
    expect(mockUpsertCCCLocations).not.toHaveBeenCalled();
    expect(mockMatchCCCToBeaches).not.toHaveBeenCalled();
  });

  it("returns an ok skipped result for a blank explicit phase", async () => {
    const response = await GET(
      createCronRequest("http://localhost/api/cron/ccc-sync?phase=%20%20")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      phase: "skipped",
      accepted_phases: ["import", "match"],
    });
    expect(body.data.reason).toContain('raw phase=""');
    expect(mockFetchCCCLocations).not.toHaveBeenCalled();
    expect(mockUpsertCCCLocations).not.toHaveBeenCalled();
    expect(mockMatchCCCToBeaches).not.toHaveBeenCalled();
  });

  it("returns an ok skipped result for missing phase outside scheduled windows", async () => {
    const response = await GET(createCronRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      phase: "skipped",
      accepted_phases: ["import", "match"],
    });
    expect(body.data.reason).toContain('Missing query param "phase"');
    expect(mockFetchCCCLocations).not.toHaveBeenCalled();
    expect(mockUpsertCCCLocations).not.toHaveBeenCalled();
    expect(mockMatchCCCToBeaches).not.toHaveBeenCalled();
  });

  it("infers import for a missing phase during the monthly import window", async () => {
    jest.setSystemTime(new Date("2026-06-01T06:12:00Z"));

    const response = await GET(createCronRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      phase: "import",
      inferred_phase: true,
      fetch: {
        totalRaw: 1,
      },
      upsert: {
        upserted: 1,
      },
    });
    expect(mockFetchCCCLocations).toHaveBeenCalledTimes(1);
    expect(mockUpsertCCCLocations).toHaveBeenCalledTimes(1);
    expect(mockMatchCCCToBeaches).not.toHaveBeenCalled();
  });

  it("infers match for a missing phase during the monthly match window", async () => {
    jest.setSystemTime(new Date("2026-06-01T07:12:00Z"));

    const response = await GET(createCronRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      phase: "match",
      inferred_phase: true,
      match: {
        beachesEvaluated: 2,
        matchesFound: 3,
      },
    });
    expect(mockFetchCCCLocations).not.toHaveBeenCalled();
    expect(mockUpsertCCCLocations).not.toHaveBeenCalled();
    expect(mockMatchCCCToBeaches).toHaveBeenCalledWith(expect.anything(), 1500);
  });
});
