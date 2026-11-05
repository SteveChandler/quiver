/**
 * @jest-environment node
 */

import { getCachedRateLimiter } from "@/lib/utils/enhanced-rate-limiter";
import { RATE_LIMITS } from "@/lib/api/rate-limit-config";

afterAll(() => getCachedRateLimiter("public-default", RATE_LIMITS["public-default"]).destroy());

import { customSpotCurrentDisplayHandler } from "@/app/api/custom-spots/current-display/route";
import { createMockRequest } from "@/test-utils/api-test-helpers";
import type { OptionalAuthContext } from "@/lib/middleware/api-wrappers";

const loadCustomSpotForecastAdjusters = jest.fn();
const fetchBulkForecastRowsWithV51Display = jest.fn();

jest.mock("@/lib/services/discovery/surf-discovery-orchestrator", () => ({
  loadCustomSpotForecastAdjusters: (...args: unknown[]) => loadCustomSpotForecastAdjusters(...args),
}));

jest.mock("@/lib/services/forecast/map-current-forecast", () => ({
  ...jest.requireActual("@/lib/services/forecast/map-current-forecast"),
  fetchBulkForecastRowsWithV51Display: (...args: unknown[]) => fetchBulkForecastRowsWithV51Display(...args),
}));

const SPOT_A = "11111111-1111-4111-8111-111111111111";
const SPOT_B = "22222222-2222-4222-8222-222222222222";

function contextWith(tables: Record<string, unknown[]>): OptionalAuthContext & { supabase: { from: jest.Mock } } {
  const from = jest.fn((table: string) => {
    const result = { data: tables[table] ?? [], error: null };
    const query = {
      select: () => query,
      in: () => query,
      is: () => query,
      then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    };
    return query;
  });
  return { params: {}, user: null, supabase: { from } } as unknown as OptionalAuthContext & {
    supabase: { from: jest.Mock };
  };
}

function request(ids: string): ReturnType<typeof createMockRequest> {
  return createMockRequest("GET", "http://localhost:3000/api/custom-spots/current-display", {
    searchParams: { ids },
  });
}

describe("GET /api/custom-spots/current-display", () => {
  const now = new Date();
  const currentRow = {
    beach_id: "beach-1",
    forecast_at: new Date(Math.floor(now.getTime() / 3_600_000) * 3_600_000).toISOString(),
    wave_height: "4.0 ft",
    data_source: "OPEN_METEO",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    fetchBulkForecastRowsWithV51Display.mockResolvedValue({ data: [currentRow], timelineRows: [], error: null });
  });

  it("returns the adjusted current label for analyzed spots only", async () => {
    loadCustomSpotForecastAdjusters.mockResolvedValue(
      new Map([[SPOT_A, (row: object) => ({ ...row, wave_height: "3.0 ft" })]]),
    );
    const context = contextWith({
      custom_spots: [
        { id: SPOT_A, nearest_beach_id: "beach-1", terrain_status: "ok" },
        { id: SPOT_B, nearest_beach_id: "beach-1", terrain_status: "ok" },
      ],
      beaches: [{ id: "beach-1" }],
    });

    const response = await customSpotCurrentDisplayHandler(request(`${SPOT_A},${SPOT_B}`), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(Object.keys(body.data.displays)).toEqual([SPOT_A]);
    expect(body.data.displays[SPOT_A]).toMatchObject({ label: "3ft", forecastAt: currentRow.forecast_at });
    expect(fetchBulkForecastRowsWithV51Display).toHaveBeenCalledWith(
      context.supabase, ["beach-1"], expect.any(Date), expect.any(Date), expect.anything(),
    );
  });

  it("skips unanalyzed spots without reading forecasts", async () => {
    const context = contextWith({
      custom_spots: [{ id: SPOT_A, nearest_beach_id: "beach-1", terrain_status: "queued" }],
    });

    const response = await customSpotCurrentDisplayHandler(request(SPOT_A), context);
    const body = await response.json();

    expect(body.data.displays).toEqual({});
    expect(fetchBulkForecastRowsWithV51Display).not.toHaveBeenCalled();
  });

  it("rejects ids that are not UUIDs", async () => {
    const response = await customSpotCurrentDisplayHandler(request("not-a-uuid"), contextWith({}));
    expect(response.status).toBe(400);
  });
});
