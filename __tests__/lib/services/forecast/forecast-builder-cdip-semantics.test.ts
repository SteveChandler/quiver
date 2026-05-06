/**
 * @jest-environment node
 *
 * Regression coverage for the CDIP height semantics bug fixed in plan
 * `freeze-moonlit-panda`. When a forecast row had both a CDIP observation
 * AND populated WaveWatch components, the decomposed transformer summed
 * components and silently discarded CDIP `Hs`, bypassing the per-beach
 * `shoaling_factors` calibration (gated on `source === 'cdip_sig'`).
 *
 * The fix adds an explicit CDIP branch in `getWaveHeight` that forces the
 * scalar/legacy path with `components: [null, null, null]`. These tests
 * assert the branch fires correctly and surfaces provenance metadata to
 * `raw_forecast.wave_height_provenance`.
 *
 * These tests use the REAL `wave-formatters` module (no mock) so the
 * end-to-end transform actually runs.
 */

import { ForecastBuilder } from "@/lib/services/forecast/forecast-builder";
import type { Beach } from "@/types/database";

const FROZEN_NOW_ISO = "2026-04-19T15:00:00Z";

function makeBuilder(): ForecastBuilder {
  return new ForecastBuilder({
    getWaveDirectionText: () => "SW",
    getTideStatusAtTime: () => "Rising",
    getTideHeightAtTime: () => 3.5,
    getNextTideFromTime: () => null,
    getDataQualityScore: () => 85,
  });
}

function makeBeach(overrides: Partial<Beach> = {}): Beach {
  return {
    id: "beach-test",
    name: "Test Beach",
    lat: 32.76,
    lon: -117.25,
    center_lat: 32.76,
    center_lng: -117.25,
    features: [],
    swell_window_center_deg: 240,
    swell_window_halfwidth_deg: 120,
    terrain_enabled: false,
    shoaling_factors: null,
    deepwater_decay_factor: null,
    swell_access_factors: null,
    wind_exposure_factors: null,
    timezone: "America/Los_Angeles",
    ...overrides,
  } as unknown as Beach;
}

/**
 * 14s shoaling bucket factor of 2.0 — chosen so the calibrated output
 * (CDIP Hs in feet × 2.0) is materially different from any NOAA-component
 * decomposition the same forecast row could produce.
 */
const CALIBRATED_SHOALING = {
  version: 1 as const,
  type: "period_lookup" as const,
  buckets: [
    { tp_min_s: 6, tp_max_s: 10, factor: 1.2 },
    { tp_min_s: 10, tp_max_s: 13, factor: 1.6 },
    { tp_min_s: 13, tp_max_s: 18, factor: 2.0 },
  ],
};

function makeWaveData(nowIso: string, hsM = 2.8) {
  return {
    lat: 32.76,
    lng: -117.25,
    data_source: "NOAA_NWS" as const,
    forecast: [
      {
        timestamp: nowIso,
        forecast_at: nowIso,
        significant_wave_height: hsM,
        peak_wave_period: 12,
        peak_wave_direction: 240,
        swell_1_height: 2.6,
        swell_1_period: 12,
        swell_1_direction: 240,
        swell_2_height: 1.4,
        swell_2_period: 13,
        swell_2_direction: 290,
        wind_wave_height: 1.0,
        wind_wave_period: 6,
        wind_wave_direction: 270,
        data_source: "NOAA_NWS" as const,
      },
    ],
  };
}

function makeCdipBuoyData(nowIso: string, sigHeightFt: number, periodS = 14) {
  return {
    stationId: "220",
    stationName: "Mission Bay West",
    dataSource: "CDIP" as const,
    lastUpdated: nowIso,
    data: [
      {
        timestamp: nowIso,
        significantWaveHeight: sigHeightFt,
        peakWavePeriod: periodS,
        peakWaveDirection: 270,
      },
    ],
  };
}

function extractFt(waveHeight: string | null | undefined): number {
  if (!waveHeight) throw new Error(`wave_height is null`);
  const match = waveHeight.match(/([\d.]+)/);
  if (!match) throw new Error(`could not parse wave_height: ${waveHeight}`);
  return parseFloat(match[1]);
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(FROZEN_NOW_ISO));
});

afterEach(() => {
  jest.useRealTimers();
});

