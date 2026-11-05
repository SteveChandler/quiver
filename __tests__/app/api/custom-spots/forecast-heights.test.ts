/**
 * @jest-environment node
 */

import { getCachedRateLimiter } from "@/lib/utils/enhanced-rate-limiter";
import { RATE_LIMITS } from "@/lib/api/rate-limit-config";

afterAll(() => getCachedRateLimiter("public-default", RATE_LIMITS["public-default"]).destroy());

import { customSpotForecastHeightsHandler } from "@/app/api/custom-spots/[id]/forecast-heights/route";
import { createMockRequest } from "@/test-utils/api-test-helpers";
import type { OptionalAuthContext } from "@/lib/middleware/api-wrappers";

const loadCustomSpotForecastAdjusters = jest.fn();
const applyV51DisplayOverrideToForecasts = jest.fn();

jest.mock("@/lib/services/discovery/surf-discovery-orchestrator", () => ({
  loadCustomSpotForecastAdjusters: (...args: unknown[]) => loadCustomSpotForecastAdjusters(...args),
}));

jest.mock("@/lib/services/forecast/v5-display-gate", () => ({
  applyV51DisplayOverrideToForecasts: (...args: unknown[]) => applyV51DisplayOverrideToForecasts(...args),
}));

const SPOT_ID = "11111111-1111-4111-8111-111111111111";
const START = "2026-11-05T00:00:00.000Z";
const END = "2026-11-19T00:00:00.000Z";

function contextWith(tables: Record<string, unknown>, id = SPOT_ID): OptionalAuthContext & { supabase: { from: jest.Mock } } {
  const from = jest.fn((table: string) => {
    const result = { data: tables[table] ?? null, error: null };
    const query = {
      select: () => query,
      eq: () => query,
      is: () => query,
      gte: () => query,
      lt: () => query,
      order: () => query,
      maybeSingle: async () => result,
      then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    };
    return query;
  });
  return { params: { id }, user: null, supabase: { from } } as unknown as OptionalAuthContext & {
    supabase: { from: jest.Mock };
  };
}

function request(start = START, end = END): ReturnType<typeof createMockRequest> {
  return createMockRequest("GET", `http://localhost:3000/api/custom-spots/${SPOT_ID}/forecast-heights`, {
    searchParams: { start, end },
  });
}

describe("GET /api/custom-spots/[id]/forecast-heights", () => {
  const rows = [
    { beach_id: "beach-1", forecast_at: "2026-11-05T15:00:00+00:00", wave_height: "4.2 ft" },
    { beach_id: "beach-1", forecast_at: "2026-11-05T18:00:00+00:00", wave_height: "3.0 ft" },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    applyV51DisplayOverrideToForecasts.mockImplementation(async (input: Array<{ wave_height: string }>) =>
      input.map((row) => ({ ...row, wave_height: row.wave_height === "4.2 ft" ? "4.6 ft" : row.wave_height })));
  });

  it("returns adjusted heights for the stored and display rows, omitting unchanged hours", async () => {
    loadCustomSpotForecastAdjusters.mockResolvedValue(new Map([[SPOT_ID, (row: { wave_height: string }) => ({
      ...row,
      wave_height: row.wave_height === "4.2 ft" ? "3.8 ft" : row.wave_height === "4.6 ft" ? "4.1 ft" : row.wave_height,
    })]]));
    const context = contextWith({
      custom_spots: { id: SPOT_ID, nearest_beach_id: "beach-1", terrain_status: "ok" },
      beaches: { id: "beach-1" },
      enhanced_forecasts: rows,
    });

    const response = await customSpotForecastHeightsHandler(request(), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({
      heights: { "2026-11-05T15:00:00+00:00": "3.8 ft" },
      displayHeights: { "2026-11-05T15:00:00+00:00": "4.1 ft" },
    });
    expect(loadCustomSpotForecastAdjusters).toHaveBeenCalledWith([
      { spot: expect.objectContaining({ id: SPOT_ID }), nearestBeach: { id: "beach-1" } },
    ]);
  });

  it("returns nothing for a spot that is not analyzed or not visible", async () => {
    for (const spot of [null, { id: SPOT_ID, nearest_beach_id: "beach-1", terrain_status: "queued" }]) {
      const context = contextWith({ custom_spots: spot });
      const body = await (await customSpotForecastHeightsHandler(request(), context)).json();
      expect(body.data).toEqual({ heights: {}, displayHeights: {} });
      expect(context.supabase.from).not.toHaveBeenCalledWith("enhanced_forecasts");
    }
  });

  it.each([
    ["a bad id", "not-a-uuid", START, END],
    ["a reversed window", SPOT_ID, END, START],
    ["a window over 16 days", SPOT_ID, START, "2026-12-01T00:00:00.000Z"],
  ])("rejects %s", async (_label, id, start, end) => {
    const response = await customSpotForecastHeightsHandler(request(start, end), contextWith({}, id));
    expect(response.status).toBe(400);
  });
});
