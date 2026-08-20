/**
 * Day identity for the regional forecast: which calendar day a forecast row
 * belongs to, and the weekday printed beside that date. Both must be resolved
 * in the beach's timezone, not the server's and not UTC.
 *
 * Two defects motivated these tests. Rows were bucketed by the UTC date part of
 * `forecast_at`, so a Pacific evening row counted toward the following day. And
 * the weekday label was formatted without a `timeZone`, so it was read back in
 * whatever zone the Node process ran in — correct on Vercel (UTC), a day early
 * in every US timezone.
 *
 * `jest.tz-setup.js` forces the whole suite to TZ=UTC for snapshot determinism,
 * which is why neither defect was ever caught here. These cases are therefore
 * written around a UTC-rollover instant, where the beach-local day and the UTC
 * day genuinely differ — so they fail under the suite's forced UTC too.
 */

import { aggregateRegionalForecast } from "@/lib/utils/regional-forecast-utils";
import type { ForecastRegion } from "@/lib/data/forecast-regions";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";

const PACIFIC = "America/Los_Angeles";

const region: ForecastRegion = {
  slug: "test-region",
  name: "Test Region",
  title: "Test Region Forecast",
  metaDescription: "Test region description",
  states: ["ca"],
  centerLat: 33.0,
  centerLon: -117.0,
  zoom: 10,
};

const pacificBeach = {
  id: "beach-1",
  name: "Test Beach",
  slug: "test-beach",
  city: "San Diego",
  state: "CA",
  lat: 32.85,
  lon: -117.25,
  timezone: PACIFIC,
} as unknown as Beach;

function forecastAt(isoInstant: string): EnhancedForecastEntity {
  return {
    id: `forecast-${isoInstant}`,
    beach_id: "beach-1",
    forecast_at: isoInstant,
    wave_height: "2.0",
    wave_period: "13",
    wave_direction: "W",
    swell_1_height: "2.0",
    swell_1_period: "13",
    swell_1_direction: "W",
    water_temp: "65",
    air_temperature: "70",
    wind_speed: "0",
    wind_direction: "E (offshore)",
    wind_direction_deg: 90,
    tide_status: "Rising",
    tide_height: "3.5",
  } as unknown as EnhancedForecastEntity;
}

function summarize(instants: string[], now: string) {
  return aggregateRegionalForecast(
    region,
    [pacificBeach],
    new Map([["beach-1", instants.map(forecastAt)]]),
    { now: new Date(now) },
  );
}

describe("regional forecast day identity", () => {
  // 02:00Z on Thursday the 20th is 19:00 on Wednesday the 19th in Pacific time.
  // A surfer reading this row on Wednesday evening is reading Wednesday's surf.
  const pacificWednesdayEvening = ["2026-08-20T02:00:00Z"];
  // 15:00Z on Wednesday the 19th is 08:00 the same morning in Pacific time.
  const wednesdayMorning = "2026-08-19T15:00:00Z";

  it("attributes an evening Pacific row to the Pacific calendar day", () => {
    const summary = summarize(pacificWednesdayEvening, wednesdayMorning);

    expect(summary.days.map((day) => day.dateString)).toContain("2026-08-19");
  });

  it("labels that day with the Pacific weekday, not the UTC one", () => {
    const summary = summarize(pacificWednesdayEvening, wednesdayMorning);

    const wednesday = summary.days.find(
      (day) => day.dateString === "2026-08-19",
    );
    expect(wednesday?.dayOfWeek).toBe("Wednesday");
  });

  it("labels a beach's best day with the Pacific weekday", () => {
    const summary = summarize(pacificWednesdayEvening, wednesdayMorning);

    expect(summary.beachConditions[0]?.bestDay).toBe("Wednesday");
  });

  it("resolves the region's timezone by majority, not by first row", () => {
    // Nine beaches in production carry a plainly wrong America/Los_Angeles
    // stamp — Galveston, Corpus Christi, Long Island. One of them must not drag
    // its whole region onto Pacific time.
    const misstamped = {
      ...pacificBeach,
      id: "beach-bad",
      name: "Misstamped Beach",
      timezone: PACIFIC,
    } as unknown as Beach;
    const atlantic = (id: string) =>
      ({
        ...pacificBeach,
        id,
        name: `Atlantic ${id}`,
        timezone: "America/New_York",
      }) as unknown as Beach;

    // 05:00Z is still the 19th in Pacific time but already the 20th in Eastern.
    const summary = aggregateRegionalForecast(
      region,
      [misstamped, atlantic("beach-2"), atlantic("beach-3")],
      new Map([["beach-2", [forecastAt("2026-08-20T05:00:00Z")]]]),
      { now: new Date("2026-08-20T05:00:00Z") },
    );

    expect(summary.days.map((day) => day.dateString)).toContain("2026-08-20");
  });

  it("keeps every day summary's weekday consistent with its own date", () => {
    const summary = summarize(
      [
        "2026-08-20T16:00:00Z",
        "2026-08-21T16:00:00Z",
        "2026-08-22T16:00:00Z",
      ],
      "2026-08-20T15:00:00Z",
    );

    for (const day of summary.days) {
      const expected = new Date(`${day.dateString}T12:00:00Z`).toLocaleDateString(
        "en-US",
        { weekday: "long", timeZone: "UTC" },
      );
      expect(day.dayOfWeek).toBe(expected);
    }
  });
});
