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

import { expectConsoleErrors } from "@/__tests__/setup/test-utils";
import {
  ForecastBuilder,
  hasCalibrationLoss,
  resolveCdipNowcastPoint,
} from "@/lib/services/forecast/forecast-builder";
import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";
import { CDIP_NOWCAST_HORIZON_HOURS } from "@/lib/config/forecast-staleness";
import { FORECAST_HANDOFF_BLEND_ENABLED_FLAG } from "@/lib/flags/forecast-handoff-blend";
import type { Beach } from "@/types/database";

const FROZEN_NOW_ISO = "2026-04-19T15:00:00Z";
const CALIBRATION_COVERAGE_WARNING = /calibrated_shoaling_coverage_gap/;
const HELPER_NOW_MS = Date.parse("2026-06-15T12:00:00Z");

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

const LOW_LONG_PERIOD_SHOALING = {
  version: 1 as const,
  type: "period_lookup" as const,
  buckets: [{ tp_min_s: 15, tp_max_s: 999, factor: 0.36 }],
};

const BLACKS_SHOALING = {
  version: 1 as const,
  type: "period_lookup" as const,
  buckets: [
    { tp_min_s: 0, tp_max_s: 8, factor: 1.57 },
    { tp_min_s: 8, tp_max_s: 12, factor: 1.7 },
    { tp_min_s: 12, tp_max_s: 16, factor: 2.13 },
    { tp_min_s: 16, tp_max_s: 999, factor: 2.4 },
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

function makeTrestlesHandoffWaveData(nowIso: string) {
  const firstModelIso = new Date(Date.parse(nowIso) + 6 * 3_600_000).toISOString();
  return {
    lat: 33.381,
    lng: -117.593,
    data_source: "NOAA_NWS" as const,
    forecast: [
      {
        timestamp: firstModelIso,
        forecast_at: firstModelIso,
        significant_wave_height: 0.61,
        peak_wave_period: 15,
        peak_wave_direction: 220,
        swell_1_height: 0.61, // ~2.0 ft deep-water model swell
        swell_1_period: 15,
        swell_1_direction: 220,
        swell_2_height: 0,
        swell_2_period: 0,
        swell_2_direction: 0,
        wind_wave_height: 0,
        wind_wave_period: 0,
        wind_wave_direction: 0,
        data_source: "NOAA_NWS" as const,
      },
    ],
  };
}

function makeBlacksSpikeWaveData(nowIso: string) {
  return {
    lat: 32.887,
    lng: -117.252,
    data_source: "NOAA_NWS" as const,
    forecast: [
      {
        timestamp: nowIso,
        forecast_at: nowIso,
        significant_wave_height: 0.9,
        peak_wave_period: 12,
        peak_wave_direction: 270,
        swell_1_height: 0.91, // ~3 ft
        swell_1_period: 12,
        swell_1_direction: 270,
        swell_2_height: 0,
        swell_2_period: 0,
        swell_2_direction: 0,
        wind_wave_height: 1.07, // ~3.5 ft
        wind_wave_period: 8.1,
        wind_wave_direction: 270,
        data_source: "NOAA_NWS" as const,
      },
    ],
  };
}

function makeCdipBuoyData(
  nowIso: string,
  sigHeightFt: number,
  periodS = 14,
  directionDeg = 270,
) {
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
        peakWaveDirection: directionDeg,
      },
    ],
  };
}

