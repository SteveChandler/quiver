import { createAlertTideCache, loadAlertTideSamples } from "@/lib/alerts/alert-tide-samples";
import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";

function clientReturning(result: { data: unknown; error: unknown }) {
  const calls: unknown[][] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "gte", "lt", "order"]) {
    builder[method] = (...args: unknown[]) => { calls.push([method, ...args]); return builder; };
  }
  (builder as { then: unknown }).then = (resolve: (v: unknown) => unknown) => resolve(result);
  return { client: { from: (table: string) => { calls.push(["from", table]); return builder; } }, calls };
}

describe("loadAlertTideSamples", () => {
  it("reads one beach's hourly NOAA heights for the day", async () => {
    const { client, calls } = clientReturning({ data: [{ ts: "2026-10-01T15:00:00+00:00", tide_ft: 3.38255, tide_height_m: 1.03, source: "noaa", station_id: "9410230", created_at: "2026-09-30T04:00:00Z" }], error: null });
    const samples = await loadAlertTideSamples(client as never, "blacks", "2026-10-01T07:00:00Z", "2026-10-02T07:00:00Z");
    expect(samples).toEqual([{ time: "2026-10-01T15:00:00+00:00", heightFt: 3.38255 }]);
    expect(calls).toContainEqual(["from", "tide_forecasts"]);
    expect(calls).toContainEqual(["eq", "beach_id", "blacks"]);
  });

  // Final review 2026-10-01: tide_forecasts can hold a noaa and a noaa_hilo_interpolated row for the
  // same hour, plus an old station's rows; mixing them fakes a turning point every hour.
  it("reads one consistent series: the latest station, the preferred source per hour", async () => {
    const rows = [
      { ts: "2026-10-01T15:00:00+00:00", tide_ft: 3.6, tide_height_m: 1.097, source: "noaa_hilo_interpolated", station_id: "9410230", created_at: "2026-09-30T04:00:00Z" },
      { ts: "2026-10-01T15:00:00+00:00", tide_ft: 3.38, tide_height_m: 1.03, source: "noaa", station_id: "9410230", created_at: "2026-09-30T04:00:00Z" },
      { ts: "2026-10-01T16:00:00+00:00", tide_ft: 4.09, tide_height_m: 1.247, source: "noaa", station_id: "9410230", created_at: "2026-09-30T04:00:00Z" },
      { ts: "2026-10-01T16:00:00+00:00", tide_ft: 9.9, tide_height_m: 3.0, source: "noaa", station_id: "OLD", created_at: "2026-09-01T04:00:00Z" },
    ];
    const samples = await loadAlertTideSamples(clientReturning({ data: rows, error: null }).client as never, "blacks", "s", "e");
    expect(samples).toEqual([
      { time: "2026-10-01T15:00:00+00:00", heightFt: 3.38 },
      { time: "2026-10-01T16:00:00+00:00", heightFt: 4.09 },
    ]);
  });

  it("returns null on an error or an empty series so callers keep the row tide", async () => {
    expect(await loadAlertTideSamples(clientReturning({ data: null, error: { message: "boom" } }).client as never, "b", "s", "e")).toBeNull();
    expectConsoleWarnings([/tide lookup failed for b; using row tide/]);
    expect(await loadAlertTideSamples(clientReturning({ data: [], error: null }).client as never, "b", "s", "e")).toBeNull();
  });

  it("queries each beach and day once per run", async () => {
    const { client, calls } = clientReturning({ data: [{ ts: "2026-10-01T15:00:00Z", tide_ft: 3.4, tide_height_m: 1.04, source: "noaa", station_id: "S", created_at: "2026-09-30T04:00:00Z" }], error: null });
    const tideFor = createAlertTideCache(client as never);
    await tideFor("blacks", "s", "e");
    await tideFor("blacks", "s", "e");
    expect(calls.filter((c) => c[0] === "from")).toHaveLength(1);
  });
});
