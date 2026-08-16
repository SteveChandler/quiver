/**
 * @jest-environment node
 */

import { readFileSync } from "fs";
import { GET } from "@/app/api/cron/morning-forecast-bot/route";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { SYSTEM_IDENTITY } from "@/lib/system-identity";
import {
  fetchRegionalForecast,
  generateRegionalForecast,
  getRegionalBeachId,
} from "@/lib/npc/forecast-formatter";
import { selectBeach } from "@/lib/recommendations/selection";

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

jest.mock("@/lib/cron/outcome", () => ({
  withCronOutcome: async (_options: unknown, handler: () => Promise<unknown>) => handler(),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

jest.mock("@/lib/npc/forecast-formatter", () => ({
  fetchRegionalForecast: jest.fn(),
  generateRegionalForecast: jest.fn(),
  getRegionalBeachId: jest.fn(),
}));

jest.mock("@/lib/recommendations/selection", () => ({
  selectBeach: jest.fn(),
}));

type Region = "norcal" | "central" | "socal";

type QueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

type ProfileQuery = {
  select: jest.Mock<ProfileQuery, [string]>;
  eq: jest.Mock<ProfileQuery, [string, string | boolean]>;
  limit: jest.Mock<ProfileQuery, [number]>;
  single: jest.Mock<Promise<QueryResult<{ id: string }>>, []>;
};

type BeachQuery = {
  select: jest.Mock<BeachQuery, [string]>;
  eq: jest.Mock<BeachQuery, [string, string]>;
  single: jest.Mock<Promise<QueryResult<{ lat: number; lon: number }>>, []>;
};

type InsertedPost = { id: string };

type IntelPostQuery = {
  insert: jest.Mock<IntelPostSelectQuery, [Record<string, unknown>]>;
};

type IntelPostSelectQuery = {
  select: jest.Mock<IntelPostSingleQuery, [string]>;
};

type IntelPostSingleQuery = {
  single: jest.Mock<Promise<QueryResult<InsertedPost>>, []>;
};

type SupabaseMock = {
  from: jest.Mock<ProfileQuery | BeachQuery | IntelPostQuery, [string]>;
  rpc: jest.Mock;
};

function createProfileQuery(
  result: QueryResult<{ id: string }>
): ProfileQuery {
  const query = {} as ProfileQuery;
  query.select = jest.fn<ProfileQuery, [string]>(() => query);
  query.eq = jest.fn<ProfileQuery, [string, string | boolean]>(() => query);
  query.limit = jest.fn<ProfileQuery, [number]>(() => query);
  query.single = jest.fn<Promise<QueryResult<{ id: string }>>, []>(() =>
    Promise.resolve(result)
  );
  return query;
}

function createBeachQuery(
  result: QueryResult<{ lat: number; lon: number }>
): BeachQuery {
  const query = {} as BeachQuery;
  query.select = jest.fn<BeachQuery, [string]>(() => query);
  query.eq = jest.fn<BeachQuery, [string, string]>(() => query);
  query.single = jest.fn<Promise<QueryResult<{ lat: number; lon: number }>>, []>(
    () => Promise.resolve(result)
  );
  return query;
}

function createIntelPostQuery(
  result: QueryResult<InsertedPost>
): IntelPostQuery {
  const singleQuery: IntelPostSingleQuery = {
    single: jest.fn<Promise<QueryResult<InsertedPost>>, []>(() =>
      Promise.resolve(result)
    ),
  };
  const selectQuery: IntelPostSelectQuery = {
    select: jest.fn<IntelPostSingleQuery, [string]>(() => singleQuery),
  };
  return {
    insert: jest.fn<IntelPostSelectQuery, [Record<string, unknown>]>(
      () => selectQuery
    ),
  };
}

describe("morning forecast bot cron route", () => {
  const routeSource = readFileSync(
    "app/api/cron/morning-forecast-bot/route.ts",
    "utf8"
  );

  let supabase: SupabaseMock;
  let profileQuery: ProfileQuery;
  let beachQueries: BeachQuery[];
  let postQueries: IntelPostQuery[];
  let systemFeedRpc: jest.Mock;
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  const originalLegacyMorningFlag = process.env.QUIVER_LEGACY_MORNING_FORECAST_ENABLED;

  function mockSupabase(result: QueryResult<{ id: string }>): void {
    profileQuery = createProfileQuery(result);
    beachQueries = [];
    postQueries = [];
    let systemFeedCalls = 0;
    supabase = {
      from: jest.fn<ProfileQuery | BeachQuery | IntelPostQuery, [string]>(
        (table) => {
          if (table === "profiles") {
            return profileQuery;
          }
          if (table === "beaches") {
            const query = createBeachQuery({
              data: { lat: 32.75, lon: -117.25 },
              error: null,
            });
            beachQueries.push(query);
            return query;
          }
          if (table === "intel_posts") {
            const query = createIntelPostQuery({
              data: { id: `post-${postQueries.length + 1}` },
              error: null,
            });
            postQueries.push(query);
            return query;
          }
          throw new Error(`Unexpected table: ${table}`);
        }
      ),
      rpc: jest.fn(() => {
        systemFeedCalls += 1;
        return Promise.resolve({
          data: [{ post_id: `post-${systemFeedCalls}`, status: "inserted" }],
          error: null,
        });
      }),
    };
    systemFeedRpc = supabase.rpc;
    (createSupabaseServiceRoleClient as jest.Mock).mockResolvedValue(supabase);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.QUIVER_LEGACY_MORNING_FORECAST_ENABLED = "true";
    require("@/lib/middleware/api-wrappers").validateCronRequest.mockReturnValue(
      true
    );
    mockSupabase({ data: { id: SYSTEM_IDENTITY.profileId }, error: null });
    (selectBeach as jest.Mock).mockImplementation(async (candidate: unknown) => candidate);
    (fetchRegionalForecast as jest.Mock).mockImplementation(
      (_client: SupabaseMock, region: Region) =>
        Promise.resolve({ region, waveHeightFt: 3 })
    );
    (generateRegionalForecast as jest.Mock).mockImplementation(
      (forecast: { region: Region }) => ({
        title: `${forecast.region} forecast`,
        description: `${forecast.region} description`,
      })
    );
    (getRegionalBeachId as jest.Mock).mockImplementation(
      (_client: SupabaseMock, region: Region) => Promise.resolve(`${region}-beach`)
    );
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    if (originalLegacyMorningFlag === undefined) {
      delete process.env.QUIVER_LEGACY_MORNING_FORECAST_ENABLED;
    } else {
      process.env.QUIVER_LEGACY_MORNING_FORECAST_ENABLED = originalLegacyMorningFlag;
    }
  });

  it("uses the API wrapper barrel for response helpers and cron request validation", () => {
    expect(routeSource).not.toContain("@/lib/api-utils");
    expect(routeSource).toContain("@/lib/middleware/api-wrappers");
    expect(routeSource).not.toContain("FORECAST_BOT_DISPLAY_NAME");
  });

  it("rejects unauthorized cron requests before creating a Supabase client", async () => {
    const { validateCronRequest } = require("@/lib/middleware/api-wrappers");
    validateCronRequest.mockReturnValue(false);

    const response = await GET(
      new Request("http://localhost/api/cron/morning-forecast-bot")
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
    expect(fetchRegionalForecast).not.toHaveBeenCalled();
  });

  it("honors the legacy route pause gate before resolving identity", async () => {
    process.env.QUIVER_LEGACY_MORNING_FORECAST_ENABLED = "false";

    const response = await GET(
      new Request("http://localhost/api/cron/morning-forecast-bot")
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.summary).toMatchObject({ paused: true, successful: 0, failed: 0 });
    expect(createSupabaseServiceRoleClient).not.toHaveBeenCalled();
    expect(fetchRegionalForecast).not.toHaveBeenCalled();
  });

  it("returns an error when the system bot profile cannot be found", async () => {
    mockSupabase({
      data: null,
      error: { message: "No rows" },
    });

    const response = await GET(
      new Request("http://localhost/api/cron/morning-forecast-bot")
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(profileQuery.select).toHaveBeenCalledWith("id");
    expect(profileQuery.eq).toHaveBeenCalledWith("id", SYSTEM_IDENTITY.profileId);
    expect(profileQuery.eq).not.toHaveBeenCalledWith("full_name", expect.anything());
    expect(profileQuery.eq).toHaveBeenCalledWith("is_system_account", true);
    expect(profileQuery.limit).toHaveBeenCalledWith(1);
    expect(profileQuery.single).toHaveBeenCalledTimes(1);
    expect(data).toEqual({
      success: false,
      error: "Bot profile not found",
      details: 'Could not find system account "Quiver Surf Forecast"',
      timestamp: "2026-05-26T00:00:00.000Z",
    });
    expect(fetchRegionalForecast).not.toHaveBeenCalled();
    expect(postQueries).toHaveLength(0);
  });

  it("posts forecasts for all three configured regions", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/morning-forecast-bot")
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(profileQuery.eq).toHaveBeenCalledWith("id", SYSTEM_IDENTITY.profileId);
    expect(fetchRegionalForecast).toHaveBeenCalledTimes(3);
    expect(fetchRegionalForecast).toHaveBeenNthCalledWith(
      1,
      supabase,
      "norcal"
    );
    expect(fetchRegionalForecast).toHaveBeenNthCalledWith(
      2,
      supabase,
      "central"
    );
    expect(fetchRegionalForecast).toHaveBeenNthCalledWith(
      3,
      supabase,
      "socal"
    );
    expect(getRegionalBeachId).toHaveBeenCalledTimes(3);
    expect(beachQueries).toHaveLength(3);
    expect(systemFeedRpc).toHaveBeenCalledTimes(3);
    expect(systemFeedRpc).toHaveBeenNthCalledWith(
      1,
      "try_insert_system_feed_post",
      expect.objectContaining({
        p_user_id: SYSTEM_IDENTITY.profileId,
        p_beach_id: "norcal-beach",
        p_latitude: 32.75,
        p_longitude: -117.25,
        p_tag: "conditions",
        p_title: "norcal forecast",
        p_description: "norcal description",
        p_is_active: true,
      }),
    );
    expect(data.success).toBe(true);
    expect(data.data.summary).toMatchObject({
      regions: 3,
      successful: 3,
      failed: 0,
    });
    expect(typeof data.data.summary.durationMs).toBe("number");
    expect(data.data.results).toEqual([
      {
        region: "norcal",
        success: true,
        postId: "post-1",
        title: "norcal forecast",
      },
      {
        region: "central",
        success: true,
        postId: "post-2",
        title: "central forecast",
      },
      {
        region: "socal",
        success: true,
        postId: "post-3",
        title: "socal forecast",
      },
    ]);
  });

  it("does not post a held representative beach when the safe selector rejects it", async () => {
    (selectBeach as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockImplementation(async (candidate: unknown) => candidate);

    const response = await GET(
      new Request("http://localhost/api/cron/morning-forecast-bot"),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(selectBeach).toHaveBeenCalled();
    expect(data.data.results[0]).toMatchObject({
      region: "norcal",
      success: false,
      error: "Representative beach is not eligible for automated posting",
    });
    expect(systemFeedRpc).toHaveBeenCalledTimes(2);
  });
});
