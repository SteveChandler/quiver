/**
 * @jest-environment node
 */

// A failed tide or water-temp read is "unknown", not "no data": the readers
// mark it so the sub-page gate stays open, unless this instance's last good
// read found the beach without data.

import { PostgrestClient } from "@supabase/postgrest-js";

type TideModule = typeof import("@/lib/seo/tide-meta-data");
type WaterTempModule = typeof import("@/lib/seo/water-temp-meta-data");

interface Fresh {
  tides: TideModule;
  waterTemp: WaterTempModule;
  createClient: jest.Mock;
  captureException: jest.Mock;
}

// Each test gets fresh modules: the last good stores and the report window are
// module state.
function freshModules(): Fresh {
  let loaded: Fresh | undefined;
  jest.isolateModules(() => {
    jest.doMock("@sentry/nextjs", () => ({ captureException: jest.fn() }));
    jest.doMock("@/lib/supabase/server", () => ({ createSupabaseServiceRoleClient: jest.fn() }));
    jest.doMock("@/lib/utils/timezone-utils.server", () => ({ getTimezoneFromCoords: jest.fn(() => null) }));
    loaded = {
      tides: require("@/lib/seo/tide-meta-data"),
      waterTemp: require("@/lib/seo/water-temp-meta-data"),
      createClient: require("@/lib/supabase/server").createSupabaseServiceRoleClient,
      captureException: require("@sentry/nextjs").captureException,
    };
  });
  return loaded!;
}

type QueryResponse = { data: unknown; error: { code?: string; message: string } | null };

/** Chainable queries whose terminal call resolves to the next queued response. */
function client(responses: QueryResponse[]) {
  const next = async () => responses.shift() ?? { data: null, error: { message: "no response queued" } };
  const chain = () => {
    const query: Record<string, jest.Mock> = {};
    for (const method of ["select", "eq", "gte", "lt", "lte", "not", "limit", "order"]) {
      query[method] = jest.fn(() => query);
    }
    return query;
  };
  // Tide reads end at order(); water-temp reads end at maybeSingle().
  const tideQuery = chain();
  tideQuery.order = jest.fn(next);
  const waterTempQuery = chain();
  waterTempQuery.maybeSingle = jest.fn(next);
  return {
    from: jest.fn((table: string) => (table === "tide_forecasts" ? tideQuery : waterTempQuery)),
    waterTempQuery,
  };
}

const TIMEOUT: QueryResponse = { data: null, error: { message: "canceling statement due to statement timeout" } };
const TIDE_ROWS: QueryResponse = {
  data: [0.5, 1.5, 0.5].map((tide_height_m, i) => ({
    ts: new Date(Date.UTC(2026, 10, 12, 18 + i)).toISOString(),
    tide_height_m,
  })),
  error: null,
};
const WATER_TEMP_ROW: QueryResponse = { data: { water_temp: "64" }, error: null };

let consoleError: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers({ now: new Date("2026-11-12T17:30:00.000Z") });
  consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  consoleError.mockRestore();
  jest.useRealTimers();
});

describe("getTideMetaData read failures", () => {
  it("marks a failed read unknown when there is no last good read", async () => {
    const { tides, createClient, captureException } = freshModules();
    createClient.mockResolvedValue(client([TIMEOUT]));

    const meta = await tides.getTideMetaData("beach-a", "America/Los_Angeles");

    expect(meta).toMatchObject({ nextHighTime: null, nextLowTime: null, availability: "sub-page-data-unknown" });
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException.mock.calls[0][1]).toMatchObject({ level: "warning" });
  });

  it("marks a failed read unknown when the last good read had tides", async () => {
    const { tides, createClient } = freshModules();
    createClient.mockResolvedValue(client([TIDE_ROWS, TIMEOUT]));

    expect((await tides.getTideMetaData("beach-a", "America/Los_Angeles")).nextHighTime).not.toBeNull();
    const meta = await tides.getTideMetaData("beach-a", "America/Los_Angeles");

    // The old times are not replayed into the title.
    expect(meta).toMatchObject({ nextHighTime: null, availability: "sub-page-data-unknown" });
  });

  it("keeps no data when the last good read found no tides", async () => {
    const { tides, createClient } = freshModules();
    createClient.mockResolvedValue(client([{ data: [], error: null }, TIMEOUT]));

    await tides.getTideMetaData("beach-a", "America/Los_Angeles");
    const meta = await tides.getTideMetaData("beach-a", "America/Los_Angeles");

    expect(meta.availability).toBeUndefined();
    expect(meta.nextHighTime).toBeNull();
  });

  it("reports a beach with no tide rows as no data, without a report", async () => {
    const { tides, createClient, captureException } = freshModules();
    createClient.mockResolvedValue(client([{ data: [], error: null }]));

    const meta = await tides.getTideMetaData("beach-a", "America/Los_Angeles");

    expect(meta.availability).toBeUndefined();
    expect(meta.nextHighTime).toBeNull();
    expect(captureException).not.toHaveBeenCalled();
  });

  it("marks a failed client creation unknown", async () => {
    const { tides, createClient } = freshModules();
    createClient.mockRejectedValue(new Error("missing service role key"));

    expect((await tides.getTideMetaData("beach-a", "America/Los_Angeles")).availability)
      .toBe("sub-page-data-unknown");
  });

  it("lets an unrelated TypeError propagate without a report", async () => {
    const { tides, createClient, captureException } = freshModules();
    // Rows that are not an array: processing them is a code bug, not a failed read.
    createClient.mockResolvedValue(client([{ data: { not: "rows" }, error: null }]));

    await expect(tides.getTideMetaData("beach-a", "America/Los_Angeles")).rejects.toThrow(TypeError);
    expect(captureException).not.toHaveBeenCalled();
  });
});

