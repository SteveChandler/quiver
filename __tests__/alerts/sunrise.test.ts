import { filterToDaylight } from "@/lib/alerts/sunrise";

const GALVESTON_LAT = 29.3;
const GALVESTON_LON = -94.8;

function makeRows(startIso: string, count: number): Array<{ forecast_at: string }> {
  const start = new Date(startIso).getTime();
  return Array.from({ length: count }, (_, index) => ({
    forecast_at: new Date(start + index * 3 * 60 * 60 * 1000).toISOString(),
  }));
}

describe("filterToDaylight", () => {
  it("keeps Galveston daytime rows when the first row is pre-dawn local", () => {
    const rows = makeRows("2026-07-15T06:00:00.000Z", 8);

    const result = filterToDaylight(rows, GALVESTON_LAT, GALVESTON_LON);

    expect(result.length).toBeGreaterThan(0);
    expect(result.map((row) => row.forecast_at)).toContain(
      "2026-07-15T18:00:00.000Z",
    );
  });

  it("drops Galveston night rows", () => {
    const rows = [
      { forecast_at: "2026-07-15T07:00:00.000Z" },
      { forecast_at: "2026-07-15T18:00:00.000Z" },
    ];

    const result = filterToDaylight(rows, GALVESTON_LAT, GALVESTON_LON);

    expect(result).toEqual([
      { forecast_at: "2026-07-15T18:00:00.000Z" },
    ]);
  });

  it("drops the last daylight hour when it runs past sunset", () => {
    // Waddell Creek, 2026-08-10: sunset 20:08:42 local (2026-08-11T03:08:42Z).
    // The 20:00 row starts 8 minutes before sunset but covers 20:00-21:00, so
    // 52 of its 60 minutes are dark. The 19:00 row ends at 20:00 and is fine.
    const WADDELL_LAT = 37.0925;
    const WADDELL_LON = -122.2767;
    const rows = [
      { forecast_at: "2026-08-11T02:00:00.000Z" }, // 19:00 local, ends 20:00
      { forecast_at: "2026-08-11T03:00:00.000Z" }, // 20:00 local, ends 21:00
    ];

    const result = filterToDaylight(rows, WADDELL_LAT, WADDELL_LON);

    expect(result).toEqual([{ forecast_at: "2026-08-11T02:00:00.000Z" }]);
  });

  it("keeps daytime rows on the second and third days of a 72-hour forecast", () => {
    const rows = makeRows("2026-07-15T06:00:00.000Z", 24);

    const result = filterToDaylight(rows, GALVESTON_LAT, GALVESTON_LON);
    const timestamps = result.map((row) => row.forecast_at);

    expect(timestamps).toContain("2026-07-16T18:00:00.000Z");
    expect(timestamps).toContain("2026-07-17T18:00:00.000Z");
  });
});
