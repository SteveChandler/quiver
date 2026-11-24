/**
 * @jest-environment node
 *
 * PostgREST caps a read at 1000 rows without saying it truncated, so the shared tide loader
 * chunks beaches to fit one hourly row per beach-hour in a page, and pages each chunk until a
 * short page comes back.
 */

import {
  loadTideSeriesByBeach,
  TIDE_SERIES_PAGE_SIZE,
  type TideSeriesClient,
  type TideSeriesRow,
} from "@/lib/services/tide-series-loader";

const HOUR_MS = 3_600_000;
const START = "2026-10-27T00:00:00.000Z";

interface RecordedQuery {
  table: string;
  columns: string;
  beachIds: string[];
  gte: [string, string] | null;
  lt: [string, string] | null;
  orders: string[];
  range: [number, number] | null;
}

/** A stub that serves `rows` the way PostgREST would: filtered, ordered, sliced, capped at 1000. */
function fakeClient(rows: TideSeriesRow[], failOn?: (query: RecordedQuery) => boolean) {
  const queries: RecordedQuery[] = [];
  const client = {
    from(table: string) {
      const query: RecordedQuery = { table, columns: "", beachIds: [], gte: null, lt: null, orders: [], range: null };
      queries.push(query);
      const builder = {
        in(_column: string, values: string[]) { query.beachIds = values; return builder; },
        gte(column: string, value: string) { query.gte = [column, value]; return builder; },
        lt(column: string, value: string) { query.lt = [column, value]; return builder; },
        order(column: string) { query.orders.push(column); return builder; },
        async range(from: number, to: number) {
          query.range = [from, to];
          if (failOn?.(query)) return { data: null, error: { message: "boom" } };
          const start = Date.parse(query.gte?.[1] ?? "");
          const end = Date.parse(query.lt?.[1] ?? "");
          const matching = rows
            .filter((row) => query.beachIds.includes(row.beach_id) && Date.parse(row.ts) >= start && Date.parse(row.ts) < end)
            .sort((a, b) => a.beach_id.localeCompare(b.beach_id) || Date.parse(a.ts) - Date.parse(b.ts) || (a.source ?? "").localeCompare(b.source ?? ""));
          return { data: matching.slice(from, Math.min(to + 1, from + 1000)), error: null };
        },
      };
      return { select(columns: string) { query.columns = columns; return builder; } };
    },
  };
  return { client: client as unknown as TideSeriesClient, queries };
}

function hourlyRows(beachId: string, hours: number, source = "noaa", stationId = "9410230"): TideSeriesRow[] {
  return Array.from({ length: hours }, (_, hour) => ({
    beach_id: beachId,
    ts: new Date(Date.parse(START) + hour * HOUR_MS).toISOString(),
    tide_ft: 2 + hour / 10,
    tide_height_m: null,
    source,
    station_id: stationId,
    created_at: "2026-10-26T04:00:00Z",
  }));
}

const endAfter = (hours: number): string => new Date(Date.parse(START) + hours * HOUR_MS).toISOString();