describe("programming errors inside the read", () => {
  // A client without from(): the query call itself throws a TypeError. That is
  // a code bug, not an outage, so it is not wrapped as a failed read.
  it("lets a TypeError from the tide query propagate without a report", async () => {
    const { tides, createClient, captureException } = freshModules();
    createClient.mockResolvedValue({});

    await expect(tides.getTideMetaData("beach-a", "America/Los_Angeles")).rejects.toThrow(TypeError);
    expect(captureException).not.toHaveBeenCalled();
  });

  it("lets a TypeError from the water-temp query propagate without a report", async () => {
    const { waterTemp, createClient, captureException } = freshModules();
    createClient.mockResolvedValue({});

    await expect(waterTemp.getWaterTempMetaData("beach-a")).rejects.toThrow(TypeError);
    expect(captureException).not.toHaveBeenCalled();
  });

  it("lets a ReferenceError from client creation propagate without a report", async () => {
    const { tides, createClient, captureException } = freshModules();
    createClient.mockRejectedValue(new ReferenceError("supabaseUrl is not defined"));

    await expect(tides.getTideMetaData("beach-a", "America/Los_Angeles")).rejects.toThrow(ReferenceError);
    expect(captureException).not.toHaveBeenCalled();
  });
});

describe("getWaterTempMetaData", () => {
  it.each([
    ["before UTC midnight", "2026-11-12T23:59:59.999Z", "2026-11-11", "2026-11-13"],
    ["at UTC midnight", "2026-11-13T00:00:00.000Z", "2026-11-12", "2026-11-14"],
    ["after the year changes", "2027-01-01T00:00:00.000Z", "2026-12-31", "2027-01-02"],
  ])("reads the newest non-null value across both days in one query %s", async (_label, now, from, to) => {
    jest.setSystemTime(new Date(now));
    const { waterTemp, createClient } = freshModules();
    const db = client([WATER_TEMP_ROW]);
    createClient.mockResolvedValue(db);

    expect(await waterTemp.getWaterTempMetaData("beach-a")).toEqual({
      tempF: 64,
      wetsuitRec: "3/2mm fullsuit",
    });
    expect(db.from).toHaveBeenCalledTimes(1);
    expect(db.from).toHaveBeenCalledWith("enhanced_forecasts");
    expect(db.waterTempQuery.eq).toHaveBeenCalledWith("beach_id", "beach-a");
    expect(db.waterTempQuery.gte).toHaveBeenCalledWith("forecast_at", `${from}T00:00:00.000Z`);
    expect(db.waterTempQuery.lt).toHaveBeenCalledWith("forecast_at", `${to}T00:00:00.000Z`);
    expect(db.waterTempQuery.not).toHaveBeenCalledWith("water_temp", "is", null);
    expect(db.waterTempQuery.order).toHaveBeenCalledWith("forecast_at", { ascending: false });
    expect(db.waterTempQuery.limit).toHaveBeenCalledWith(1);
    expect(db.waterTempQuery.maybeSingle).toHaveBeenCalledTimes(1);
  });

  it("does not look for an older value after selecting an unparseable newest value", async () => {
    const { waterTemp, createClient, captureException } = freshModules();
    const db = client([{ data: { water_temp: "invalid" }, error: null }, WATER_TEMP_ROW]);
    createClient.mockResolvedValue(db);

    expect(await waterTemp.getWaterTempMetaData("beach-a")).toEqual({ tempF: null, wetsuitRec: null });
    expect(db.waterTempQuery.maybeSingle).toHaveBeenCalledTimes(1);
    expect(captureException).not.toHaveBeenCalled();
  });

  it.each([["today", true], ["only yesterday", false]] as const)(
    "uses one PostgREST request when a non-null row exists %s",
    async (_day, hasTodayValue) => {
      jest.setSystemTime(new Date("2026-11-13T12:00:00.000Z"));
      const { waterTemp, createClient } = freshModules();
      const rows = [
        { forecast_at: "2026-11-12T18:00:00.000Z", water_temp: "64" },
        { forecast_at: "2026-11-13T18:00:00.000Z", water_temp: hasTodayValue ? "68" : null },
        { forecast_at: "2026-11-14T00:00:00.000Z", water_temp: "79" },
      ];
      const fetch = jest.fn(async (input: RequestInfo | URL) => {
        const query = new URL(String(input)).searchParams;
        const [lower, upper] = query.getAll("forecast_at");
        const selected = rows.filter(({ forecast_at, water_temp }) =>
          forecast_at >= lower.slice(4) && forecast_at < upper.slice(3)
          && (query.get("water_temp") !== "not.is.null" || water_temp !== null),
        );
        if (query.get("order") === "forecast_at.desc") selected.reverse();
        return Response.json(selected.slice(0, Number(query.get("limit"))));
      });
      createClient.mockReturnValue(new PostgrestClient("https://unit-test.supabase.co/rest/v1", { fetch }));

      const result = await waterTemp.getWaterTempMetaData("beach-a");
      expect(result.tempF).toBe(hasTodayValue ? 68 : 64);
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );

  it("marks a failed read unknown when there is no last good read", async () => {
    const { waterTemp, createClient, captureException } = freshModules();
    createClient.mockResolvedValue(client([TIMEOUT]));

    const meta = await waterTemp.getWaterTempMetaData("beach-a");

    expect(meta).toEqual({ tempF: null, wetsuitRec: null, availability: "sub-page-data-unknown" });
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it("marks a failed read unknown when the last good read had a temperature", async () => {
    const { waterTemp, createClient } = freshModules();
    createClient.mockResolvedValue(client([WATER_TEMP_ROW, TIMEOUT]));

    expect((await waterTemp.getWaterTempMetaData("beach-a")).tempF).toBe(64);
    expect((await waterTemp.getWaterTempMetaData("beach-a")).availability).toBe("sub-page-data-unknown");
  });

  it("keeps no data when the last good read found no temperature", async () => {
    const { waterTemp, createClient } = freshModules();
    createClient.mockResolvedValue(client([{ data: null, error: null }, TIMEOUT]));

    await waterTemp.getWaterTempMetaData("beach-a");
    const meta = await waterTemp.getWaterTempMetaData("beach-a");

    expect(meta).toEqual({ tempF: null, wetsuitRec: null });
  });

  it("reports a beach with no rows on either day as no data, without a report", async () => {
    const { waterTemp, createClient, captureException } = freshModules();
    const db = client([{ data: null, error: null }]);
    createClient.mockResolvedValue(db);

    expect(await waterTemp.getWaterTempMetaData("beach-a")).toEqual({ tempF: null, wetsuitRec: null });
    expect(db.waterTempQuery.maybeSingle).toHaveBeenCalledTimes(1);
    expect(captureException).not.toHaveBeenCalled();
  });

  it("lets an unrelated TypeError propagate without a report", async () => {
    const { waterTemp, createClient, captureException } = freshModules();
    // A row that is not a string: parsing it is a code bug, not a failed read.
    createClient.mockResolvedValue(client([{ data: { water_temp: { celsius: 18 } }, error: null }]));

    await expect(waterTemp.getWaterTempMetaData("beach-a")).rejects.toThrow(TypeError);
    expect(captureException).not.toHaveBeenCalled();
  });
});

describe("sub-page read failure reports", () => {
  it("sends one Sentry warning per five minutes and logs the suppressed count", async () => {
    const { tides, createClient, captureException } = freshModules();
    createClient.mockResolvedValue(client([TIMEOUT, TIMEOUT, TIMEOUT, TIMEOUT]));

    await tides.getTideMetaData("beach-a", "America/Los_Angeles");
    await tides.getTideMetaData("beach-b", "America/Los_Angeles");
    await tides.getTideMetaData("beach-c", "America/Los_Angeles");
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(5 * 60 * 1000);
    await tides.getTideMetaData("beach-d", "America/Los_Angeles");

    expect(captureException).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenLastCalledWith(
      expect.stringContaining("getTideMetaData"),
      { suppressedSinceLastReport: 2 },
    );
  });
});
