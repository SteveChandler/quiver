import { createAlertTideCache, loadAlertTideSamples } from "@/lib/alerts/alert-tide-samples";

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
    const { client, calls } = clientReturning({ data: [{ ts_utc: "2026-10-01T15:00:00+00:00", tide_ft: 3.38255 }], error: null });
    const samples = await loadAlertTideSamples(client as never, "blacks", "2026-10-01T07:00:00Z", "2026-10-02T07:00:00Z");
    expect(samples).toEqual([{ time: "2026-10-01T15:00:00+00:00", heightFt: 3.38255 }]);
    expect(calls).toContainEqual(["from", "tide_forecasts"]);
    expect(calls).toContainEqual(["eq", "beach_id", "blacks"]);
  });

  it("returns null on an error or an empty series so callers keep the row tide", async () => {
    expect(await loadAlertTideSamples(clientReturning({ data: null, error: { message: "boom" } }).client as never, "b", "s", "e")).toBeNull();
    expect(await loadAlertTideSamples(clientReturning({ data: [], error: null }).client as never, "b", "s", "e")).toBeNull();
  });

  it("queries each beach and day once per run", async () => {
    const { client, calls } = clientReturning({ data: [{ ts_utc: "2026-10-01T15:00:00Z", tide_ft: 3.4 }], error: null });
    const tideFor = createAlertTideCache(client as never);
    await tideFor("blacks", "s", "e");
    await tideFor("blacks", "s", "e");
    expect(calls.filter((c) => c[0] === "from")).toHaveLength(1);
  });
});
