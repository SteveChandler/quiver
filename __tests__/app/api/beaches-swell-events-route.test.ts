/** @jest-environment node */
// Round-trips JSON like the real data cache, so a Map or Date in the cached value fails a test.
jest.mock("next/cache", () => ({
  unstable_cache: jest.fn((fn: (...args: unknown[]) => Promise<unknown>) =>
    async (...args: unknown[]) => JSON.parse(JSON.stringify(await fn(...args)))),
}));
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(),
  createSupabaseServiceRoleClient: jest.fn(),
}));
jest.mock("@/lib/profile/skill-level", () => ({ getProfileExperienceLevel: jest.fn() }));
jest.mock("@/lib/middleware/api-wrappers", () => ({
  ...jest.requireActual("@/lib/middleware/api-wrappers"),
  withRateLimit: (handler: unknown) => handler,
}));

import { GET } from "@/app/api/beaches/[id]/swell-events/route";
import { historyLine, regionModelBuoy } from "@/lib/alerts/swell-events/early-look";
import { getProfileExperienceLevel } from "@/lib/profile/skill-level";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { RegionSwellEvent, RegionSwellEventsResponse } from "@/types/region-swell-events";
import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";
import { FLAT, NOW, TIMEZONE, dayRows, localDate, localIso, type PartitionSpec } from "@/__tests__/helpers/swell-events";

const REGION = "San Diego";
/** Monday 2026-09-28, three days after NOW. */
const EVENT_DAY = 3;
const EARLY_LOOK_DAY = 12;
const DAYS = Array.from({ length: 14 }, (_, index) => index - 2);
const STORM: PartitionSpec = { heightFt: 7, periodS: 9, direction: 270 };
const STORM_DAY_WAM_M = 3.2;
const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

interface Surf {
  wave: string;
  wind: string;
}

const GOOD: Surf = { wave: "2-3ft", wind: "3 mph" };
// FAIR for an intermediate on the storm day; above a beginner's 4 ft ceiling.
const FOUR_TO_FIVE: Surf = { wave: "4-5ft", wind: "3 mph" };

type TestBeach = ReturnType<typeof beach>;

let nextId = 0;
function beach(name: string) {
  nextId += 1;
  return {
    id: `00000000-0000-4000-8000-${String(nextId).padStart(12, "0")}`,
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    lat: 32.6 + nextId * 0.05,
    lon: -117.25,
    swell_window_center_deg: 270,
    swell_window_halfwidth_deg: 30,
    swell_access_factors: null,
    terrain_enabled: false,
    shoaling_factors: null,
    deepwater_decay_factor: null,
  };
}

function stormRows(beachId: string, surf: Surf = GOOD): Array<Record<string, unknown>> {
  return DAYS.flatMap((day) => {
    const eventDay = day === EVENT_DAY;
    return dayRows(day, eventDay ? STORM : FLAT, { noonBumpFt: eventDay ? 0.5 : 0 }).map((row) => ({
      ...row,
      beach_id: beachId,
      wave_height: surf.wave,
      wave_period: null,
      wind_speed: surf.wind,
      tide_height: null,
      tide_status: null,
      data_source: "open-meteo",
    }));
  });
}

interface Scene {
  lookup: { region: string | null; timezone: string } | null;
  beaches?: TestBeach[];
  rows?: Array<Record<string, unknown>>;
  user?: { id: string } | null;
}

/** Service-role stub: the beach lookup (maybeSingle) and the region's paged reads (range). */
function stage({ lookup, beaches = [], rows = [], user = null }: Scene): { tables: string[] } {
  const tables: string[] = [];
  jest.mocked(createSupabaseServiceRoleClient).mockReturnValue({
    from: (table: string) => {
      tables.push(table);
      let ids: string[] | null = null;
      const query = {
        select: () => query,
        eq: () => query,
        is: () => query,
        or: () => query,
        gte: () => query,
        lt: () => query,
        order: () => query,
        in: (_column: string, values: string[]) => {
          ids = values;
          return query;
        },
        maybeSingle: async () => ({ data: lookup, error: null }),
        range: async (start: number, end: number) => {
          const source = table === "beaches"
            ? beaches
            : rows.filter((row) => !ids || ids.includes(String(row.beach_id)));
          return { data: source.slice(start, end + 1), error: null };
        },
      };
      return query;
    },
  } as never);
  // Auth only: a data read through the request client has no `from` and fails the test.
  jest.mocked(createSupabaseServerClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user }, error: null }) },
  } as never);
  return { tables };
}

