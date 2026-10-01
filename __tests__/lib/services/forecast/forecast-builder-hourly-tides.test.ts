/**
 * Forecast rows read tide height from the hourly NOAA series in
 * tide_forecasts, the same series every other tide surface shows, instead of
 * interpolating a straight line between the highs and lows found in it.
 *
 * Fixtures are the prod rows behind the 2026-09-30 reports: Tourmaline Surf
 * Park wrote 2.8 ft at 18Z against NOAA's 6.07 ft, and La Jolla Shores ran
 * ~0.7 ft low between its high and low.
 */

import { expectConsoleErrors } from "@/__tests__/setup/test-utils";
import {
  LA_JOLLA_9410230_ROWS,
  TOURMALINE_9410196_ROWS,
  rowsVisibleAt,
  type NoaaHourlyRow,
} from "@/__tests__/fixtures/noaa-tide-series-20260930";
import { ForecastBuilder } from "@/lib/services/forecast/forecast-builder";
import type { ForecastInputs } from "@/lib/services/forecast/forecast-builder";
import { NOAACOOPSService } from "@/lib/services/noaa-coops/noaa-coops-service";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Beach } from "@/types/database";

// Every service-role read except the tide read answers empty.
jest.mock("@/lib/supabase/server", () => {
  const emptyChain: object = new Proxy(
    {},
    {
      get: (_target, prop) =>
        prop === "then"
          ? (resolve: (value: unknown) => void) => resolve({ data: null, error: null })
          : () => emptyChain,
    },
  );
  const emptyClient = { from: () => emptyChain, rpc: () => emptyChain };
  return { createSupabaseServiceRoleClient: jest.fn(async () => emptyClient) };
});

jest.mock("@/lib/services/forecast/confidence-scorer", () => ({
  calculateConfidenceScore: jest.fn(() => 75),
}));

