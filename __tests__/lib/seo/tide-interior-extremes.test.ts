import { findNextInteriorTideExtremes, findNextTideExtremes, getTideMetaData, type TideHeightRow } from "@/lib/seo/tide-meta-data";

const rows = (heights: Array<number | null>): TideHeightRow[] =>
  heights.map((tide_height_m, hour) => ({ ts: new Date(Date.UTC(2026, 8, 27, hour)).toISOString(), tide_height_m }));

describe("findNextInteriorTideExtremes", () => {
  it("ignores a falling first point and finds the next interior high and low", () => {
    const result = findNextInteriorTideExtremes(rows([2, 1, 0.5, 1, 2, 1]), new Date(0));
    expect(result.nextLow?.ts).toBe(rows([0, 0, 0])[2].ts);
    expect(result.nextHigh?.ts).toBe(rows([0, 0, 0, 0, 0])[4].ts);
    expect(result.nextHigh?.heightFt).toBeCloseTo(2 * 3.28084, 4);
    expect(findNextInteriorTideExtremes(rows([2, 1, 0.5]), new Date(0)).nextHigh).toBeNull();
  });

  it("ignores a rising first point as a low", () => {
    const result = findNextInteriorTideExtremes(rows([0.5, 1, 2, 1, 0.4, 1]), new Date(0));
    expect(result.nextHigh?.ts).toBe(rows([0, 0, 0])[2].ts);
    expect(result.nextLow?.ts).toBe(rows([0, 0, 0, 0, 0])[4].ts);
    expect(findNextInteriorTideExtremes(rows([0.5, 1, 2]), new Date(0)).nextLow).toBeNull();
  });

  it("returns nothing for flat or monotonic series", () => {
    expect(findNextInteriorTideExtremes(rows([1, 1, 1, 1]), new Date(0))).toEqual({ nextHigh: null, nextLow: null });
    expect(findNextInteriorTideExtremes(rows([1, 2, 3]), new Date(0))).toEqual({ nextHigh: null, nextLow: null });
  });

  it("finds a turn at the first future row using the previous row", () => {
    const series = rows([2, 1, 2]);
    expect(findNextInteriorTideExtremes(series, new Date(series[1].ts)).nextLow?.ts).toBe(series[1].ts);
  });

  it("skips turns before now and still finds a later turn", () => {
    const series = rows([2, 1, 2, 1, 2]);
    const result = findNextInteriorTideExtremes(series, new Date("2026-09-27T01:05:00Z"));
    expect(result.nextLow?.ts).toBe(series[3].ts);
    expect(result.nextHigh?.ts).toBe(series[2].ts);
  });

  it("does not bridge null heights", () => {
    expect(findNextInteriorTideExtremes(rows([2, null, 1, null, 2]), new Date(0))).toEqual({ nextHigh: null, nextLow: null });
  });
});


afterEach(() => jest.useRealTimers());

jest.mock("react", () => ({ ...jest.requireActual("react"), cache: (fn: unknown) => fn }));
jest.mock("@/lib/supabase/server", () => ({ createSupabaseServiceRoleClient: jest.fn() }));
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

function mockTides(series: TideHeightRow[], timezone: string) {
  let from = -Infinity;
  let to = Infinity;
  const query = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { timezone }, error: null }),
    gte: jest.fn(),
    lte: jest.fn(),
    order: jest.fn(async () => ({ data: series.filter(({ ts }) => Date.parse(ts) >= from && Date.parse(ts) <= to), error: null })),
  };
  query.gte.mockImplementation((_column: string, ts: string) => { from = Date.parse(ts); return query; });
  query.lte.mockImplementation((_column: string, ts: string) => { to = Date.parse(ts); return query; });
  (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({ from: () => query });
  return query;
}

describe("getTideMetaData interior turns", () => {
  it("fetches prior context without changing any legacy field", async () => {
    const now = new Date("2026-09-27T22:05:00Z");
    jest.useFakeTimers().setSystemTime(now);
    const series = [2, 1, 2, 1, 2].map((tide_height_m, hour) => ({
      ts: new Date(Date.UTC(2026, 8, 27, 22 + hour)).toISOString(), tide_height_m,
    }));
    const query = mockTides(series, "America/Los_Angeles");
    const result = await getTideMetaData("beach-1");
    expect(query.gte).toHaveBeenCalledWith("ts", "2026-09-27T21:05:00.000Z");
    expect(result.nextInteriorLowTime).toBe("4:00 PM");
    expect(result.nextInteriorLowAt).toBe(series[1].ts);
    const legacy = findNextTideExtremes(series.filter(({ ts }) => Date.parse(ts) >= now.getTime()));
    const time = (ts: string) => new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/Los_Angeles" });
    expect({
      nextHighTime: result.nextHighTime, nextLowTime: result.nextLowTime,
      nextHighHeight: result.nextHighHeight, nextLowHeight: result.nextLowHeight,
    }).toEqual({
      nextHighTime: time(legacy.nextHigh!.ts), nextLowTime: time(legacy.nextLow!.ts),
      nextHighHeight: Math.round(legacy.nextHigh!.heightFt * 10) / 10,
      nextLowHeight: Math.round(legacy.nextLow!.heightFt * 10) / 10,
    });
  });

  it.each([
    ["2026-09-28T03:00:00Z", "8:00 PM", "9:00 PM"],
    ["2026-09-28T11:00:00Z", "Tomorrow 4:00 AM", "Tomorrow 5:00 AM"],
  ])("qualifies %s by the beach's local day, not the UTC date", async (lowAt, lowLabel, highLabel) => {
    // UTC is already September 28; locally it is still September 27.
    jest.useFakeTimers().setSystemTime(new Date("2026-09-28T02:05:00Z"));
    const series = [2, 1, 2, 1].map((tide_height_m, i) => ({
      ts: new Date(Date.parse(lowAt) + (i - 1) * 3_600_000).toISOString(), tide_height_m,
    }));
    mockTides(series, "America/Los_Angeles");
    const result = await getTideMetaData("beach-1");
    expect(result.nextInteriorLowTime).toBe(lowLabel);
    expect(result.nextInteriorHighTime).toBe(highLabel);
  });
});
