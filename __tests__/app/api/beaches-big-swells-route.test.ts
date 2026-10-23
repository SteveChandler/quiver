/** @jest-environment node */
import { GET } from "@/app/api/beaches/[id]/big-swells/route";
import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: jest.fn() }));
jest.mock("@/lib/middleware/api-wrappers", () => ({
  ...jest.requireActual("@/lib/middleware/api-wrappers"),
  withRateLimit: (handler: unknown) => handler,
}));
jest.mock("@/lib/data/big-swells.json", () => ({
  stations: [
    {
      id: "44065",
      name: "New York Harbor Entrance",
      lat: 40.368,
      lon: -73.701,
      since: "2008-10-30",
      through: "2026-10-23",
      bigHsM: 3,
      biggest: [
        { at: "2012-10-30T00:00:00.000Z", hsM: 9.86, periodS: 13.79, dirDeg: 121 },
        { at: "2010-03-13T23:00:00.000Z", hsM: 5.94, periodS: 10, dirDeg: 126 },
      ],
      recent: [{ at: "2026-09-26T08:50:00.000Z", hsM: 4.5, periodS: 10, dirDeg: 108 }],
    },
  ],
}));

const BELMAR = "fb0ee60f-a269-47ed-b244-e8dc64fff891";
const mockClient = createSupabaseServerClient as jest.Mock;

function beachRow(row: { lat: number; lon: number } | null): void {
  const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: row, error: null }) };
  mockClient.mockResolvedValue({ from: () => chain });
}

function call(id: string): Promise<Response> {
  return GET({} as never, { params: Promise.resolve({ id }) });
}

describe("GET /api/beaches/[id]/big-swells", () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
    jest.clearAllMocks();
  });

  it("compares this week's peak at the buoy with the buoy's measured big swells", async () => {
    beachRow({ lat: 40.176, lon: -74.013 });
    const soon = new Date(Date.now() + 6 * 3_600_000).toISOString().slice(0, 13) + ":00";
    const later = new Date(Date.now() + 30 * 3_600_000).toISOString().slice(0, 13) + ":00";
    global.fetch = jest.fn(async () =>
      Response.json({
        hourly: { time: [soon, later], wave_height: [2, 4.6], wave_peak_period: [9, 11.5], wave_direction: [90, 110] },
      }),
    ) as typeof fetch;

    const response = await call(BELMAR);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(String((global.fetch as jest.Mock).mock.calls[0][0])).toContain("models=ecmwf_wam025");
    expect(body.data.buoy).toMatchObject({ id: "44065", distanceKm: 34, since: "2008-10-30" });
    expect(body.data.forecast).toMatchObject({
      hsM: 4.6,
      periodS: 11.5,
      isBig: true,
      rank: null,
      closest: { at: "2026-09-26T08:50:00.000Z", hsM: 4.5 },
    });
  });

  it("still returns the history when the forecast is unavailable", async () => {
    beachRow({ lat: 40.176, lon: -74.013 });
    global.fetch = jest.fn(async () => new Response("down", { status: 503 })) as typeof fetch;

    const body = await (await call(BELMAR)).json();
    expectConsoleWarnings([/Open-Meteo HTTP failure/]);
    expect(body.data.forecast).toBeNull();
    expect(body.data.biggest).toHaveLength(2);
  });

  it("returns an empty history, not an error, when no buoy is within 100 km", async () => {
    beachRow({ lat: 21.3, lon: -157.8 });
    global.fetch = jest.fn() as typeof fetch;

    const response = await call(BELMAR);
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ buoy: null, bigHsM: null, biggest: [], recent: [], forecast: null });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns real error statuses for a bad id or a missing beach", async () => {
    expect((await call("belmar")).status).toBe(400);

    beachRow(null);
    expect((await call(BELMAR)).status).toBe(404);
  });
});