jest.mock("@/lib/logger", () => ({
  createContextLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

jest.mock("@/lib/services/noaa-wavewatch/gfs-wave-shadow", () => {
  const actual = jest.requireActual("@/lib/services/noaa-wavewatch/gfs-wave-shadow");
  return {
    ...actual,
    logGfsWaveShadowRows: jest.fn(async () => undefined),
  };
});

const METERS_TO_FEET = 3.28084;

describe("ForecastBuilder hourly tide heights", () => {
  // The trusted layer reports coverage as unavailable against the shared
  // service-role mock; declared, as in forecast-builder.test.ts.
  afterEach(() => {
    expectConsoleErrors([/trusted_forecast_coverage_unavailable/]);
    jest.useRealTimers();
  });

  const coops = new NOAACOOPSService();
  const builder = new ForecastBuilder({
    getWaveDirectionText: () => "SW",
    getTideStatusAtTime: (tides, time) => coops.getTideStatusAtTime(tides, time),
    getTideHeightAtTime: (tides, time) => coops.getTideHeightAtTime(tides, time),
    getNextTideFromTime: (tides, time) => coops.getNextTideFromTime(tides, time),
    getDataQualityScore: () => 85,
  });

  async function buildAt(beach: Beach, rows: NoaaHourlyRow[], buildAtIso: string) {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(buildAtIso));

    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: rowsVisibleAt(rows, buildAtIso), error: null }),
    };
    (createSupabaseServiceRoleClient as jest.Mock).mockResolvedValueOnce({
      from: jest.fn(() => query),
    });
    const tideData = await coops.fetchCachedTides(beach.id);
    expect(tideData?.hourly?.length).toBeGreaterThan(0);

    const waveData = {
      lat: beach.lat as number,
      lng: beach.lon as number,
      forecast: [
        {
          timestamp: buildAtIso,
          significant_wave_height: 1.2,
          peak_wave_period: 12,
          peak_wave_direction: 225,
          swell_1_height: 0.8,
          swell_1_period: 14,
          swell_1_direction: 220,
          swell_2_height: 0,
          swell_2_period: 0,
          swell_2_direction: 0,
          wind_wave_height: 0.3,
          wind_wave_period: 6,
          wind_wave_direction: 200,
          data_source: "NOAA_NWS" as const,
        },
      ],
    } satisfies ForecastInputs["waveData"] & {};

    const forecasts = await builder.buildForecasts({
      beach,
      waveData,
      tideData,
      weatherData: [],
      buoyData: null,
      cdipData: null,
      ioosWaterTempC: null,
      coopsWaterTempC: null,
      buildAnchorAt: new Date(buildAtIso),
    });
    return new Map(forecasts.map((row) => [new Date(row.forecast_at as string).toISOString(), row]));
  }

  function noaaFeetAt(rows: NoaaHourlyRow[], iso: string): number | undefined {
    const row = rows.find((r) => r.ts === iso);
    return row ? row.tide_height_m * METERS_TO_FEET : undefined;
  }

  it("writes Tourmaline's afternoon high from NOAA 9410196, not a low-to-low line", async () => {
    const beach = {
      id: "91df193c-f2c8-4e6c-984e-b859bd741061",
      name: "Tourmaline Surf Park",
      lat: 32.806163,
      lon: -117.263817,
      timezone: "America/Los_Angeles",
    } as Beach;

    const rows = await buildAt(beach, TOURMALINE_9410196_ROWS, "2026-09-30T20:01:27.368Z");

    // Prod wrote "2.8 ft", Rising, next Low 0.2 ft at 02Z for this slot.
    expect(rows.get("2026-09-30T18:00:00.000Z")).toMatchObject({
      tide_height: "6.1 ft",
      tide_status: "Rising",
      next_tide_type: "High",
      next_tide_height: "6.1 ft",
      next_tide_at: "2026-09-30T18:30:00.000Z",
    });
    expect(rows.get("2026-09-30T21:00:00.000Z")).toMatchObject({
      tide_height: "4.6 ft",
      tide_status: "Falling",
      next_tide_type: "Low",
      next_tide_height: "0.2 ft",
      next_tide_at: "2026-10-01T02:00:00.000Z",
    });
  });

  it("writes La Jolla Shores' mid-tide slots from NOAA 9410230", async () => {
    const beach = {
      id: "d291411d-d331-4bf1-ad1a-302da3c69de0",
      name: "La Jolla Shores",
      lat: 32.8567,
      lon: -117.2575,
      timezone: "America/Los_Angeles",
    } as Beach;

    const rows = await buildAt(beach, LA_JOLLA_9410230_ROWS, "2026-09-30T20:01:25.898Z");

    // Linear high-to-low interpolation wrote 3.8 ft and 1.6 ft here.
    expect(rows.get("2026-09-30T21:00:00.000Z")?.tide_height).toBe("4.5 ft");
    expect(rows.get("2026-10-01T00:00:00.000Z")?.tide_height).toBe("1.1 ft");
    expect(rows.get("2026-09-30T18:00:00.000Z")?.tide_height).toBe("5.9 ft");
  });

  it.each([
    ["Tourmaline 9410196", TOURMALINE_9410196_ROWS, "2026-09-30T20:01:27.368Z"],
    ["La Jolla 9410230", LA_JOLLA_9410230_ROWS, "2026-09-30T20:01:25.898Z"],
  ])("every %s slot inside the series matches NOAA to display precision", async (_label, series, buildAtIso) => {
    const beach = { id: "beach-1", name: "Test Beach", lat: 32.8, lon: -117.26 } as Beach;
    const rows = await buildAt(beach, series, buildAtIso);

    const compared: Array<[string, number, number]> = [];
    for (const [iso, row] of rows) {
      const noaaFt = noaaFeetAt(series, iso);
      if (noaaFt === undefined) continue;
      compared.push([iso, Number.parseFloat(row.tide_height as string), noaaFt]);
    }

    expect(compared.length).toBeGreaterThanOrEqual(4);
    for (const [, shownFt, noaaFt] of compared) {
      expect(Math.abs(shownFt - noaaFt)).toBeLessThanOrEqual(0.05);
    }
  });
});