describe("loadTideSeriesByBeach", () => {
  it("chunks beaches so beaches x hours fits one page and reads every beach", async () => {
    // 48 h window: 20 beaches per chunk; 45 beaches take 3 chunks.
    const beachIds = Array.from({ length: 45 }, (_, index) => `beach-${String(index).padStart(2, "0")}`);
    const rows = beachIds.flatMap((id) => hourlyRows(id, 48));
    const { client, queries } = fakeClient(rows);
    const series = await loadTideSeriesByBeach(client, beachIds, START, endAfter(48));

    expect(queries.map((query) => query.beachIds.length)).toEqual([20, 20, 5]);
    expect(queries.flatMap((query) => query.beachIds)).toEqual(beachIds);
    for (const query of queries) {
      expect(query.table).toBe("tide_forecasts");
      expect(query.gte).toEqual(["ts", START]);
      expect(query.lt).toEqual(["ts", endAfter(48)]);
      expect(query.orders).toEqual(["beach_id", "ts", "source"]);
      expect(query.range).toEqual([0, TIDE_SERIES_PAGE_SIZE - 1]);
      expect(query.columns).toContain("beach_id");
    }
    expect(series.size).toBe(45);
    for (const id of beachIds) expect(series.get(id)).toHaveLength(48);
    expect(series.get("beach-07")?.[3]).toEqual({ ts: new Date(Date.parse(START) + 3 * HOUR_MS).toISOString(), heightFt: 2.3 });
  });

  it("pages a chunk past 1000 rows when several sources share each hour", async () => {
    // 20 beaches x 48 h x 2 sources = 1920 rows in one chunk: two full-ish pages.
    const beachIds = Array.from({ length: 20 }, (_, index) => `b${String(index).padStart(2, "0")}`);
    const rows = beachIds.flatMap((id) => [
      ...hourlyRows(id, 48, "noaa"),
      ...hourlyRows(id, 48, "noaa_hilo_interpolated").map((row) => ({ ...row, tide_ft: 99 })),
    ]);
    const { client, queries } = fakeClient(rows);
    const series = await loadTideSeriesByBeach(client, beachIds, START, endAfter(48));

    expect(queries.map((query) => query.range)).toEqual([[0, 999], [1000, 1999]]);
    expect(series.size).toBe(20);
    for (const id of beachIds) {
      const samples = series.get(id) ?? [];
      expect(samples).toHaveLength(48);
      // noaa beats hilo every hour, so no 99 ft hilo height leaks in from either page.
      expect(samples.every((sample) => sample.heightFt < 99)).toBe(true);
    }
  });

  it("selects the station per beach, not across the chunk", async () => {
    const old = { created_at: "2026-09-01T00:00:00Z" };
    const rows = [
      // "a" moved from station OLD to NEW; its stale OLD rows survive under the other source.
      ...hourlyRows("a", 3, "noaa_hilo_interpolated", "OLD").map((row) => ({ ...row, ...old, tide_ft: 9 })),
      ...hourlyRows("a", 3, "noaa", "NEW"),
      ...hourlyRows("b", 3, "noaa", "OLD").map((row) => ({ ...row, ...old })),
    ];
    const series = await loadTideSeriesByBeach(fakeClient(rows).client, ["a", "b"], START, endAfter(3));
    expect(series.get("a")?.map((sample) => sample.heightFt)).toEqual([2, 2.1, 2.2]);
    // "b" only has the OLD station; a cross-chunk selection would have dropped it for NEW.
    expect(series.get("b")).toHaveLength(3);
  });

  it("converts metres when tide_ft is missing and drops beaches with no usable sample", async () => {
    const rows: TideSeriesRow[] = [
      { beach_id: "m", ts: START, tide_ft: null, tide_height_m: 1, source: "noaa", station_id: "S", created_at: "2026-10-26T00:00:00Z" },
      { beach_id: "empty", ts: START, tide_ft: null, tide_height_m: null, source: "noaa", station_id: "S", created_at: "2026-10-26T00:00:00Z" },
    ];
    const series = await loadTideSeriesByBeach(fakeClient(rows).client, ["m", "empty", "none"], START, endAfter(1));
    expect(series.get("m")?.[0].heightFt).toBeCloseTo(3.28084, 4);
    expect(series.has("empty")).toBe(false);
    expect(series.has("none")).toBe(false);
  });

  it("reads each beach once even when listed twice", async () => {
    const { client, queries } = fakeClient(hourlyRows("a", 2));
    await loadTideSeriesByBeach(client, ["a", "a"], START, endAfter(2));
    expect(queries).toHaveLength(1);
    expect(queries[0].beachIds).toEqual(["a"]);
  });

  it("throws the read error so each caller keeps its own failure policy", async () => {
    const { client } = fakeClient(hourlyRows("a", 2), () => true);
    await expect(loadTideSeriesByBeach(client, ["a"], START, endAfter(2))).rejects.toThrow("boom");
  });
});
