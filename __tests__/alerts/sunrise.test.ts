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

  it("keeps daytime rows on the second and third days of a 72-hour forecast", () => {
    const rows = makeRows("2026-07-15T06:00:00.000Z", 24);

    const result = filterToDaylight(rows, GALVESTON_LAT, GALVESTON_LON);
    const timestamps = result.map((row) => row.forecast_at);

    expect(timestamps).toContain("2026-07-16T18:00:00.000Z");
    expect(timestamps).toContain("2026-07-17T18:00:00.000Z");
  });
});