function makeCdipForAge(ageHours: number) {
  return {
    stationId: "201",
    stationName: "Test CDIP",
    dataSource: "CDIP" as const,
    lastUpdated: "",
    data: [
      {
        timestamp: new Date(HELPER_NOW_MS - ageHours * 3_600_000).toISOString(),
        significantWaveHeight: 3.9,
        peakWavePeriod: 15,
        peakWaveDirection: 200,
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

function findHandoffMetricLog(calls: unknown[][]): unknown[] | undefined {
  return calls.find(([, eventName]) => eventName === "handoff_discontinuity_ft");
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(FROZEN_NOW_ISO));
  delete process.env[FORECAST_HANDOFF_BLEND_ENABLED_FLAG];
});

afterEach(() => {
  jest.useRealTimers();
  delete process.env[FORECAST_HANDOFF_BLEND_ENABLED_FLAG];
});

describe("hasCalibrationLoss", () => {
  // Phase 21: the trusted layer resolves coverage beach slugs through the
  // shared service-role mock, which answers nothing here, so it reports
  // coverage as unavailable once and serves baseline. Declared, not silenced.
  // Registered inside the describe so it runs before jest.setup's own check.
  afterEach(() => {
    expectConsoleErrors([/trusted_forecast_coverage_unavailable/]);
  });
  it("flags a calibrated beach that lost calibration on some slots", () => {
    expect(
      hasCalibrationLoss({
        beachId: "b",
        calibrated: true,
        nowcastEligibleSlots: 2,
        calibratedSlots: 1,
      }),
    ).toBe(true);
  });

  it("does not flag full coverage", () => {
    expect(
      hasCalibrationLoss({
        beachId: "b",
        calibrated: true,
        nowcastEligibleSlots: 2,
        calibratedSlots: 2,
      }),
    ).toBe(false);
  });

  it("does not flag uncalibrated beaches", () => {
    expect(
      hasCalibrationLoss({
        beachId: "b",
        calibrated: false,
        nowcastEligibleSlots: 2,
        calibratedSlots: 0,
      }),
    ).toBe(false);
  });
});

describe("resolveCdipNowcastPoint", () => {
  // Phase 21: the trusted layer resolves coverage beach slugs through the
  // shared service-role mock, which answers nothing here, so it reports
  // coverage as unavailable once and serves baseline. Declared, not silenced.
  // Registered inside the describe so it runs before jest.setup's own check.
  afterEach(() => {
    expectConsoleErrors([/trusted_forecast_coverage_unavailable/]);
  });
  it("returns the latest point for the legacy now slot", () => {
    expect(
      resolveCdipNowcastPoint({
        cdipData: makeCdipForAge(1),
        targetMs: HELPER_NOW_MS,
        nowMs: HELPER_NOW_MS,
        horizonHours: 1,
        maxMeasurementAgeHours: Infinity,
      }),
    ).toEqual(
      expect.objectContaining({
        significantWaveHeight: 3.9,
      }),
    );
  });

  it("preserves legacy 1h behavior by dropping a 3h-ahead slot", () => {
    expect(
      resolveCdipNowcastPoint({
        cdipData: makeCdipForAge(1),
        targetMs: HELPER_NOW_MS + 3 * 3_600_000,
        nowMs: HELPER_NOW_MS,
        horizonHours: 1,
        maxMeasurementAgeHours: Infinity,
      }),
    ).toBeNull();
  });

  it("ignores malformed timestamps and returns the freshest valid point", () => {
    const cdipData = makeCdipForAge(2);
    cdipData.data.push({
      timestamp: "not-a-date",
      significantWaveHeight: 9.9,
      peakWavePeriod: 18,
      peakWaveDirection: 220,
    });

    expect(
      resolveCdipNowcastPoint({
        cdipData,
        targetMs: HELPER_NOW_MS,
        nowMs: HELPER_NOW_MS,
        horizonHours: 1,
        maxMeasurementAgeHours: Infinity,
      }),
    ).toEqual(
      expect.objectContaining({
        significantWaveHeight: 3.9,
      }),
    );
  });

  it("rejects future-dated CDIP measurements", () => {
    const cdipData = makeCdipForAge(-1);

    expect(
      resolveCdipNowcastPoint({
        cdipData,
        targetMs: HELPER_NOW_MS,
        nowMs: HELPER_NOW_MS,
        horizonHours: 1,
        maxMeasurementAgeHours: 4,
      }),
    ).toBeNull();
  });

  it("ignores future-dated rows when an older valid measurement is available", () => {
    const cdipData = makeCdipForAge(2);
    cdipData.data.push({
      timestamp: new Date(HELPER_NOW_MS + 60_000).toISOString(),
      significantWaveHeight: 9.9,
      peakWavePeriod: 18,
      peakWaveDirection: 220,
    });

    expect(
      resolveCdipNowcastPoint({
        cdipData,
        targetMs: HELPER_NOW_MS,
        nowMs: HELPER_NOW_MS,
        horizonHours: CDIP_NOWCAST_HORIZON_HOURS,
        maxMeasurementAgeHours: 4,
      }),
    ).toEqual(
      expect.objectContaining({
        significantWaveHeight: 3.9,
      }),
    );
  });

  it("applies a fresh buoy reading to a 3h-ahead slot inside the widened horizon", () => {
    expect(
      resolveCdipNowcastPoint({
        cdipData: makeCdipForAge(1),
        targetMs: HELPER_NOW_MS + 3 * 3_600_000,
        nowMs: HELPER_NOW_MS,
        horizonHours: CDIP_NOWCAST_HORIZON_HOURS,
        maxMeasurementAgeHours: 4,
      }),
    ).toEqual(
      expect.objectContaining({
        significantWaveHeight: 3.9,
      }),
    );
  });

  it("drops slots beyond the widened horizon and stale measurements inside it", () => {
    expect(
      resolveCdipNowcastPoint({
        cdipData: makeCdipForAge(1),
        targetMs: HELPER_NOW_MS + 5 * 3_600_000,
        nowMs: HELPER_NOW_MS,
        horizonHours: CDIP_NOWCAST_HORIZON_HOURS,
        maxMeasurementAgeHours: 4,
      }),
    ).toBeNull();

    expect(
      resolveCdipNowcastPoint({
        cdipData: makeCdipForAge(6),
        targetMs: HELPER_NOW_MS,
        nowMs: HELPER_NOW_MS,
        horizonHours: CDIP_NOWCAST_HORIZON_HOURS,
        maxMeasurementAgeHours: 4,
      }),
    ).toBeNull();
  });
});

describe("ForecastBuilder CDIP height semantics", () => {
  // Phase 21: the trusted layer resolves coverage beach slugs through the
  // shared service-role mock, which answers nothing here, so it reports
  // coverage as unavailable once and serves baseline. Declared, not silenced.
  // Registered inside the describe so it runs before jest.setup's own check.
  afterEach(() => {
    expectConsoleErrors([/trusted_forecast_coverage_unavailable/]);
  });
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
    expectConsoleWarnings([CALIBRATION_COVERAGE_WARNING]);

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

  test("Rincon-style low long-period CDIP bucket renders from generic path with quarantine debug", async () => {
    const builder = makeBuilder();

    const forecasts = await builder.buildForecasts({
      beach: makeBeach({
        name: "Rincon",
        shoaling_factors: LOW_LONG_PERIOD_SHOALING as unknown as Beach["shoaling_factors"],
      }),
      waveData: makeWaveData(FROZEN_NOW_ISO),
      tideData: null,
      weatherData: [],
      buoyData: null,
      cdipData: makeCdipBuoyData(FROZEN_NOW_ISO, 4.2, 18, 205) as never,
      ioosWaterTempC: null,
      coopsWaterTempC: null,
    });
    expectConsoleWarnings([CALIBRATION_COVERAGE_WARNING]);

    const prov = forecasts[0].raw_forecast?.wave_height_provenance;
    expect(extractFt(forecasts[0].wave_height)).toBeGreaterThan(4.5);
    expect(prov).toEqual(
      expect.objectContaining({
        source: "cdip_sig",
        transform_path: "scalar_generic",
        components_used: false,
        calibrated_shoaling_fired: false,
        calibration_bucket_quarantined: true,
      }),
    );
    expect(prov?.calibration_bucket_quarantined).toBe(true);
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
        provenance: "population_prior_v1",
      }),
    );
    expect(prov?.source).not.toBe("cdip_sig");
    expect(prov?.source).not.toBe("nowcast_anchor");
    // NOAA path produces a non-trivial face height (multi-component sum).
    expect(extractFt(forecasts[0].wave_height)).toBeGreaterThan(2);
  });

  test("NOAA-only Blacks spike: 8s wind-wave is not treated as full surf-height swell", async () => {
    const builder = makeBuilder();

    const forecasts = await builder.buildForecasts({
      beach: makeBeach({
        id: "01330afc-00d3-461b-88f3-b173774766f4",
        name: "Blacks Beach",
        lat: 32.887,
        lon: -117.252,
        swell_window_center_deg: 268,
        swell_window_halfwidth_deg: 73,
        deepwater_decay_factor: 1.15,
        shoaling_factors: BLACKS_SHOALING as unknown as Beach["shoaling_factors"],
      }),
      waveData: makeBlacksSpikeWaveData(FROZEN_NOW_ISO),
      tideData: null,
      weatherData: [],
      buoyData: null,
      cdipData: null,
      ioosWaterTempC: null,
      coopsWaterTempC: null,
    });
    expectConsoleWarnings([CALIBRATION_COVERAGE_WARNING]);

    const actualFt = extractFt(forecasts[0].wave_height);
    expect(actualFt).toBeGreaterThanOrEqual(3.5);
    expect(actualFt).toBeLessThanOrEqual(4.0);
    expect(forecasts[0].swell_1_height).toBe("3 ft");
    expect(forecasts[0].wind_wave_height).toBe("3.5 ft");
    expect(forecasts[0].wind_wave_period).toBe("8s");

    const prov = forecasts[0].raw_forecast?.wave_height_provenance;
    expect(prov).toEqual(
      expect.objectContaining({
        source: "model_swell",
        transform_path: "decomposed",
        components_used: true,
        calibrated_shoaling_fired: false,
      }),
    );
    expect(prov?.raw_value_ft).toBeCloseTo(3.0, 1);
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

  test("CDIP is retained when model total Hs corroborates a low primary partition", async () => {
    const builder = makeBuilder();
    const wave = makeWaveData(FROZEN_NOW_ISO);
    wave.forecast[0].swell_1_height = 1.0; // ≈3.28 ft primary partition
    wave.forecast[0].significant_wave_height = 2.6; // ≈8.53 ft total sea state

    const forecasts = await builder.buildForecasts({
      beach: makeBeach({
        shoaling_factors: CALIBRATED_SHOALING as unknown as Beach["shoaling_factors"],
      }),
      waveData: wave,
      tideData: null,
      weatherData: [],
      buoyData: null,
      cdipData: makeCdipBuoyData(FROZEN_NOW_ISO, 8.0) as never,
      ioosWaterTempC: null,
      coopsWaterTempC: null,
    });

    const prov = forecasts[0].raw_forecast?.wave_height_provenance;
    expect(prov).toEqual(
      expect.objectContaining({
        source: "cdip_sig",
        transform_path: "scalar_calibrated",
        calibrated_shoaling_fired: true,
      }),
    );
    expect(prov?.cdip_rejection).toBeUndefined();
    expect(extractFt(forecasts[0].wave_height)).toBe(15);
  });

  test("fresh CDIP drives now and +3h slots, while +6h remains model-backed", async () => {
    const builder = makeBuilder();
    const consoleWarnSpy = jest.spyOn(console, "warn");

    const forecasts = await builder.buildForecasts({
      beach: makeBeach({
        id: "beach-cdip-window",
        name: "CDIP Window Beach",
        shoaling_factors: CALIBRATED_SHOALING as unknown as Beach["shoaling_factors"],
      }),
      waveData: makeWaveData(FROZEN_NOW_ISO),
      tideData: null,
      weatherData: [],
      buoyData: null,
      cdipData: makeCdipBuoyData(FROZEN_NOW_ISO, 2.0) as never,
      ioosWaterTempC: null,
      coopsWaterTempC: null,
    });

    expect(forecasts[0].data_source).toBe("CDIP");
    expect(forecasts[1].data_source).toBe("CDIP");
    expect(forecasts[2].data_source).toBe("NOAA_NWS");

    expect(forecasts[0].raw_forecast?.wave_height_provenance).toEqual(
      expect.objectContaining({
        source: "cdip_sig",
        transform_path: "scalar_calibrated",
        calibrated_shoaling_fired: true,
      }),
    );
    expect(forecasts[1].raw_forecast?.wave_height_provenance).toEqual(
      expect.objectContaining({
        source: "cdip_sig",
        transform_path: "scalar_calibrated",
        calibrated_shoaling_fired: true,
      }),
    );
    expect(forecasts[2].raw_forecast?.wave_height_provenance).toEqual(
      expect.objectContaining({
        source: "model_swell",
        calibrated_shoaling_fired: false,
      }),
    );

    expect(extractFt(forecasts[0].wave_height)).toBeCloseTo(4.0, 1);
    expect(extractFt(forecasts[1].wave_height)).toBeCloseTo(4.0, 1);

    const coverageCall = consoleWarnSpy.mock.calls.find(
      ([, eventName]) => eventName === "calibrated_shoaling_coverage_gap",
    );
    consoleWarnSpy.mockRestore();
    expect(coverageCall).toBeUndefined();
  });

  test("calibrated beach logs a coverage gap when later slots lose calibrated shoaling", async () => {
    const builder = makeBuilder();
    const consoleWarnSpy = jest.spyOn(console, "warn");
    const staleCdipIso = new Date(
      Date.parse(FROZEN_NOW_ISO) - 6 * 3_600_000,
    ).toISOString();

    await builder.buildForecasts({
      beach: makeBeach({
        id: "beach-with-calibration-gap",
        name: "Calibration Gap Beach",
        shoaling_factors: CALIBRATED_SHOALING as unknown as Beach["shoaling_factors"],
      }),
      waveData: makeWaveData(FROZEN_NOW_ISO),
      tideData: null,
      weatherData: [],
      buoyData: null,
      cdipData: makeCdipBuoyData(staleCdipIso, 2.0) as never,
      ioosWaterTempC: null,
      coopsWaterTempC: null,
    });
    expectConsoleWarnings([CALIBRATION_COVERAGE_WARNING]);

    const coverageCall = consoleWarnSpy.mock.calls.find(
      ([, eventName]) => eventName === "calibrated_shoaling_coverage_gap",
    );
    consoleWarnSpy.mockRestore();
    if (!coverageCall) {
      throw new Error("expected calibrated_shoaling_coverage_gap warning");
    }

    const [, , payload] = coverageCall as [
      string,
      string,
      {
        beachId: string;
        beachName: string;
        nowcastEligibleSlots: number;
        calibratedSlots: number;
        lostSlots: number;
      },
    ];
    expect(payload).toEqual(
      expect.objectContaining({
        beachId: "beach-with-calibration-gap",
        beachName: "Calibration Gap Beach",
      }),
    );
    expect(payload.nowcastEligibleSlots).toBe(2);
    expect(payload.calibratedSlots).toBeLessThan(payload.nowcastEligibleSlots);
    expect(payload.lostSlots).toBe(
      payload.nowcastEligibleSlots - payload.calibratedSlots,
    );
  });

  test("default-off Trestles handoff records the seam metric without changing model height", async () => {
    const builder = makeBuilder();
    const consoleInfoSpy = jest
      .spyOn(console, "info")
      .mockImplementation(() => undefined);
    const consoleLogSpy = jest
      .spyOn(console, "log")
      .mockImplementation(() => undefined);

    try {
      const forecasts = await builder.buildForecasts({
        beach: makeBeach({
          id: "lower-trestles",
          name: "Lower Trestles",
          swell_window_center_deg: 220,
          swell_window_halfwidth_deg: 105,
          deepwater_decay_factor: 0.6,
          shoaling_factors: {
            version: 1,
            type: "period_lookup",
            buckets: [{ tp_min_s: 16, tp_max_s: 999, factor: 1.62 }],
          } as unknown as Beach["shoaling_factors"],
        }),
        waveData: makeTrestlesHandoffWaveData(FROZEN_NOW_ISO),
        tideData: null,
        weatherData: [],
        buoyData: null,
        cdipData: makeCdipBuoyData(FROZEN_NOW_ISO, 3.27, 17) as never,
        ioosWaterTempC: null,
        coopsWaterTempC: null,
      });

      expect(forecasts[0].data_source).toBe("CDIP");
      expect(forecasts[1].data_source).toBe("CDIP");
      expect(forecasts[2].data_source).toBe("NOAA_NWS");
      expect(extractFt(forecasts[1].wave_height)).toBeCloseTo(5.3, 1);
      expect(extractFt(forecasts[2].wave_height)).toBeCloseTo(1.4, 1);

      const provenance = forecasts[2].raw_forecast?.wave_height_provenance;
      expect(provenance).toEqual(
        expect.objectContaining({
          source: "model_swell",
          transform_path: "decomposed",
          components_used: true,
          handoff_discontinuity_ft: 3.9,
        }),
      );
      expect(provenance?.handoff_blend).toBeUndefined();
      expect(findHandoffMetricLog(consoleInfoSpy.mock.calls)).toBeUndefined();
      expect(findHandoffMetricLog(consoleLogSpy.mock.calls)?.[2]).toEqual(
        expect.objectContaining({
          blendEnabled: false,
          blendApplied: false,
          handoff_discontinuity_ft: 3.9,
        }),
      );
    } finally {
      consoleInfoSpy.mockRestore();
      consoleLogSpy.mockRestore();
    }
  });

  test("enabled Trestles handoff blend improves the first model slot without changing CDIP slots or source provenance", async () => {
    process.env[FORECAST_HANDOFF_BLEND_ENABLED_FLAG] = "true";
    const builder = makeBuilder();
    const consoleInfoSpy = jest
      .spyOn(console, "info")
      .mockImplementation(() => undefined);
    const consoleLogSpy = jest
      .spyOn(console, "log")
      .mockImplementation(() => undefined);

    try {
      const forecasts = await builder.buildForecasts({
        beach: makeBeach({
          id: "lower-trestles",
          name: "Lower Trestles",
          swell_window_center_deg: 220,
          swell_window_halfwidth_deg: 105,
          deepwater_decay_factor: 0.6,
          shoaling_factors: {
            version: 1,
            type: "period_lookup",
            buckets: [{ tp_min_s: 16, tp_max_s: 999, factor: 1.62 }],
          } as unknown as Beach["shoaling_factors"],
        }),
        waveData: makeTrestlesHandoffWaveData(FROZEN_NOW_ISO),
        tideData: null,
        weatherData: [],
        buoyData: null,
        cdipData: makeCdipBuoyData(FROZEN_NOW_ISO, 3.27, 17) as never,
        ioosWaterTempC: null,
        coopsWaterTempC: null,
      });

      expect(extractFt(forecasts[0].wave_height)).toBeCloseTo(5.3, 1);
      expect(extractFt(forecasts[1].wave_height)).toBeCloseTo(5.3, 1);
      expect(extractFt(forecasts[2].wave_height)).toBeCloseTo(2.8, 1);

      const provenance = forecasts[2].raw_forecast?.wave_height_provenance;
      expect(provenance).toEqual(
        expect.objectContaining({
          source: "model_swell",
          transform_path: "decomposed",
          components_used: true,
          handoff_discontinuity_ft: 3.9,
          handoff_blend: expect.objectContaining({
            original_face_ft: 1.4,
            blended_face_ft: 2.8,
            clamped_ratio: 2,
            taper_factor: 2,
          }),
        }),
      );
      expect(findHandoffMetricLog(consoleInfoSpy.mock.calls)?.[2]).toEqual(
        expect.objectContaining({
          blendEnabled: true,
          blendApplied: true,
          handoff_discontinuity_ft: 3.9,
        }),
      );
      expect(findHandoffMetricLog(consoleLogSpy.mock.calls)).toBeUndefined();
    } finally {
      consoleInfoSpy.mockRestore();
      consoleLogSpy.mockRestore();
    }
  });
});
