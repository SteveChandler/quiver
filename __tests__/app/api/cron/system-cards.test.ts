/** @jest-environment node */

import { GET } from "@/app/api/cron/system-cards/route";
import { readFileSync } from "fs";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { fetchBeachTrafficWeights } from "@/lib/npc/traffic-weights";
import { fetchLatestSystemForecast } from "@/lib/npc/system-cards";
import { selectSystemCardCandidates } from "@/lib/npc/system-card-selection";
import { SYSTEM_IDENTITY } from "@/lib/system-identity";

jest.mock("@/lib/middleware/api-wrappers", () => ({
  createSuccessResponse: jest.fn((data, status = 200) => ({
    json: async () => ({ success: true, data }),
    status,
  })),
  createErrorResponse: jest.fn((error, details, status = 500) => ({
    json: async () => ({ success: false, error, details }),
    status,
  })),
  handleApiError: jest.fn((error, message) => ({
    json: async () => ({ success: false, error: message, details: String(error) }),
    status: 500,
  })),
  validateCronRequest: jest.fn(() => true),
}));

jest.mock("@/lib/cron/outcome", () => ({
  withCronOutcome: jest.fn((_options: unknown, handler) => handler()),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

jest.mock("@/lib/npc/traffic-weights", () => ({
  fetchBeachTrafficWeights: jest.fn(),
}));

jest.mock("@/lib/npc/system-cards", () => ({
  fetchLatestSystemForecast: jest.fn(),
  buildSystemCardCopy: jest.requireActual("@/lib/npc/system-cards").buildSystemCardCopy,
}));

jest.mock("@/lib/npc/system-card-selection", () => ({
  selectSystemCardCandidates: jest.fn(),
}));

describe("system-card cron route", () => {
  const routeSource = readFileSync("app/api/cron/system-cards/route.ts", "utf8");
  let intelPostInsert: jest.Mock;
  let systemFeedRpc: jest.Mock;
  let historyRows: Array<Record<string, unknown>>;
  let profileQuery: Record<string, jest.Mock>;
  const originalSystemCardsFlag = process.env.QUIVER_SYSTEM_CARDS_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.QUIVER_SYSTEM_CARDS_ENABLED = "true";
    historyRows = [];
    intelPostInsert = jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn().mockResolvedValue({ data: { id: "post-1" }, error: null }),
      })),
    }));
    systemFeedRpc = jest.fn().mockResolvedValue({
      data: [{ post_id: "post-1", status: "inserted" }],
      error: null,
    });
    const historyQuery = makeQuery({ data: historyRows, error: null });
    profileQuery = makeQuery({ data: { id: SYSTEM_IDENTITY.profileId }, error: null });
    const beachesQuery = makeQuery({
      data: [{ id: "beach-1", name: "Ocean Beach", city: "San Diego", state: "CA", lat: 32, lon: -117 }],
      error: null,
    });
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "profiles") return profileQuery;
        if (table === "beaches") return beachesQuery;
        if (table === "intel_posts") return {
          ...(historyQuery as object),
          insert: intelPostInsert,
        };
        throw new Error(`Unexpected table ${table}`);
      }),
      rpc: systemFeedRpc,
    };
    (createSupabaseServiceRoleClient as jest.Mock).mockResolvedValue(supabase);
    (fetchBeachTrafficWeights as jest.Mock).mockResolvedValue(null);
    (fetchLatestSystemForecast as jest.Mock).mockResolvedValue({
      forecastAt: "2026-08-13T11:00:00.000Z",
      waveHeightFt: 3,
      wavePeriodSeconds: 10,
      windSpeedKnots: 5,
      windDirection: "NW",
      tideHeightFt: 2,
      tideStatus: "rising",
      waterTempF: 64,
    });
    (selectSystemCardCandidates as jest.Mock).mockResolvedValue([{
      candidate: {
        id: "beach-1",
        name: "Ocean Beach",
        lat: 32,
        lon: -117,
        marketKey: "ca:san-diego",
        allocationTier: "proven",
        trafficWeight: 1,
      },
      contentClass: "forecast_summary",
    }]);
  });

  afterEach(() => {
    if (originalSystemCardsFlag === undefined) {
      delete process.env.QUIVER_SYSTEM_CARDS_ENABLED;
    } else {
      process.env.QUIVER_SYSTEM_CARDS_ENABLED = originalSystemCardsFlag;
    }
  });

  it("asserts published cards and treats the disabled flag as a legitimate zero", async () => {
    expect(routeSource).toContain("withCronOutcome");
    expect(routeSource).toContain('unit: "cards_published"');

    process.env.QUIVER_SYSTEM_CARDS_ENABLED = "false";
    const response = await GET(new Request("http://localhost/api/cron/system-cards"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.summary).toMatchObject({
      paused: true,
      successful: 0,
      reason: "QUIVER_SYSTEM_CARDS_ENABLED=false",
    });
  });

  it("posts with uniform fallback when traffic weights are missing", async () => {
    const response = await GET(new Request("http://localhost/api/cron/system-cards"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(fetchBeachTrafficWeights).toHaveBeenCalledWith(expect.anything(), ["beach-1"]);
    expect(systemFeedRpc).toHaveBeenCalledWith(
      "try_insert_system_feed_post",
      expect.objectContaining({
        p_user_id: SYSTEM_IDENTITY.profileId,
        p_beach_id: "beach-1",
        p_tag: "conditions",
        p_dedupe_hash: expect.any(String),
        p_surf_conditions: expect.objectContaining({
        system_card: true,
        voice: "Quiver Forecast",
      }),
      }),
    );
    expect(profileQuery.eq).toHaveBeenCalledWith("id", SYSTEM_IDENTITY.profileId);
    expect(profileQuery.eq).toHaveBeenCalledWith("is_system_account", true);
    expect(profileQuery.eq).not.toHaveBeenCalledWith("personality_type", expect.anything());
    expect(data.data.results[0]).toMatchObject({ voice: "Quiver Forecast", contentClass: "forecast_summary" });
  });

  it("does not exceed the hard daily ceiling", async () => {
    const createdAt = new Date().toISOString();
    historyRows.push(...Array.from({ length: 12 }, () => ({
      beach_id: "beach-1",
      title: "Existing card",
      description: "Existing description",
      created_at: createdAt,
      dedupe_hash: null,
      surf_conditions: { system_card: true, content_class: "forecast_summary" },
    })));

    const response = await GET(new Request("http://localhost/api/cron/system-cards"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.summary).toMatchObject({ cardsToday: 12, successful: 0, hardCeiling: 12 });
    expect(intelPostInsert).not.toHaveBeenCalled();
    expect(systemFeedRpc).not.toHaveBeenCalled();
  });

  it("counts legacy system-feed posts toward the per-beach cap", async () => {
    const createdAt = new Date().toISOString();
    historyRows.push(
      { beach_id: "beach-1", title: "Morning report", description: "Legacy one", created_at: createdAt, dedupe_hash: null, surf_conditions: null },
      { beach_id: "beach-1", title: "Morning report", description: "Legacy two", created_at: createdAt, dedupe_hash: null, surf_conditions: null },
    );
    (selectSystemCardCandidates as jest.Mock).mockImplementation(
      async ({ history }: { history: Array<unknown> }) =>
        history.length >= 2 ? [] : [{
          candidate: {
            id: "beach-1",
            name: "Ocean Beach",
            lat: 32,
            lon: -117,
            marketKey: "ca:san-diego",
            allocationTier: "proven",
            trafficWeight: 1,
          },
          contentClass: "forecast_summary",
        }],
    );

    const response = await GET(new Request("http://localhost/api/cron/system-cards"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.summary).toMatchObject({ successful: 0, skipped: "no_safe_candidate" });
    expect(systemFeedRpc).not.toHaveBeenCalled();
  });

  it("does not double-post when concurrent cron retries race for the same cap slot", async () => {
    historyRows.push(...Array.from({ length: 9 }, () => ({
      beach_id: "beach-1",
      title: "Existing card",
      description: "Existing description",
      created_at: new Date().toISOString(),
      dedupe_hash: null,
      surf_conditions: { system_card: true, content_class: "forecast_summary" },
    })));
    let accepted = 9;
    const insertedHashes = new Set<string>();
    systemFeedRpc.mockImplementation(async (
      _functionName: string,
      args: { p_dedupe_hash: string },
    ) => {
      if (insertedHashes.has(args.p_dedupe_hash)) {
        return { data: [{ post_id: "post-1", status: "duplicate" }], error: null };
      }
      if (accepted >= 12) {
        return { data: [{ post_id: null, status: "daily_cap" }], error: null };
      }
      insertedHashes.add(args.p_dedupe_hash);
      accepted += 1;
      return { data: [{ post_id: "post-1", status: "inserted" }], error: null };
    });

    const [first, second] = await Promise.all([
      GET(new Request("http://localhost/api/cron/system-cards")),
      GET(new Request("http://localhost/api/cron/system-cards")),
    ]);
    const firstData = await first.json();
    const secondData = await second.json();
    const successful = [firstData, secondData]
      .map((body) => body.data.summary.successful)
      .reduce((sum, count) => sum + count, 0);

    expect(successful).toBe(1);
    expect(accepted).toBeLessThanOrEqual(12);
    expect(systemFeedRpc).toHaveBeenCalledTimes(2);
  });

  it("refuses to post when the canonical identity cannot be resolved", async () => {
    profileQuery.single.mockResolvedValue({
      data: null,
      error: { message: "No canonical profile" },
    });

    const response = await GET(new Request("http://localhost/api/cron/system-cards"));

    expect(response.status).toBe(500);
    expect(intelPostInsert).not.toHaveBeenCalled();
  });
});

function makeQuery(result: unknown): Record<string, jest.Mock> {
  const query: Record<string, jest.Mock> = {};
  for (const method of ["select", "eq", "gte", "order", "limit", "not"]) {
    query[method] = jest.fn(() => query);
  }
  query.maybeSingle = jest.fn(() => Promise.resolve(result));
  query.single = jest.fn(() => Promise.resolve(result));
  query.then = jest.fn((resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject));
  return query;
}