/** One WAM hour per local day for 16 days: flat 1 m, 3.2 m on the storm day, a 2.6 m groundswell peak on day 12. */
function wamResponse(): Response {
  const offsets = Array.from({ length: 16 }, (_, offset) => offset);
  return Response.json({
    hourly: {
      time: offsets.map((offset) => Date.parse(localIso(offset, 12)) / 1000),
      wave_height: offsets.map((offset) => ({ [EVENT_DAY]: STORM_DAY_WAM_M, [EARLY_LOOK_DAY]: 2.6 })[offset] ?? 1),
      wave_peak_period: offsets.map(() => 14),
      wave_direction: offsets.map(() => 270),
    },
  });
}

async function call(id: string): Promise<{ status: number; data: RegionSwellEventsResponse }> {
  const response = await GET({} as never, { params: Promise.resolve({ id }) });
  const body = await response.json();
  return { status: response.status, data: body.data };
}

function stormEvent(events: RegionSwellEvent[]): RegionSwellEvent | undefined {
  return events.find((event) => event.kind === "storm" && event.source === "forecast");
}

describe("GET /api/beaches/[id]/swell-events", () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    nextId = 0;
    jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] });
    jest.setSystemTime(NOW);
    global.fetch = jest.fn(async () => Response.json({ hourly: { time: [] } })) as typeof fetch;
  });

  afterEach(() => {
    jest.useRealTimers();
    global.fetch = realFetch;
    jest.clearAllMocks();
  });

  it("returns the region's storm with the requested beach's line, plus a WAM early look", async () => {
    const beaches = [beach("Ocean Beach"), beach("Sunset Cliffs"), beach("Pacific Beach")];
    const { tables } = stage({
      lookup: { region: REGION, timezone: TIMEZONE },
      beaches,
      rows: beaches.flatMap((item) => stormRows(item.id)),
    });
    global.fetch = jest.fn(async () => wamResponse()) as typeof fetch;
    const buoy = regionModelBuoy(beaches)!;

    const { status, data } = await call(beaches[1].id);

    expect(status).toBe(200);
    expect(data).toMatchObject({ region: REGION, buoy: { id: buoy.id, name: buoy.name }, beachCount: 3 });
    const stormHistory = historyLine(buoy, STORM_DAY_WAM_M, TIMEZONE);
    expect(stormHistory).not.toBeNull();
    expect(stormEvent(data.events)).toMatchObject({
      confidence: "on_the_way",
      history: stormHistory,
      leadDays: EVENT_DAY,
      peakLocalDate: localDate(EVENT_DAY),
      here: { beachId: beaches[1].id, beachName: "Sunset Cliffs", label: "GOOD", exposure: "open" },
    });
    expect(data.events.find((event) => event.source === "wam")).toMatchObject({
      kind: "swell",
      confidence: "early_look",
      leadDays: EARLY_LOOK_DAY,
      history: historyLine(buoy, 2.6, TIMEZONE),
      here: { beachId: beaches[1].id, label: "LIKELY" },
    });
    expect(String(jest.mocked(global.fetch).mock.calls[0][0])).toContain("models=ecmwf_wam025");
    // Region data comes from the cookie-free client (R15).
    expect(tables).toContain("enhanced_forecasts");
  });

  it("rates the beaches with a signed-in user's skill", async () => {
    const big = beach("Blacks");
    const beaches = [big, beach("Ocean Beach"), beach("Sunset Cliffs")];
    stage({
      lookup: { region: REGION, timezone: TIMEZONE },
      beaches,
      rows: beaches.flatMap((item) => stormRows(item.id, item.id === big.id ? FOUR_TO_FIVE : GOOD)),
      user: { id: USER_ID },
    });
    jest.mocked(getProfileExperienceLevel).mockResolvedValue("beginner");

    const { data } = await call(big.id);

    expect(getProfileExperienceLevel).toHaveBeenCalledWith(expect.anything(), USER_ID);
    const event = stormEvent(data.events)!;
    expect(event.here).toMatchObject({ label: "MEH", reason: "too big for most" });
    expect(event.working.map((rating) => rating.beachId)).not.toContain(big.id);
  });

  it("rates a signed-out visitor as intermediate", async () => {
    const big = beach("Blacks");
    const beaches = [big, beach("Ocean Beach"), beach("Sunset Cliffs")];
    stage({
      lookup: { region: REGION, timezone: TIMEZONE },
      beaches,
      rows: beaches.flatMap((item) => stormRows(item.id, item.id === big.id ? FOUR_TO_FIVE : GOOD)),
    });

    const { data } = await call(big.id);

    expect(getProfileExperienceLevel).not.toHaveBeenCalled();
    const event = stormEvent(data.events)!;
    expect(event.here).toMatchObject({ label: "FAIR", faceFt: "4-5 ft", reason: null });
    expect(event.working.map((rating) => rating.beachId)).toContain(big.id);
  });

  it("falls back to intermediate when a signed-in user has no skill set", async () => {
    const big = beach("Blacks");
    const beaches = [big, beach("Ocean Beach"), beach("Sunset Cliffs")];
    stage({
      lookup: { region: REGION, timezone: TIMEZONE },
      beaches,
      rows: beaches.flatMap((item) => stormRows(item.id, item.id === big.id ? FOUR_TO_FIVE : GOOD)),
      user: { id: USER_ID },
    });
    jest.mocked(getProfileExperienceLevel).mockResolvedValue(null);

    const { data } = await call(big.id);

    expect(stormEvent(data.events)!.here).toMatchObject({ label: "FAIR" });
  });

  it("returns no events, not an error, for a beach with no region", async () => {
    const { tables } = stage({ lookup: { region: null, timezone: TIMEZONE } });

    const { status, data } = await call("00000000-0000-4000-8000-000000000099");

    expect(status).toBe(200);
    expect(data).toEqual({ region: null, buoy: null, beachCount: 0, events: [] });
    expect(tables).not.toContain("enhanced_forecasts");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns no events for a region with fewer than 3 beaches", async () => {
    const beaches = [beach("Lone Point"), beach("Second Cove")];
    stage({
      lookup: { region: "Tiny Coast", timezone: TIMEZONE },
      beaches,
      rows: beaches.flatMap((item) => stormRows(item.id)),
    });

    const { status, data } = await call(beaches[0].id);

    expect(status).toBe(200);
    expect(data).toEqual({ region: "Tiny Coast", buoy: null, beachCount: 2, events: [] });
  });

  it("keeps the stored-forecast events, without early looks or history, when Open-Meteo is down", async () => {
    const beaches = [beach("Ocean Beach"), beach("Sunset Cliffs"), beach("Pacific Beach")];
    stage({
      lookup: { region: REGION, timezone: TIMEZONE },
      beaches,
      rows: beaches.flatMap((item) => stormRows(item.id)),
    });
    global.fetch = jest.fn(async () => {
      throw new Error("The operation was aborted due to timeout");
    }) as typeof fetch;

    const { status, data } = await call(beaches[0].id);

    expectConsoleWarnings([/Open-Meteo fetch failed/]);
    expect(status).toBe(200);
    expect(data.events).toHaveLength(1);
    expect(data.events[0]).toMatchObject({ kind: "storm", source: "forecast", history: null });
    expect(data.events[0].here).toMatchObject({ beachId: beaches[0].id });
    expect(data.events.some((event) => event.confidence === "early_look" || event.source === "wam")).toBe(false);
  });

  it("returns real error statuses for a bad id or a missing beach", async () => {
    stage({ lookup: null });
    expect((await call("ocean-beach")).status).toBe(400);
    expect((await call("00000000-0000-4000-8000-000000000099")).status).toBe(404);
  });
});
