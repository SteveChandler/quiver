/**
 * @jest-environment node
 */

// A failed tide or water-temp read is "unknown", not "no data": the readers
// mark it so the sub-page gate stays open, unless this instance's last good
// read found the beach without data.

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
  // Tide reads end at order(); water-temp reads end at single().
  const tideQuery = chain();
  tideQuery.order = jest.fn(next);
  const waterTempQuery = chain();
  waterTempQuery.single = jest.fn(next);
  return {
    from: jest.fn((table: string) => (table === "tide_forecasts" ? tideQuery : waterTempQuery)),
  };
}

const TIMEOUT: QueryResponse = { data: null, error: { message: "canceling statement due to statement timeout" } };
const NO_ROW: QueryResponse = { data: null, error: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" } };
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

describe("getWaterTempMetaData read failures", () => {
  it("marks a failed read unknown when there is no last good read", async () => {
    const { waterTemp, createClient, captureException } = freshModules();
    createClient.mockResolvedValue(client([TIMEOUT]));

    const meta = await waterTemp.getWaterTempMetaData("beach-a");

    expect(meta).toEqual({ tempF: null, wetsuitRec: null, availability: "sub-page-data-unknown" });
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it("marks a failed fallback-day read unknown", async () => {
    const { waterTemp, createClient } = freshModules();
    createClient.mockResolvedValue(client([NO_ROW, TIMEOUT]));

    expect((await waterTemp.getWaterTempMetaData("beach-a")).availability).toBe("sub-page-data-unknown");
  });

  it("marks a failed read unknown when the last good read had a temperature", async () => {
    const { waterTemp, createClient } = freshModules();
    createClient.mockResolvedValue(client([WATER_TEMP_ROW, TIMEOUT]));

    expect((await waterTemp.getWaterTempMetaData("beach-a")).tempF).toBe(64);
    expect((await waterTemp.getWaterTempMetaData("beach-a")).availability).toBe("sub-page-data-unknown");
  });

  it("keeps no data when the last good read found no temperature", async () => {
    const { waterTemp, createClient } = freshModules();
    createClient.mockResolvedValue(client([NO_ROW, NO_ROW, TIMEOUT]));

    await waterTemp.getWaterTempMetaData("beach-a");
    const meta = await waterTemp.getWaterTempMetaData("beach-a");

    expect(meta).toEqual({ tempF: null, wetsuitRec: null });
  });

  it("reports a beach with no rows on either day as no data, without a report", async () => {
    const { waterTemp, createClient, captureException } = freshModules();
    createClient.mockResolvedValue(client([NO_ROW, NO_ROW]));

    expect(await waterTemp.getWaterTempMetaData("beach-a")).toEqual({ tempF: null, wetsuitRec: null });
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
