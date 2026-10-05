import {
  detectBeachSwellEvents,
  loadSwellForecastRows,
  type SwellEventForecastRow,
} from "@/lib/alerts/swell-events";
import {
  FLAT,
  NOW,
  TIMEZONE,
  dayRows,
  swellBeach,
  type PartitionSpec,
} from "@/__tests__/helpers/swell-events";

const PEAK: PartitionSpec = { heightFt: 4, periodS: 16, direction: 270 };

function week(source: string | null | undefined): SwellEventForecastRow[] {
  return Array.from({ length: 7 }, (_, day) =>
    dayRows(day, day === 3 ? PEAK : FLAT, { noonBumpFt: day === 3 ? 0.2 : 0 }).map((row) => (
      day >= 2 && source !== undefined ? { ...row, data_source: source } : row
    )),
  ).flat();
}

function detect(forecasts: SwellEventForecastRow[]) {
  return detectBeachSwellEvents({ beach: swellBeach(), forecasts, now: NOW, timezone: TIMEZONE });
}

function fakeClient(rows: unknown[]) {
  const calls: unknown[][] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "in", "gte", "lt", "order", "or"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, ...args]);
      return builder;
    };
  }
  builder.range = (from: number) => Promise.resolve({ data: from === 0 ? rows : [], error: null });
  return { calls, client: { from: () => builder } as never };
}

describe("synthetic forecast rows in swell detection", () => {
  it("detects the swell on real rows (fixture control)", () => {
    expect(detect(week("NOAA_NWS"))).toHaveLength(1);
  });

  it("cannot create an event from FALLBACK rows", () => {
    expect(detect(week("FALLBACK"))).toEqual([]);
  });

  it("keeps rows whose data_source is null", () => {
    expect(detect(week(null))).toHaveLength(1);
  });

  it("filters FALLBACK in the loader without dropping null data_source rows", async () => {
    const { calls, client } = fakeClient([]);
    await loadSwellForecastRows(client, ["b1"], new Date("2026-09-25T00:00:00Z"), new Date("2026-10-05T00:00:00Z"));
    expect(calls).toContainEqual(["or", "data_source.is.null,data_source.neq.FALLBACK"]);
    const select = calls.find(([method]) => method === "select") as [string, string];
    expect(select[1]).toContain("data_source");
  });
});
