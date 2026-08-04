/**
 * Tests for the per-beach height-offset hook in ForecastBuilder.buildSingleForecast.
 *
 * Critical invariants verified:
 *  1. height_offset_enabled=false → wave_height byte-identical to today.
 *  2. Flag enabled but offset row missing → falls through unchanged.
 *  3. Flag enabled + all gates passing → wave_height reflects corrected midpoint
 *     and snapshot row is buffered with raw < corrected diff matching offset.
 *  4. Telemetry feedback-loop invariant: snapshot's raw_display_height_m is
 *     the PRE-offset value (captured before applyBeachHeightOffset runs).
 *
 * The strategy is to mock the wave-formatter so getWaveHeight returns a known
 * stable string ("3 ft"), then assert how the offset hook reshapes the output.
 */

import { ForecastBuilder } from "../forecast-builder";
import type {
  ForecastInputs,
  BeachHeightOffsetRow,
} from "../forecast-builder";
import type { Beach } from "@/types/database";
import { METERS_TO_FEET } from "@/lib/utils/unit-conversions";
import type { FeedbackHeightCalibrationCandidate } from "../feedback-height-calibration";
import type { TrustedExternalForecastRow } from "../trusted-forecast-adjustment";

// Capture insert calls so we can assert no snapshot ever leaks out (the
// fire-and-forget invariant — we are testing the buffer, not the writer).
const insertMock: jest.Mock = jest.fn().mockResolvedValue({ data: null, error: null });
const fromMock: jest.Mock = jest.fn(() => ({ insert: insertMock }));

jest.mock("@/lib/supabase", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => fromMock(table),
  }),
}));

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

jest.mock("../trusted-forecast-adjustment", () => {
  const actual = jest.requireActual("../trusted-forecast-adjustment");
  return {
    ...actual,
    loadTrustedExternalForecastsForBeach: jest.fn(async () => []),
    persistTrustedForecastDecisions: jest.fn(async () => true),
  };
});

// Pin getWaveHeight output to a known string so we can deterministically
// reason about parser/formatter/offset interactions.
let mockWaveHeightValue = "3 ft";
jest.mock("@/lib/utils/wave-formatters", () => {
  const actual = jest.requireActual("@/lib/utils/unit-conversions");
  return {
    toFaceHeightFeet: jest.fn(() => mockWaveHeightValue),
    toFaceHeightFeetDecomposed: jest.fn(() => mockWaveHeightValue),
    toFaceHeightFeetDecomposedWithDebug: jest.fn(() => ({
      value: mockWaveHeightValue,
      debug: {
        source: "model_swell",
        rawHeightFt: 3,
        transformPath: "decomposed",
        componentsUsed: true,
        calibratedShoalingFired: false,
      },
    })),
    metersToFeet: jest.fn((m: number) => m * actual.METERS_TO_FEET),
    METERS_TO_FEET: actual.METERS_TO_FEET,
  };
});

// Capture the snapshot buffer as it grows. We patch logDisplayPredictions to
// pull the rows out of the fire-and-forget dispatch so tests can assert on
// what was queued.
let capturedSnapshotRows: any[] = [];
jest.mock("../log-display-prediction", () => ({
  logDisplayPredictions: jest.fn(async (rows: any[]) => {
    capturedSnapshotRows = capturedSnapshotRows.concat(rows ?? []);
  }),
}));

const baseBeach: Beach = {
  id: "beach-1",
  name: "Test Beach",
  lat: 32.7,
  lon: -117.2,
} as Beach;

const buildInputs = (overrides: Partial<ForecastInputs> = {}): ForecastInputs =>
  ({
    beach: baseBeach,
    waveData: {
      lat: 32.7,
      lng: -117.2,
      forecast: [
        {
          timestamp: new Date().toISOString(),
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
          om_values: {
            wave_height_om: 1.1,
            wave_period_om: 11,
            wave_direction_om: 230,
            wave_peak_period_om: 12,
            swell_height_om: 0.7,
            swell_period_om: 13,
            swell_direction_om: 225,
            swell_wave_peak_period_om: 15,
            wind_wave_height_om: 0.2,
            wind_wave_period_om: 5,
            wind_wave_direction_om: 205,
            wind_wave_peak_period_om: 7,
            secondary_swell_height_om: 0.25,
            secondary_swell_period_om: 11,
            secondary_swell_direction_om: 190,
            tertiary_swell_height_om: 0.15,
            tertiary_swell_period_om: 9,
            tertiary_swell_direction_om: 145,
            om_wind_wave_missing: false,
            om_primary_swell_missing: false,
            om_secondary_swell_missing: false,
            om_tertiary_swell_missing: false,
            om_partition_schema_version: 1,
          },
        },
      ],
    } as any,
    tideData: null,
    weatherData: [
      {
        startTime: new Date().toISOString(),
        temperature: 66,
        windSpeed: "12 mph",
        windDirection: "W",
        shortForecast: "Clear",
      },
    ],
    buoyData: null,
    cdipData: null,
    ioosWaterTempC: null,
    coopsWaterTempC: null,
    ...overrides,
  }) as ForecastInputs;