describe("ForecastBuilder CDIP height semantics", () => {
  test("CDIP + WaveWatch components: wave_height follows CDIP Hs × calibrated bucket, not NOAA component sum", async () => {
    const builder = makeBuilder();
    const cdipHsFt = 2.0;

    const forecasts = await builder.buildForecasts({
      beach: makeBeach({ shoaling_factors: CALIBRATED_SHOALING as unknown as Beach["shoaling_factors"] }),
      waveData: makeWaveData(FROZEN_NOW_ISO),
      tideData: null,
      weatherData: [],
      buoyData: null,
      cdipData: makeCdipBuoyData(FROZEN_NOW_ISO, cdipHsFt) as never,
      ioosWaterTempC: null,
      coopsWaterTempC: null,
    });

    // Calibrated path: 2.0 ft × bucket factor at 14s (2.0) = 4.0 ft (clamped/rounded).
    const expectedFt = cdipHsFt * 2.0;
    const actualFt = extractFt(forecasts[0].wave_height);
    expect(actualFt).toBeCloseTo(expectedFt, 1);

    // Provenance must show CDIP-driven scalar calibrated path with components NOT summed.
    const prov = forecasts[0].raw_forecast?.wave_height_provenance;
    expect(prov).toEqual(
      expect.objectContaining({
        source: "cdip_sig",
        transform_path: "scalar_calibrated",
        components_used: false,
        calibrated_shoaling_fired: true,
        station_id: "220",
      }),
    );
    expect(prov?.raw_value_ft).toBeCloseTo(cdipHsFt, 2);
  });

  test("NOAA-only (no CDIP): wave_height uses decomposed component path", async () => {
    const builder = makeBuilder();

    const forecasts = await builder.buildForecasts({
      beach: makeBeach(),
      waveData: makeWaveData(FROZEN_NOW_ISO),
      tideData: null,
      weatherData: [],
      buoyData: null,
      cdipData: null,
      ioosWaterTempC: null,
      coopsWaterTempC: null,
    });

    const prov = forecasts[0].raw_forecast?.wave_height_provenance;
    expect(prov).toEqual(
      expect.objectContaining({
        transform_path: "decomposed",
        components_used: true,
        calibrated_shoaling_fired: false,
      }),
    );
    expect(prov?.source).not.toBe("cdip_sig");
    expect(prov?.source).not.toBe("nowcast_anchor");
    // NOAA path produces a non-trivial face height (multi-component sum).
    expect(extractFt(forecasts[0].wave_height)).toBeGreaterThan(2);
  });

  test("Nowcast anchor still overrides CDIP + NOAA (anchor branch wins)", async () => {
    const builder = makeBuilder();
    const ANCHOR_HS_M = 0.4; // observed: small
    const CDIP_HS_FT = 6.0; // CDIP forecast: large
    // NOAA significant_wave_height of 2.8m would normally produce ~6-9 ft face
    // — so if the anchor branch DIDN'T win, output would be much larger than
    // the anchor's ~1.5 ft face.

    const forecasts = await builder.buildForecasts({
      beach: makeBeach({ features: ["observation_anchor"] }),
      waveData: makeWaveData(FROZEN_NOW_ISO),
      tideData: null,
      weatherData: [],
      buoyData: null,
      cdipData: makeCdipBuoyData(FROZEN_NOW_ISO, CDIP_HS_FT) as never,
      ioosWaterTempC: null,
      coopsWaterTempC: null,
      nowcastAnchor: {
        beachId: "beach-test",
        stationId: "edu_ucsd_cdip_220",
        observedAt: FROZEN_NOW_ISO,
        waveHeightM: ANCHOR_HS_M,
        wavePeriodS: 14,
        waveDirectionDeg: 240,
      },
    });

    const ft = extractFt(forecasts[0].wave_height);
    expect(ft).toBeLessThan(3); // anchor ~1.5 ft, not CDIP 6 ft or NOAA 6-9 ft

    const prov = forecasts[0].raw_forecast?.wave_height_provenance;
    expect(prov?.source).toBe("nowcast_anchor");
    expect(prov?.station_id).toBe("edu_ucsd_cdip_220");
    expect(prov?.components_used).toBe(false);
  });

  test("CDIP outlier rejection: provenance records cdip_rejection when CDIP > 1.8× model swell", async () => {
    const builder = makeBuilder();
    // CDIP claims 9 ft Hs while NOAA model swell_1 is only 2.6 m (≈8.5 ft).
    // 9 / 8.5 ≈ 1.06 — NOT an outlier. Crank CDIP to 18 ft and shrink model:
    // CDIP 8.5 ft vs model 2.6 m (8.5 ft) — same. Use CDIP 8 ft + model swell of 1m.
    // 8 ft (CDIP) vs 3.28 ft (model) = ratio 2.4× → outlier rejected.
    const wave = makeWaveData(FROZEN_NOW_ISO);
    wave.forecast[0].swell_1_height = 1.0; // ≈3.28 ft
    wave.forecast[0].significant_wave_height = 1.2;
    wave.forecast[0].swell_2_height = 0;
    wave.forecast[0].swell_2_period = 0;
    wave.forecast[0].wind_wave_height = 0;
    wave.forecast[0].wind_wave_period = 0;

    const forecasts = await builder.buildForecasts({
      beach: makeBeach(),
      waveData: wave,
      tideData: null,
      weatherData: [],
      buoyData: null,
      cdipData: makeCdipBuoyData(FROZEN_NOW_ISO, 8.0) as never,
      ioosWaterTempC: null,
      coopsWaterTempC: null,
    });

    const prov = forecasts[0].raw_forecast?.wave_height_provenance;
    // Selector falls through to model_swell because CDIP > 1.8× model.
    expect(prov).toEqual(
      expect.objectContaining({
        source: "model_swell",
        cdip_rejection: expect.objectContaining({
          reason: "cdip_outlier_vs_model",
        }),
      }),
    );
    expect(prov?.cdip_rejection?.raw_cdip_hs).toBeCloseTo(8.0, 2);
    expect(prov?.cdip_rejection?.raw_model_hs).toBeCloseTo(3.28, 1);
  });
});
