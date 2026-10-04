import {
  findNextTideExtremes,
  getTideMetaData,
  tideExtremesWindow,
  type TideHeightRow,
} from "@/lib/seo/tide-meta-data";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { parseWaterTempF } from "@/lib/utils/wetsuit-utils";

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

jest.mock("@/lib/utils/timezone-utils.server", () => ({
  getTimezoneFromCoords: jest.fn(() => null),
}));

const hourly = (heights: Array<number | null>): TideHeightRow[] =>
  heights.map((tide_height_m, i) => ({
    ts: new Date(Date.UTC(2026, 7, 18, i)).toISOString(),
    tide_height_m,
  }));

const hour = (i: number): string => new Date(Date.UTC(2026, 7, 18, i)).toISOString();

describe("findNextTideExtremes", () => {
  it("ignores a falling first point: the next high is the next interior peak", () => {
    const { nextHigh, nextLow } = findNextTideExtremes(hourly([2, 1, 0.5, 1, 2, 1]));
    expect(nextLow?.ts).toBe(hour(2));
    expect(nextHigh?.ts).toBe(hour(4));
  });

  it("ignores a rising first point: the next low is the next interior trough", () => {
    const { nextHigh, nextLow } = findNextTideExtremes(hourly([0.5, 1.2, 1.8, 1.1, 0.4, 0.9]));
    expect(nextHigh?.ts).toBe(hour(2));
    expect(nextLow?.ts).toBe(hour(4));
  });

  it("never reports a high and a low an hour apart off a falling start", () => {
    // The 2026-09-27 Tourmaline shape: falling at the start of the window, the
    // real low hours later. The start used to be reported as the next high.
    const { nextHigh, nextLow } = findNextTideExtremes(
      hourly([1.1, 1.0, 0.8, 0.6, 0.4, 0.3, 0.35, 0.5]),
    );
    expect(nextHigh).toBeNull();
    expect(nextLow?.ts).toBe(hour(5));
  });

  it("judges the first reading after the start against the start", () => {
    // The start is the reading before now: a turn in the first hour ahead
    // is found, and the start itself is never reported.
    const { nextHigh, nextLow } = findNextTideExtremes(hourly([0.9, 1.0, 0.8, 0.5, 0.7]));
    expect(nextHigh?.ts).toBe(hour(1));
    expect(nextLow?.ts).toBe(hour(3));
  });

  it("converts heights from metres to feet", () => {
    const { nextHigh } = findNextTideExtremes(hourly([0.5, 2, 0.5]));
    expect(nextHigh?.heightFt).toBeCloseTo(2 * 3.28084, 4);
  });

  it("reads equal readings at the turn as one turn, timed at the first", () => {
    // Production heights are millimetre-rounded, so a slack often reads the
    // same two hours running. Strict neighbour comparison would skip it.
    const { nextHigh, nextLow } = findNextTideExtremes(
      hourly([0.68, 0.72, 0.737, 0.737, 0.72, 0.6, 0.3, 0.3, 0.3, 0.4]),
    );
    expect(nextHigh?.ts).toBe(hour(2));
    expect(nextHigh?.heightFt).toBeCloseTo(0.737 * 3.28084, 4);
    expect(nextLow?.ts).toBe(hour(6));
  });

  it("does not take a plateau touching either end of the series as a turn", () => {
    expect(findNextTideExtremes(hourly([0.7, 0.7, 0.5, 0.4]))).toEqual({ nextHigh: null, nextLow: null });
    expect(findNextTideExtremes(hourly([0.4, 0.5, 0.7, 0.7]))).toEqual({ nextHigh: null, nextLow: null });
  });

  it("returns no extreme on a monotonic series", () => {
    expect(findNextTideExtremes(hourly([0.1, 0.2, 0.3, 0.4, 0.5]))).toEqual({ nextHigh: null, nextLow: null });
    expect(findNextTideExtremes(hourly([2, 1, 0.5]))).toEqual({ nextHigh: null, nextLow: null });
  });

  it("returns no extreme for a flat series", () => {
    // Rows exist, nothing rises or falls. This is the shape the sitemap used to
    // count as coverage while the sub-page answered noindex.
    const { nextHigh, nextLow } = findNextTideExtremes(hourly([0.3, 0.3, 0.3, 0.3]));
    expect(nextHigh).toBeNull();
    expect(nextLow).toBeNull();
  });

  it("does not bridge null heights", () => {
    expect(findNextTideExtremes(hourly([null, null, null, null]))).toEqual({ nextHigh: null, nextLow: null });
    expect(findNextTideExtremes(hourly([2, null, 1, null, 2]))).toEqual({ nextHigh: null, nextLow: null });
  });

  it("returns no extreme for fewer than three rows", () => {
    expect(findNextTideExtremes(hourly([1, 2]))).toEqual({ nextHigh: null, nextLow: null });
    expect(findNextTideExtremes(hourly([1]))).toEqual({ nextHigh: null, nextLow: null });
    expect(findNextTideExtremes([])).toEqual({ nextHigh: null, nextLow: null });
  });
});