const newBuilder = () =>
  new ForecastBuilder({
    getWaveDirectionText: () => "SW",
    getTideStatusAtTime: () => "Rising",
    getTideHeightAtTime: () => 3.5,
    getNextTideFromTime: () => ({
      time: Math.floor(Date.now() / 1000) + 7200,
      height: 5.2,
      type: "high",
      name: "High",
    }),
    getDataQualityScore: () => 85,
  });

describe("ForecastBuilder per-beach height-offset hook", () => {
  beforeEach(() => {
    delete process.env.FEEDBACK_HEIGHT_CALIBRATION_ENABLED;
    delete process.env.MODEL_SWELL_HEIGHT_BLEND_ENABLED;
    delete process.env.TRUSTED_FORECAST_ADJUSTMENTS_ENABLED;
    mockWaveHeightValue = "3 ft";
    capturedSnapshotRows = [];
    insertMock.mockClear();
    fromMock.mockClear();
  });

  it("applies the temporary feedback layer after the existing beach offset", async () => {
    process.env.FEEDBACK_HEIGHT_CALIBRATION_ENABLED = "true";
    const flagBeach = {
      ...baseBeach,
      height_offset_enabled: true,
    } as unknown as Beach;
    const offsetRow: BeachHeightOffsetRow = {
      offset_m: 0.1524,
      sample_count: 60,
      mae_before_m: 0.4,
      mae_after_m: 0.18,
      computed_at: new Date().toISOString(),
    };
    const candidate: FeedbackHeightCalibrationCandidate = {
      id: "candidate-1",
      beach_id: "beach-1",
      status: "active_temp",
      offset_ft: 0.5,
      sample_count: 5,
      unique_user_count: 3,
      activated_at: new Date(Date.now() - 60_000).toISOString(),
      expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const builder = newBuilder();
    await builder.buildForecasts(
      buildInputs({
        beach: flagBeach,
        heightOffset: offsetRow,
        feedbackCalibrationCandidate: candidate,
      }),
    );

    const bothApplied = capturedSnapshotRows.filter(
      (row) =>
        row.height_offset_m != null &&
        row.feedback_height_calibration_applied === true,
    );
    expect(bothApplied.length).toBeGreaterThan(0);
    for (const row of bothApplied) {
      expect(row.height_offset_m).toBe(0.1524);
      expect(row.feedback_height_calibration_candidate_id).toBe("candidate-1");
      expect(row.feedback_height_offset_ft).toBe(0.5);
      expect(
        row.raw_display_height_m - row.offset_corrected_display_height_m,
      ).toBeCloseTo(0.3048, 2);
    }
  });

  it("preserves range formatting when the temporary layer applies", async () => {
    process.env.FEEDBACK_HEIGHT_CALIBRATION_ENABLED = "true";
    mockWaveHeightValue = "3-4ft";
    const candidate: FeedbackHeightCalibrationCandidate = {
      id: "candidate-1",
      beach_id: "beach-1",
      status: "active_temp",
      offset_ft: 0.5,
      sample_count: 5,
      unique_user_count: 3,
      activated_at: new Date(Date.now() - 60_000).toISOString(),
      expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const forecasts = await newBuilder().buildForecasts(
      buildInputs({
        heightOffset: null,
        feedbackCalibrationCandidate: candidate,
      }),
    );

    expect(forecasts.length).toBeGreaterThan(0);
    const appliedIndexes = capturedSnapshotRows.flatMap((row, index) =>
      row.feedback_height_calibration_applied ? [index] : [],
    );
    expect(appliedIndexes.length).toBeGreaterThan(0);
    for (const index of appliedIndexes) {
      expect(forecasts[index]?.wave_height).toBe("2-4ft");
    }
  });

  it("applies WaveCast after the beach offset and suppresses feedback stacking", async () => {
    process.env.FEEDBACK_HEIGHT_CALIBRATION_ENABLED = "true";
    process.env.TRUSTED_FORECAST_ADJUSTMENTS_ENABLED = "true";
    const issuedAt = new Date(Date.now() - 60_000);
    const validStart = new Date(Date.now() - 60 * 60 * 1000);
    const validEnd = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const candidate: FeedbackHeightCalibrationCandidate = {
      id: "candidate-1",
      beach_id: "beach-1",
      status: "active_temp",
      offset_ft: 0.5,
      sample_count: 5,
      unique_user_count: 3,
      activated_at: issuedAt.toISOString(),
      expires_at: validEnd.toISOString(),
    };
    const waveCast: TrustedExternalForecastRow = {
      id: "00000000-0000-0000-0000-000000000001",
      provider: "wavecast",
      source_scope: "spot",
      source_key: "test-beach",
      beach_id: "beach-1",
      issued_at: issuedAt.toISOString(),
      valid_start: validStart.toISOString(),
      valid_end: validEnd.toISOString(),
      min_face_ft: 4,
      max_face_ft: 5,
    };

    const forecasts = await newBuilder().buildForecasts(
      buildInputs({
        heightOffset: null,
        feedbackCalibrationCandidate: candidate,
        trustedExternalForecasts: [waveCast],
      }),
    );

    const adjustedRows = capturedSnapshotRows.filter(
      (row) => row.trusted_forecast_adjustment_applied === true,
    );
    expect(adjustedRows.length).toBeGreaterThan(0);
    const publicForecastPayload = JSON.stringify(forecasts);
    expect(publicForecastPayload).not.toContain("wavecast");
    expect(publicForecastPayload).not.toContain(waveCast.id);
    expect(publicForecastPayload).not.toContain("trusted_forecast");
    for (const row of adjustedRows) {
      const forecast = forecasts.find(
        (candidate) => candidate.forecast_at === row.predicted_at,
      );
      expect(forecast?.wave_height).toBe("3-4ft");
      expect(row.trusted_forecast_offset_ft).toBe(-0.5);
      expect(row.trusted_forecast_adjustment_key).toMatch(/^[a-f0-9]{64}$/);
      expect(row.feedback_height_calibration_applied).toBe(false);
      expect(row.feedback_height_calibration_candidate_id).toBeNull();
      expect(row.offset_corrected_display_height_m).toBeCloseTo(
        3.5 / METERS_TO_FEET,
        3,
      );
    }
  });

  it("flag disabled → wave_height byte-identical to today's getWaveHeight output", async () => {
    const builder = newBuilder();
    const forecasts = await builder.buildForecasts(
      buildInputs({
        // No heightOffset row, no flag. Pass undefined explicitly to ensure
        // the inline fetch is also skipped (flag false short-circuits it).
        heightOffset: undefined,
      })
    );

    // Every row should carry the unmodified mock string from getWaveHeight.
    expect(forecasts.length).toBeGreaterThan(0);
    for (const f of forecasts) {
      expect(f.wave_height).toBe("3 ft");
    }
  });

  it("applies the bounded model-swell blend through the forecast builder", async () => {
    process.env.MODEL_SWELL_HEIGHT_BLEND_ENABLED = "true";
    const inputs = buildInputs();
    const sourceWavePoint = (inputs.waveData as any).forecast[0];
    const startMs = Date.now();
    (inputs.waveData as any).forecast = Array.from(
      { length: 97 },
      (_, index) => ({
        ...sourceWavePoint,
        timestamp: new Date(startMs + index * 3 * 60 * 60 * 1000).toISOString(),
      }),
    );

    const forecasts = await newBuilder().buildForecasts(inputs);

    expect(forecasts.length).toBeGreaterThan(0);
    const shortHorizonRows = capturedSnapshotRows.filter(
      (row) => row.forecast_horizon_hours <= 72,
    );
    const longHorizonRows = capturedSnapshotRows.filter(
      (row) => row.forecast_horizon_hours > 72,
    );
    expect(shortHorizonRows.length).toBeGreaterThan(0);
    expect(longHorizonRows.length).toBeGreaterThan(0);
    for (const row of shortHorizonRows) {
      expect(row.raw_display_height_m).toBeCloseTo(3.2 / METERS_TO_FEET, 3);
      expect(row.model_version).toBe("face-Hs-om-blend-v1");
    }
    for (const row of longHorizonRows) {
      expect(row.raw_display_height_m).toBeCloseTo(3 / METERS_TO_FEET, 3);
      expect(row.model_version).toBe("face-Hs-transformer-v1");
    }
  });

  it("leaves range-form forecasts unchanged", async () => {
    process.env.MODEL_SWELL_HEIGHT_BLEND_ENABLED = "true";
    mockWaveHeightValue = "3-4ft";

    const forecasts = await newBuilder().buildForecasts(buildInputs());

    expect(forecasts[0]?.wave_height).toBe("3-4ft");
    expect(capturedSnapshotRows[0]?.model_version).toBe(
      "face-Hs-transformer-v1",
    );
  });

  it("flag disabled → snapshot still records raw_display_height_m (telemetry)", async () => {
    // The snapshot writer captures display values regardless of whether the
    // offset is applied. This is what lets the cron eventually compute an
    // offset for beaches with the flag off.
    const builder = newBuilder();
    await builder.buildForecasts(buildInputs());

    expect(capturedSnapshotRows.length).toBeGreaterThan(0);

    // Every snapshot row's offset-corrected value must equal raw when no
    // offset was applied.
    for (const row of capturedSnapshotRows) {
      expect(row.offset_corrected_display_height_m).toBe(
        row.raw_display_height_m
      );
      expect(row.height_offset_m).toBeNull();
      expect(row.height_offset_sample_count).toBeNull();
      // raw_display_height_m should match parser output: 3 ft -> ~0.914 m.
      const expectedM = Number((3 / METERS_TO_FEET).toFixed(3));
      expect(row.raw_display_height_m).toBe(expectedM);
    }
  });

  it("flag enabled but offset row missing → wave_height unchanged", async () => {
    const flagBeach = {
      ...baseBeach,
      height_offset_enabled: true,
    } as unknown as Beach;

    const builder = newBuilder();
    const forecasts = await builder.buildForecasts(
      buildInputs({ beach: flagBeach, heightOffset: null })
    );

    for (const f of forecasts) {
      expect(f.wave_height).toBe("3 ft");
    }
  });

  it("all gates passing → wave_height reflects corrected midpoint", async () => {
    const flagBeach = {
      ...baseBeach,
      height_offset_enabled: true,
    } as unknown as Beach;

    // 0.3m offset positive → corrected_ft = 3 - (0.3 * 3.28084) ≈ 2.016 ft
    const offsetRow: BeachHeightOffsetRow = {
      offset_m: 0.3,
      sample_count: 60,
      mae_before_m: 0.4,
      mae_after_m: 0.18,
      computed_at: new Date().toISOString(),
    };

    const builder = newBuilder();
    const forecasts = await builder.buildForecasts(
      buildInputs({ beach: flagBeach, heightOffset: offsetRow })
    );

    // Slot 0 is at horizon ~0h — gate fails (minHorizonHours=24).
    // Slots 8+ (3h interval × 8 = 24h) start to pass the horizon gate.
    // We assert at least one row got corrected and at least one stayed raw.
    const correctedRows = forecasts.filter((f) => f.wave_height !== "3 ft");
    const unchangedRows = forecasts.filter((f) => f.wave_height === "3 ft");
    expect(correctedRows.length).toBeGreaterThan(0);
    expect(unchangedRows.length).toBeGreaterThan(0);

    // The corrected output should reflect the midpoint shift. Mocked input
    // is "3 ft" (single value, no range spread), so formatDisplayHeightFt
    // returns the formatWaveHeightRange single-value form. Corrected
    // ≈ 2.016 ft → "2ft" (or similar single-value form).
    for (const r of correctedRows) {
      expect(r.wave_height).not.toBe("3 ft");
      expect(typeof r.wave_height).toBe("string");
    }
  });

  it("snapshot raw is captured BEFORE offset (telemetry feedback-loop invariant)", async () => {
    const flagBeach = {
      ...baseBeach,
      height_offset_enabled: true,
    } as unknown as Beach;

    const offsetM = 0.3;
    const offsetRow: BeachHeightOffsetRow = {
      offset_m: offsetM,
      sample_count: 60,
      mae_before_m: 0.4,
      mae_after_m: 0.18,
      computed_at: new Date().toISOString(),
    };

    const builder = newBuilder();
    await builder.buildForecasts(
      buildInputs({ beach: flagBeach, heightOffset: offsetRow })
    );

    // For rows where the offset actually applied (height_offset_m non-null),
    // raw - corrected should equal offset_m exactly (modulo NUMERIC(5,3)
    // rounding and the float roundtrip through ft).
    const appliedRows = capturedSnapshotRows.filter(
      (r) => r.height_offset_m != null
    );
    expect(appliedRows.length).toBeGreaterThan(0);

    for (const r of appliedRows) {
      const diff =
        r.raw_display_height_m - r.offset_corrected_display_height_m;
      // Tolerance covers the .toFixed(3) rounding on each side.
      expect(diff).toBeCloseTo(offsetM, 2);
      expect(r.raw_display_height_m).toBeGreaterThan(
        r.offset_corrected_display_height_m
      );
      expect(r.height_offset_m).toBe(offsetM);
      expect(r.height_offset_sample_count).toBe(60);
    }

    // Rows where the offset did NOT apply (e.g. 0-24h horizons) must still
    // record raw_display_height_m, with corrected == raw and offset null.
    const notAppliedRows = capturedSnapshotRows.filter(
      (r) => r.height_offset_m == null
    );
    expect(notAppliedRows.length).toBeGreaterThan(0);
    for (const r of notAppliedRows) {
      expect(r.offset_corrected_display_height_m).toBe(r.raw_display_height_m);
      expect(r.height_offset_sample_count).toBeNull();
    }
  });

  it("forecast_horizon_hours is rounded from forecastTime - issueTime", async () => {
    const flagBeach = {
      ...baseBeach,
      height_offset_enabled: true,
    } as unknown as Beach;

    const builder = newBuilder();
    await builder.buildForecasts(
      buildInputs({
        beach: flagBeach,
        heightOffset: null,
      })
    );

    // First snapshot (slot 0) should be horizon=0; subsequent slots increase
    // by FORECAST_CONSTANTS.INTERVAL_HOURS (3h). We assert monotonic + non-negative.
    expect(capturedSnapshotRows.length).toBeGreaterThan(1);
    for (let i = 1; i < capturedSnapshotRows.length; i++) {
      const prev = capturedSnapshotRows[i - 1].forecast_horizon_hours;
      const cur = capturedSnapshotRows[i].forecast_horizon_hours;
      expect(cur).toBeGreaterThanOrEqual(prev);
      expect(cur).toBeGreaterThanOrEqual(0);
    }
    expect(capturedSnapshotRows[0].forecast_horizon_hours).toBe(0);
  });

  it("forecast_horizon_bucket follows canonical Phase 0 splits", async () => {
    const builder = newBuilder();
    await builder.buildForecasts(buildInputs());

    expect(capturedSnapshotRows.length).toBeGreaterThan(0);

    for (const row of capturedSnapshotRows) {
      const expectedBucket =
        row.forecast_horizon_hours <= 24
          ? "0-24h"
          : row.forecast_horizon_hours <= 72
            ? "25-72h"
            : "73h+";
      expect(row.forecast_horizon_bucket).toBe(expectedBucket);
    }
  });

  it("display_source is face-Hs-transformer-v1", async () => {
    const builder = newBuilder();
    await builder.buildForecasts(buildInputs());

    expect(capturedSnapshotRows.length).toBeGreaterThan(0);
    for (const r of capturedSnapshotRows) {
      expect(r.display_source).toBe("face-Hs-transformer-v1");
      expect(r.display_wave_source).toBe("model_swell");
      expect(r.display_raw_input_height_m).toBeCloseTo(3 / METERS_TO_FEET, 3);
    }
  });

  it("snapshot records ML feature inputs alongside v5 shadow fields", async () => {
    const builder = newBuilder();
    await builder.buildForecasts(buildInputs());

    expect(capturedSnapshotRows.length).toBeGreaterThan(0);
    expect(capturedSnapshotRows[0]).toEqual(
      expect.objectContaining({
        wave_height_om_m: 1.1,
        noaa_swell_1_height_m: 0.8,
        noaa_swell_1_period_s: 14,
        noaa_swell_1_direction_deg: 220,
        noaa_swell_2_height_m: 0,
        noaa_swell_2_period_s: 0,
        noaa_swell_2_direction_deg: 0,
        noaa_wind_wave_height_m: 0.3,
        noaa_wind_wave_period_s: 6,
        noaa_wind_wave_direction_deg: 200,
        wave_period_s: 12,
        wave_direction_deg: 220,
        wave_period_om: 11,
        wave_direction_om: 230,
        wave_peak_period_om: 12,
        swell_height_om: 0.7,
        swell_period_om: 13,
        swell_direction_om: 225,
        swell_wave_peak_period_om: 15,
        wind_wave_height_om: 0.2,
        wind_wave_period_om: 5,
        wind_wave_direction_om: 205,
        wind_wave_peak_period_om: 7,
        secondary_swell_height_om: 0.25,
        secondary_swell_period_om: 11,
        secondary_swell_direction_om: 190,
        tertiary_swell_height_om: 0.15,
        tertiary_swell_period_om: 9,
        tertiary_swell_direction_om: 145,
        om_wind_wave_missing: false,
        om_primary_swell_missing: false,
        om_secondary_swell_missing: false,
        om_tertiary_swell_missing: false,
        om_partition_schema_version: 1,
        wind_speed_ms: 5.364,
        wind_direction_deg: 270,
      })
    );
  });
});
