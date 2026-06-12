/**
 * Pipeline test: Open-Meteo raw values co-locate on every merged slot where
 * OM has data — regardless of whether NOAA or OM wins the primary merge.
 *
 * Covers the contract that Seaside ML depends on: `enhanced_forecasts` rows
 * with `wave_height_om` etc. populated from the RAW OM API response, never
 * from synthesized defaults.
 */

import {
  openMeteoTimeToDate,
  processOpenMeteoData,
} from "@/lib/services/noaa-wavewatch/data-processors";
import type { OpenMeteoMarineResponse } from "@/lib/services/noaa-wavewatch/types";

describe("processOpenMeteoData: om_values capture", () => {
  const baseResponse = (): OpenMeteoMarineResponse => {
    // Build 24 hourly entries (8 3-hour steps) starting now rounded down to hour.
    const start = new Date();
    start.setMinutes(0, 0, 0);
    const time: string[] = [];
    const wave_height: number[] = [];
    const wave_period: number[] = [];
    const wave_direction: number[] = [];
    const swell_wave_height: number[] = [];
    const swell_wave_period: number[] = [];
    const swell_wave_direction: number[] = [];
    const wind_wave_height: number[] = [];
    const wind_wave_period: number[] = [];
    const wind_wave_direction: number[] = [];
    const wind_wave_peak_period: number[] = [];
    const wave_peak_period: number[] = [];
    const swell_wave_peak_period: number[] = [];
    const secondary_swell_wave_height: number[] = [];
    const secondary_swell_wave_period: number[] = [];
    const secondary_swell_wave_direction: number[] = [];
    const tertiary_swell_wave_height: number[] = [];
    const tertiary_swell_wave_period: number[] = [];
    const tertiary_swell_wave_direction: number[] = [];
    for (let h = 0; h < 24; h += 1) {
      const d = new Date(start.getTime() + h * 3600000);
      time.push(d.toISOString());
      wave_height.push(1.0 + h * 0.05);
      wave_period.push(10 + h * 0.1);
      wave_direction.push(220 + h);
      wave_peak_period.push(11 + h * 0.1);
      swell_wave_height.push(0.7 + h * 0.03);
      swell_wave_period.push(12 + h * 0.1);
      swell_wave_direction.push(215 + h);
      swell_wave_peak_period.push(13 + h * 0.1);
      wind_wave_height.push(0.3);
      wind_wave_period.push(5 + h * 0.05);
      wind_wave_direction.push(180 + h);
      wind_wave_peak_period.push(6 + h * 0.05);
      secondary_swell_wave_height.push(0.2 + h * 0.01);
      secondary_swell_wave_period.push(9 + h * 0.1);
      secondary_swell_wave_direction.push(190 + h);
      tertiary_swell_wave_height.push(0.1 + h * 0.01);
      tertiary_swell_wave_period.push(8 + h * 0.1);
      tertiary_swell_wave_direction.push(140 + h);
    }
    return {
      hourly: {
        time,
        wave_height,
        wave_period,
        wave_direction,
        wave_peak_period,
        swell_wave_height,
        swell_wave_period,
        swell_wave_direction,
        swell_wave_peak_period,
        wind_wave_height,
        wind_wave_period,
        wind_wave_direction,
        wind_wave_peak_period,
        secondary_swell_wave_height,
        secondary_swell_wave_period,
        secondary_swell_wave_direction,
        tertiary_swell_wave_height,
        tertiary_swell_wave_period,
        tertiary_swell_wave_direction,
      },
    };
  };

  it("attaches om_values with raw numeric API values to every forecast", () => {
    const resp = baseResponse();
    const forecasts = processOpenMeteoData(resp, 1);

    expect(forecasts.length).toBeGreaterThan(0);
    forecasts.forEach((fc, idx) => {
      expect(fc.om_values).toEqual(expect.any(Object));
      // Step index in the source hourly arrays is idx * 3.
      const i = idx * 3;
      expect(fc.om_values?.wave_height_om).toBe(resp.hourly!.wave_height![i]);
      expect(fc.om_values?.wave_period_om).toBe(resp.hourly!.wave_period![i]);
      expect(fc.om_values?.wave_direction_om).toBe(
        resp.hourly!.wave_direction![i]
      );
      expect(fc.om_values?.swell_height_om).toBe(
        resp.hourly!.swell_wave_height![i]
      );
      expect(fc.om_values?.swell_period_om).toBe(
        resp.hourly!.swell_wave_period![i]
      );
      expect(fc.om_values?.swell_direction_om).toBe(
        resp.hourly!.swell_wave_direction![i]
      );
      expect(fc.om_values?.wind_wave_height_om).toBe(
        resp.hourly!.wind_wave_height![i]
      );
      expect(fc.om_values?.wave_peak_period_om).toBe(
        resp.hourly!.wave_peak_period![i]
      );
      expect(fc.om_values?.swell_wave_peak_period_om).toBe(
        resp.hourly!.swell_wave_peak_period![i]
      );
      expect(fc.om_values?.wind_wave_period_om).toBe(
        resp.hourly!.wind_wave_period![i]
      );
      expect(fc.om_values?.wind_wave_direction_om).toBe(
        resp.hourly!.wind_wave_direction![i]
      );
      expect(fc.om_values?.wind_wave_peak_period_om).toBe(
        resp.hourly!.wind_wave_peak_period![i]
      );
      expect(fc.om_values?.secondary_swell_height_om).toBe(
        resp.hourly!.secondary_swell_wave_height![i]
      );
      expect(fc.om_values?.secondary_swell_period_om).toBe(
        resp.hourly!.secondary_swell_wave_period![i]
      );
      expect(fc.om_values?.secondary_swell_direction_om).toBe(
        resp.hourly!.secondary_swell_wave_direction![i]
      );
      expect(fc.om_values?.tertiary_swell_height_om).toBe(
        resp.hourly!.tertiary_swell_wave_height![i]
      );
      expect(fc.om_values?.tertiary_swell_period_om).toBe(
        resp.hourly!.tertiary_swell_wave_period![i]
      );
      expect(fc.om_values?.tertiary_swell_direction_om).toBe(
        resp.hourly!.tertiary_swell_wave_direction![i]
      );
      expect(fc.om_values?.om_wind_wave_missing).toBe(false);
      expect(fc.om_values?.om_primary_swell_missing).toBe(false);
      expect(fc.om_values?.om_secondary_swell_missing).toBe(false);
      expect(fc.om_values?.om_tertiary_swell_missing).toBe(false);
      expect(fc.om_values?.om_partition_schema_version).toBe(1);
    });
  });

  it("parses Open-Meteo unixtime hourly timestamps as seconds", () => {
    const resp = baseResponse();
    const startMs = Date.parse("2026-06-10T00:00:00Z");
    resp.hourly!.time = Array.from(
      { length: 24 },
      (_, index) => (startMs + index * 3600000) / 1000,
    );

    const forecasts = processOpenMeteoData(resp, 1);

    expect(forecasts[0].timestamp).toBe("2026-06-10T00:00:00.000Z");
    expect(forecasts[1].timestamp).toBe("2026-06-10T03:00:00.000Z");
  });

  it("parses Open-Meteo numeric strings and timezone-less ISO strings as UTC", () => {
    expect(openMeteoTimeToDate("1781161200")?.toISOString()).toBe(
      "2026-06-11T07:00:00.000Z",
    );
    expect(openMeteoTimeToDate("2026-06-11T00:00")?.toISOString()).toBe(
      "2026-06-11T00:00:00.000Z",
    );
    expect(openMeteoTimeToDate("not-a-date")).toBeNull();
  });

  it("records null in om_values for fields the API did not return", () => {
    const resp = baseResponse();
    // Simulate OM returning only wave_height + wave_period — no swell or wind arrays.
    delete resp.hourly!.swell_wave_height;
    delete resp.hourly!.swell_wave_period;
    delete resp.hourly!.swell_wave_direction;
    delete resp.hourly!.swell_wave_peak_period;
    delete resp.hourly!.wind_wave_height;
    delete resp.hourly!.wind_wave_period;
    delete resp.hourly!.wind_wave_direction;
    delete resp.hourly!.wind_wave_peak_period;
    delete resp.hourly!.secondary_swell_wave_height;
    delete resp.hourly!.secondary_swell_wave_period;
    delete resp.hourly!.secondary_swell_wave_direction;
    delete resp.hourly!.tertiary_swell_wave_height;
    delete resp.hourly!.tertiary_swell_wave_period;
    delete resp.hourly!.tertiary_swell_wave_direction;
    delete resp.hourly!.wave_direction;
    delete resp.hourly!.wave_peak_period;

    const forecasts = processOpenMeteoData(resp, 1);

    forecasts.forEach((fc) => {
      expect(fc.om_values).toEqual(expect.any(Object));
      // Fields the API returned: recorded as numbers.
      expect(typeof fc.om_values?.wave_height_om).toBe("number");
      expect(typeof fc.om_values?.wave_period_om).toBe("number");
      // Fields the API didn't return: recorded as null (never synthesized).
      expect(fc.om_values?.wave_direction_om).toBeNull();
      expect(fc.om_values?.swell_height_om).toBeNull();
      expect(fc.om_values?.swell_period_om).toBeNull();
      expect(fc.om_values?.swell_direction_om).toBeNull();
      expect(fc.om_values?.wind_wave_height_om).toBeNull();
      expect(fc.om_values?.wave_peak_period_om).toBeNull();
      expect(fc.om_values?.swell_wave_peak_period_om).toBeNull();
      expect(fc.om_values?.wind_wave_period_om).toBeNull();
      expect(fc.om_values?.wind_wave_direction_om).toBeNull();
      expect(fc.om_values?.wind_wave_peak_period_om).toBeNull();
      expect(fc.om_values?.secondary_swell_height_om).toBeNull();
      expect(fc.om_values?.secondary_swell_period_om).toBeNull();
      expect(fc.om_values?.secondary_swell_direction_om).toBeNull();
      expect(fc.om_values?.tertiary_swell_height_om).toBeNull();
      expect(fc.om_values?.tertiary_swell_period_om).toBeNull();
      expect(fc.om_values?.tertiary_swell_direction_om).toBeNull();
      expect(fc.om_values?.om_wind_wave_missing).toBe(true);
      expect(fc.om_values?.om_primary_swell_missing).toBe(true);
      expect(fc.om_values?.om_secondary_swell_missing).toBe(true);
      expect(fc.om_values?.om_tertiary_swell_missing).toBe(true);
      expect(fc.om_values?.om_partition_schema_version).toBe(1);
    });
  });
});
