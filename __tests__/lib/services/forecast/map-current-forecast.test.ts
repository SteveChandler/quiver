import { currentHourForecastRow } from "@/lib/services/forecast/map-current-forecast";

const row = (forecast_at: string) => ({ forecast_at });

describe("currentHourForecastRow", () => {
  const rows = [row("2026-11-19T12:00:00.000Z"), row("2026-11-19T15:00:00.000Z")];

  it("takes the slot nearest the start of the current UTC hour", () => {
    expect(currentHourForecastRow(rows, new Date("2026-11-19T14:30:00.000Z"))).toBe(rows[1]);
    expect(currentHourForecastRow(rows, new Date("2026-11-19T13:59:59.000Z"))).toBe(rows[0]);
    expect(currentHourForecastRow(rows, new Date("2026-11-19T15:00:00.000Z"))).toBe(rows[1]);
  });

  it("takes the later row on a tie, as native's current hour does", () => {
    const hourly = [row("2026-11-19T13:00:00.000Z"), row("2026-11-19T15:00:00.000Z")];
    expect(currentHourForecastRow(hourly, new Date("2026-11-19T14:10:00.000Z"))).toBe(hourly[1]);
    expect(currentHourForecastRow([...hourly].reverse(), new Date("2026-11-19T14:10:00.000Z"))).toBe(hourly[1]);
  });

  it("returns null when no row lies within one slot of the hour in either direction", () => {
    const far = [row("2026-11-19T10:59:00.000Z"), row("2026-11-19T17:01:00.000Z")];
    expect(currentHourForecastRow(far, new Date("2026-11-19T14:30:00.000Z"))).toBeNull();
    expect(currentHourForecastRow([row("2026-11-19T17:00:00.000Z")], new Date("2026-11-19T14:30:00.000Z")))
      .toEqual(row("2026-11-19T17:00:00.000Z"));
  });

  it("ignores rows without a valid forecast_at and an invalid now", () => {
    expect(currentHourForecastRow([row(""), { forecast_at: null }], new Date("2026-11-19T14:30:00.000Z"))).toBeNull();
    expect(currentHourForecastRow(rows, new Date(NaN))).toBeNull();
  });
});