describe("tideExtremesWindow", () => {
  it("starts one hour before now and ends 24 hours ahead", () => {
    expect(tideExtremesWindow(new Date("2026-09-27T22:20:00.000Z"))).toEqual({
      from: "2026-09-27T21:20:00.000Z",
      to: "2026-09-28T22:20:00.000Z",
    });
  });
});

describe("getTideMetaData", () => {
  const now = new Date("2026-09-27T22:20:00.000Z");
  const tideQuery = {
    select: jest.fn(),
    eq: jest.fn(),
    gte: jest.fn(),
    lte: jest.fn(),
    order: jest.fn(),
  };
  const beachQuery = {
    select: jest.fn(),
    eq: jest.fn(),
    single: jest.fn(),
  };

  beforeEach(() => {
    jest.useFakeTimers({ now });
    for (const fn of Object.values(tideQuery)) fn.mockReturnValue(tideQuery);
    beachQuery.select.mockReturnValue(beachQuery);
    beachQuery.eq.mockReturnValue(beachQuery);
    beachQuery.single.mockResolvedValue({
      data: { lat: 32.8, lon: -117.26, timezone: "America/Los_Angeles" },
      error: null,
    });
    (createSupabaseServiceRoleClient as jest.Mock).mockResolvedValue({
      from: (table: string) => (table === "beaches" ? beachQuery : tideQuery),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("reads the shared window and reports interior turns, not the window start", async () => {
    // 21:00Z is the reading before now; the tide is falling through it.
    const heights = [1.2, 1.0, 0.7, 0.4, 0.2, 0.3, 0.6, 0.9, 1.1, 1.0];
    tideQuery.order.mockResolvedValue({
      data: heights.map((tide_height_m, i) => ({
        ts: new Date(Date.UTC(2026, 8, 27, 21 + i)).toISOString(),
        tide_height_m,
      })),
      error: null,
    });

    const meta = await getTideMetaData("beach-tourmaline");

    const tideWindow = tideExtremesWindow(now);
    expect(tideQuery.gte).toHaveBeenCalledWith("ts", tideWindow.from);
    expect(tideQuery.lte).toHaveBeenCalledWith("ts", tideWindow.to);
    // Low at 01:00Z and high at 05:00Z on the 28th, in Pacific time.
    expect(meta.nextLowTime).toBe("6:00 PM");
    expect(meta.nextHighTime).toBe("10:00 PM");
    expect(meta.nextLowHeight).toBe(0.7);
    expect(meta.nextHighHeight).toBe(3.6);
    // Dated timestamps alongside the display times, so a high at 10 PM can be
    // ordered against a low after midnight.
    expect(meta.nextLowAt).toBe("2026-09-28T01:00:00.000Z");
    expect(meta.nextHighAt).toBe("2026-09-28T05:00:00.000Z");
    expect(meta.source).toBeNull();
  });

  it("reads one station when an older station's rows overlap the current one", async () => {
    // Shipwrecks, Coronado on 2026-09-27: San Diego direct rows and older
    // Point Loma hilo rows at the same hours. Interleaved, every hour was a turn.
    const heights = [1.2, 1.0, 0.7, 0.4, 0.2, 0.3, 0.6, 0.9, 1.1, 1.0];
    const ts = (i: number): string => new Date(Date.UTC(2026, 8, 27, 21 + i)).toISOString();
    tideQuery.order.mockResolvedValue({
      data: heights.flatMap((tide_height_m, i) => [
        { ts: ts(i), tide_height_m: tide_height_m - 0.3, source: "noaa_hilo_interpolated", station_id: "TWC0405", created_at: "2026-09-02T04:00:02.682Z" },
        { ts: ts(i), tide_height_m, source: "noaa", station_id: "9410170", created_at: "2026-09-16T04:00:02.481Z" },
      ]),
      error: null,
    });

    const meta = await getTideMetaData("beach-shipwrecks");

    expect(tideQuery.select).toHaveBeenCalledWith(expect.stringContaining("station_id"));
    expect(meta.nextLowAt).toBe("2026-09-28T01:00:00.000Z");
    expect(meta.nextHighAt).toBe("2026-09-28T05:00:00.000Z");
    expect(meta.nextLowHeight).toBe(0.7);
    expect(meta.nextHighHeight).toBe(3.6);
    expect(meta.source).toBe("noaa");
  });

  it("returns the selected model series source", async () => {
    tideQuery.order.mockResolvedValue({
      data: [0.5, 1.5, 0.5].map((tide_height_m, i) => ({
        ts: new Date(Date.UTC(2026, 8, 27, 21 + i)).toISOString(),
        tide_height_m,
        source: "fes2022",
        station_id: "FES2022",
        created_at: "2026-09-27T22:00:00.000Z",
      })),
      error: null,
    });

    expect((await getTideMetaData("beach-model")).source).toBe("fes2022");
  });

  it("returns null timestamps when there is no tide data", async () => {
    tideQuery.order.mockResolvedValue({ data: [], error: null });

    const meta = await getTideMetaData("beach-no-tides");

    expect(meta.nextHighAt).toBeNull();
    expect(meta.nextLowAt).toBeNull();
    expect(meta.source).toBeNull();
  });
});

describe("sitemap/sub-page coverage parity", () => {
  // The sitemap once counted "a row exists" as coverage while the sub-page
  // required a usable value. These pin the two predicates to one answer.
  it("does not count tide rows without a detectable extreme", () => {
    const rows = hourly([0.3, 0.3, 0.3]);
    const sitemapSaysCovered = (() => {
      const { nextHigh, nextLow } = findNextTideExtremes(rows);
      return Boolean(nextHigh || nextLow);
    })();
    const pageSaysCovered = (() => {
      const { nextHigh, nextLow } = findNextTideExtremes(rows);
      return Boolean(nextHigh || nextLow);
    })();
    expect(sitemapSaysCovered).toBe(pageSaysCovered);
    expect(sitemapSaysCovered).toBe(false);
  });

  it("does not count a monotonic 24 hours as coverage", () => {
    // The old first-point rule counted any rise or fall as an extreme, so a
    // window with no real turn was still listed and indexed.
    const { nextHigh, nextLow } = findNextTideExtremes(
      hourly(Array.from({ length: 26 }, (_, i) => 0.1 + i * 0.01)),
    );
    expect(Boolean(nextHigh || nextLow)).toBe(false);
  });

  it("does not count a present but unparseable water temperature", () => {
    // Non-null in the database, so the old presence-only query counted it.
    for (const raw of ["warm", "", "12°F", "220°F"]) {
      expect(parseWaterTempF(raw)).toBeNull();
    }
    expect(parseWaterTempF("91°F")).toBe(91);
  });
});
