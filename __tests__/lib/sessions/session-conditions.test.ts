import fixture from "@/__tests__/fixtures/display-swell-parity.json";
import { resolveDisplaySwell } from "@/lib/domains/conditions/display-swell";
import {
  pickForecastRowAtOrBefore,
  resolveSessionConditions,
} from "@/lib/sessions/session-conditions";

const row = (forecast_at: string) => ({ forecast_at });

describe("pickForecastRowAtOrBefore", () => {
  const rows = [row("2026-09-30T14:00:00Z"), row("2026-09-30T16:00:00Z"), row("2026-09-30T15:00:00Z")];

  it("takes the row at or before arrival, never the nearer later row", () => {
    expect(pickForecastRowAtOrBefore(rows, "2026-09-30T15:50:00Z")).toEqual(row("2026-09-30T15:00:00Z"));
  });

  it("takes a row exactly at arrival", () => {
    expect(pickForecastRowAtOrBefore(rows, "2026-09-30T16:00:00Z")).toEqual(row("2026-09-30T16:00:00Z"));
  });

  it("keeps a row exactly 3 h before and drops one further back", () => {
    expect(pickForecastRowAtOrBefore(rows, "2026-09-30T19:00:00Z")).toEqual(row("2026-09-30T16:00:00Z"));
    expect(pickForecastRowAtOrBefore(rows, "2026-09-30T19:00:01Z")).toBeNull();
  });

  it("returns null when every row is after arrival or unparseable", () => {
    expect(pickForecastRowAtOrBefore([row("2026-09-30T16:00:00Z"), row("not a time")], "2026-09-30T15:00:00Z")).toBeNull();
    expect(pickForecastRowAtOrBefore(rows, "not a time")).toBeNull();
  });
});

describe("resolveSessionConditions", () => {
  const forecastAt = "2026-09-30T15:00:00Z";

  it.each(fixture.cases.filter((c) => c.expected.periodSeconds !== null))(
    "stores the swell the app shows: $name",
    ({ row: swellRow, window, expected }) => {
      const display = resolveDisplaySwell(swellRow, window);
      const result = resolveSessionConditions({ ...swellRow, forecast_at: forecastAt }, window, "forecast_row");

      expect(result.swell_period_s).toBe(Math.round((display.periodSeconds as number) * 10) / 10);
      expect(result.swell_direction_deg).toBe(expected.directionDeg === null ? null : Math.round(expected.directionDeg) % 360);
      expect(result.swell_height_ft).toBe(expected.heightFt === null ? null : Math.round(expected.heightFt * 10) / 10);
      expect(result.conditions_source).toBe("forecast_row");
      expect(result.conditions_forecast_at).toBe(forecastAt);
    },
  );

  it("keeps CDIP's numeric direction when the text conflicts by 45° or more", () => {
    const result = resolveSessionConditions(
      { forecast_at: forecastAt, data_source: "CDIP", swell_1_period: "13s", swell_1_direction: "S", swell_1_height: "3 ft", wave_direction_om: 275 },
      null,
      "forecast_row",
    );
    expect(result.swell_direction_deg).toBe(275);
    expect(result.swell_period_s).toBe(13);
  });

  it("stores the Open-Meteo swell raw beside the displayed one", () => {
    const result = resolveSessionConditions(
      { forecast_at: forecastAt, swell_1_period: "9s", swell_1_direction: "SW", swell_1_height: "3 ft", swell_period_om: 14.26, swell_direction_om: 281, swell_height_om: 0.9 },
      null,
      "forecast_row",
    );
    expect(result.swell_period_s).toBe(9);
    expect(result.offshore_swell_period_s).toBe(14.3);
    expect(result.offshore_swell_direction_deg).toBe(281);
    expect(result.offshore_swell_height_ft).toBe(3);
  });

  it("reads wind speed and degrees, and labels the same degrees", () => {
    const result = resolveSessionConditions(
      { forecast_at: forecastAt, wind_speed: "10 mph", wind_direction: "S", wind_direction_deg: 180 },
      null,
      "snapshot_backfill",
    );
    expect(result.wind_speed_mph).toBe(10);
    expect(result.wind_direction_deg).toBe(180);
    expect(result.wind_direction).toBe("S");
    expect(result.conditions_source).toBe("snapshot_backfill");
  });

  it("falls back to the wind text when the row has no degrees", () => {
    const result = resolveSessionConditions({ forecast_at: forecastAt, wind_speed: "5 mph", wind_direction: "WNW" }, null, "forecast_row");
    expect(result.wind_direction_deg).toBe(293);
    expect(result.wind_direction).toBe("WNW");
  });

  it("rounds period to one decimal and turns 360° into 0", () => {
    const result = resolveSessionConditions(
      { forecast_at: forecastAt, swell_period_om: 12.46, swell_direction_om: 359.7, swell_height_om: 1 },
      { centerDeg: 0, halfwidthDeg: 30 },
      "forecast_row",
    );
    expect(result.swell_period_s).toBe(12.5);
    expect(result.swell_direction_deg).toBe(0);
    expect(result.offshore_swell_direction_deg).toBe(0);
  });

  it("marks a missing row or a row of nulls as none", () => {
    const empty = {
      swell_period_s: null,
      swell_direction_deg: null,
      swell_height_ft: null,
      offshore_swell_period_s: null,
      offshore_swell_direction_deg: null,
      offshore_swell_height_ft: null,
      wind_speed_mph: null,
      wind_direction_deg: null,
      wind_direction: null,
      conditions_forecast_at: null,
      conditions_source: "none",
    };
    expect(resolveSessionConditions(null, null, "forecast_row")).toEqual(empty);
    expect(
      resolveSessionConditions(
        { forecast_at: forecastAt, swell_1_period: null, wave_period: null, wind_speed: null, wind_direction: null, wind_direction_deg: null },
        null,
        "forecast_row",
      ),
    ).toEqual(empty);
  });
});
