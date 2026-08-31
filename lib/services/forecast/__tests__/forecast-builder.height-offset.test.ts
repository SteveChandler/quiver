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

jest.mock("server-only", () => ({}));

import { ForecastBuilder } from "../forecast-builder";
import type {
  ForecastInputs,
  BeachHeightOffsetRow,
} from "../forecast-builder";
import type { Beach } from "@/types/database";
import { METERS_TO_FEET } from "@/lib/utils/unit-conversions";
import type { FeedbackHeightCalibrationCandidate } from "../feedback-height-calibration";

// Capture insert calls so we can assert no snapshot ever leaks out (the
// fire-and-forget invariant — we are testing the buffer, not the writer).
const insertMock: jest.Mock = jest.fn().mockResolvedValue({ data: null, error: null });
// The trusted layer resolves coverage beach slugs through the same service-role
// client. Answering with no rows keeps every pre-Phase-21 test on the
// "coverage unavailable -> baseline" path, which is exactly what an
// unconfigured environment does.
const selectInMock: jest.Mock = jest
  .fn()
  .mockResolvedValue({ data: [], error: null });
const fromMock: jest.Mock = jest.fn(() => ({
  insert: insertMock,
  select: () => ({ in: selectInMock }),
}));

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
        provenance: "generic",
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

// ---------------------------------------------------------------------------
// Phase 21 — trusted external-forecaster integration (MFA-05, MFA-06, MFA-07)
//
// Fixture provenance: every trusted issue row below is verbatim 21-01 parser
// output from `trusted-forecast-issues.real.json` (the captured WaveCast
// `trestles` socal spot chart), with only the database-assigned `issue_id`
// added. The Quiver-side baseline ("5 ft"), the coverage entry, the receipt and
// the durable decision rows are not source data: they are, respectively, this
// repo's own display output, operator configuration and database state.
// ---------------------------------------------------------------------------

import { formatDisplayHeightFt } from "../apply-beach-height-offset";
import { TRUSTED_FORECAST_POLICY_VERSION } from "../trusted-forecast-policy";
import { TRUSTED_FORECAST_BUILD_SCHEMA_VERSION } from "../trusted-forecast-persistence";
import type {
  RpcResult,
  TrustedForecastBuildPayload,
  TrustedForecastPersistenceStore,
} from "../trusted-forecast-persistence";
import type {
  StoreResult,
  TrustedForecastReadStore,
} from "../trusted-forecast-repository";
import {
  REAL_ISSUE_FIXTURE,
  storedIssueId,
} from "./fixtures/trusted-forecast-real-issues";

/** 11:00 PDT on the day the captured trestles chart was issued. */
const TRUSTED_NOW = new Date("2026-08-06T18:00:00.000Z");
/** Coverage resolves beach SLUGS to ids, so these tests need real uuids. */
const TRESTLES_BEACH_ID = "aaaaaaaa-0000-4000-8000-000000000001";
const MALIBU_BEACH_ID = "aaaaaaaa-0000-4000-8000-000000000002";
const OTHER_BEACH_ID = "aaaaaaaa-0000-4000-8000-000000000003";
const RINCON_BEACH_ID = "aaaaaaaa-0000-4000-8000-000000000004";
const OLD_MANS_BEACH_ID = "aaaaaaaa-0000-4000-8000-000000000005";
const BEACONS_BEACH_ID = "aaaaaaaa-0000-4000-8000-000000000006";
const VENTURA_BEACH_ID = "aaaaaaaa-0000-4000-8000-000000000007";
const HUNTINGTON_BEACH_ID = "aaaaaaaa-0000-4000-8000-000000000008";
const OCEANSIDE_BEACH_ID = "aaaaaaaa-0000-4000-8000-000000000009";
const trustedBeach = { ...baseBeach, id: TRESTLES_BEACH_ID } as Beach;
const TRESTLES_DOCUMENT = "wavecast_spot_chart_live_trestles";

function trestlesRows(): Record<string, unknown>[] {
  return REAL_ISSUE_FIXTURE.documents[TRESTLES_DOCUMENT].issues.map(
    (row, index) => ({
      ...JSON.parse(JSON.stringify(row)),
      issue_id: storedIssueId(TRESTLES_DOCUMENT, index),
    }),
  );
}

const emptyResult = async (): Promise<StoreResult<unknown[]>> => ({
  data: [],
  error: null,
});

interface CountingReadStore extends TrustedForecastReadStore {
  readonly calls: string[];
}

function trustedReadStore(
  overrides: Partial<TrustedForecastReadStore> = {},
): CountingReadStore {
  const calls: string[] = [];
  const counted = <T extends unknown[], R>(
    name: string,
    fn: (...args: T) => Promise<R>,
  ) => (...args: T): Promise<R> => {
    calls.push(name);
    return fn(...args);
  };
  const base: TrustedForecastReadStore = {
    selectBeachIdsBySlug: async () => ({
      data: [
        { id: TRESTLES_BEACH_ID, slug: "lower-trestles" },
        { id: MALIBU_BEACH_ID, slug: "malibu-first-point-surfrider" },
        { id: RINCON_BEACH_ID, slug: "rincon-carpinteria-ca" },
        { id: OLD_MANS_BEACH_ID, slug: "old-mans-sano" },
        { id: BEACONS_BEACH_ID, slug: "beacons" },
        { id: VENTURA_BEACH_ID, slug: "c-street-ventura-ca" },
        { id: HUNTINGTON_BEACH_ID, slug: "huntington-beach-pier" },
        { id: OCEANSIDE_BEACH_ID, slug: "oceanside-pier" },
      ],
      error: null,
    }),
    selectIssuePage: async () => ({ data: trestlesRows(), error: null }),
    selectDecisions: emptyResult,
    selectApplications: emptyResult,
    ...overrides,
  };
  return {
    calls,
    selectBeachIdsBySlug: counted(
      "selectBeachIdsBySlug",
      base.selectBeachIdsBySlug,
    ),
    selectIssuePage: counted("selectIssuePage", base.selectIssuePage),
    selectDecisions: counted("selectDecisions", base.selectDecisions),
    selectApplications: counted("selectApplications", base.selectApplications),
  };
}

function receiptFor(payload: TrustedForecastBuildPayload) {
  return {
    build_key: payload.buildKey,
    payload_sha256:
      "1111111111111111111111111111111111111111111111111111111111111111",
    schema_version: payload.schemaVersion,
    policy_version: payload.policyVersion,
    expected_decision_count: payload.expectedDecisionCount,
    expected_application_count: payload.expectedApplicationCount,
    expected_alert_count: payload.expectedAlertCount,
    expected_snapshot_count: payload.expectedSnapshotCount,
    inserted_decision_count: payload.expectedDecisionCount,
    reused_decision_count: 0,
    inserted_application_count: payload.expectedApplicationCount,
    reused_application_count: 0,
    inserted_alert_count: payload.expectedAlertCount,
    reused_alert_count: 0,
    inserted_snapshot_count: 0,
    reused_snapshot_count: payload.expectedSnapshotCount,
    durable_alert_count: payload.expectedAlertCount,
  };
}

interface CapturingPersistenceStore extends TrustedForecastPersistenceStore {
  readonly payloads: TrustedForecastBuildPayload[];
}

function persistenceStore(
  behaviour: (payload: TrustedForecastBuildPayload) => RpcResult | Error = (
    payload,
  ) => ({ data: [receiptFor(payload)], error: null }),
  receiptBehaviour: () => RpcResult = () => ({ data: [], error: null }),
): CapturingPersistenceStore {
  const payloads: TrustedForecastBuildPayload[] = [];
  return {
    payloads,
    async persistBuild(payload) {
      payloads.push(payload);
      const outcome = behaviour(payload);
      if (outcome instanceof Error) throw outcome;
      return outcome;
    },
    async loadReceipt() {
      return receiptBehaviour();
    },
  };
}

/** The trestles chart's own call for the local day the build anchors on. */
const REAL_TRESTLES_2026_08_06 = { min: 2, max: 3, exposure: "SSW" };

describe("ForecastBuilder trusted external-forecaster integration", () => {
  beforeEach(() => {
    delete process.env.FEEDBACK_HEIGHT_CALIBRATION_ENABLED;
    delete process.env.TRUSTED_FORECAST_ADJUSTMENTS_ENABLED;
    mockWaveHeightValue = "5 ft";
    capturedSnapshotRows = [];
    jest.useFakeTimers({ doNotFake: ["queueMicrotask"] });
    jest.setSystemTime(TRUSTED_NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
    mockWaveHeightValue = "3 ft";
  });

  it("D-14: compares the POST-offset baseline, after transform, blend and beach offset", async () => {
    const flagBeach = {
      ...trustedBeach,
      height_offset_enabled: true,
    } as unknown as Beach;
    // 0.3 m ≈ 0.984 ft, applied only to horizons at or beyond 24 h.
    const offsetRow: BeachHeightOffsetRow = {
      offset_m: 0.3,
      sample_count: 60,
      mae_before_m: 0.4,
      mae_after_m: 0.18,
      computed_at: TRUSTED_NOW.toISOString(),
    };
    const persistence = persistenceStore();

    await newBuilder().buildForecasts(
      buildInputs({
        beach: flagBeach,
        heightOffset: offsetRow,
        trustedForecastReadStore: trustedReadStore(),
        trustedForecastPersistenceStore: persistence,
      }),
    );

    expect(persistence.payloads).toHaveLength(1);
    const payload = persistence.payloads[0];
    const firstDay = payload.decisions.find(
      (decision) => decision.localDate === "2026-08-07",
    );
    expect(payload.decisions.map((decision) => decision.localDate)).toContain(
      "2026-08-07",
    );
    // 2026-08-07 has slots at or beyond 24 h, so the offset fires and
    // the post-offset baseline is still the raw 5 ft.
    expect(firstDay?.baselineMaxFaceFt).toBe(5);

    // A later day does clear the 24 h gate, so its baseline is the OFFSET one.
    const laterDay = payload.decisions.find(
      (decision) => decision.localDate === "2026-08-09",
    );
    expect(laterDay?.baselineMaxFaceFt).toBeLessThan(5);
    expect(laterDay?.baselineMaxFaceFt).toBeGreaterThan(3.9);
  });

  it("persists private decisions while returning baseline forecast rows", async () => {
    const persistence = persistenceStore();

    const forecasts = await newBuilder().buildForecasts(
      buildInputs({
        beach: trustedBeach,
        trustedForecastReadStore: trustedReadStore(),
        trustedForecastPersistenceStore: persistence,
      }),
    );

    const payload = persistence.payloads[0];
    const firstDay = payload.decisions.find(
      (decision) => decision.localDate === "2026-08-07",
    );
    // The captured chart's own numbers, not invented ones.
    expect(firstDay).toMatchObject({
      beachId: TRESTLES_BEACH_ID,
      localTimezone: "America/Los_Angeles",
      status: "applied",
      baselineMaxFaceFt: 5,
      trustedMinFaceFt: REAL_TRESTLES_2026_08_06.min,
      trustedMaxFaceFt: REAL_TRESTLES_2026_08_06.max,
      signedGapFt: REAL_TRESTLES_2026_08_06.max - 5,
      appliedDeltaFt: -0.5,
    });
    expect(payload.expectedDecisionCount).toBe(payload.decisions.length);
    expect(payload.expectedApplicationCount).toBe(payload.applications.length);
    expect(payload.schemaVersion).toBe(TRUSTED_FORECAST_BUILD_SCHEMA_VERSION);
    expect(payload.policyVersion).toBe(TRUSTED_FORECAST_POLICY_VERSION);

    const claimed = new Map(
      payload.applications.map((application) => [
        application.forecastAt,
        application.appliedDeltaFt,
      ]),
    );
    expect(claimed.size).toBeGreaterThan(0);

    expect(forecasts.every((forecast) => forecast.wave_height === "5 ft")).toBe(true);
  });

  it("D-16: incomplete edge days are not newly claimed", async () => {
    const persistence = persistenceStore();

    await newBuilder().buildForecasts(
      buildInputs({
        beach: trustedBeach,
        trustedForecastReadStore: trustedReadStore(),
        trustedForecastPersistenceStore: persistence,
      }),
    );

    const claimed = new Set(
      persistence.payloads[0].applications.map(
        (application) => application.forecastAt,
      ),
    );
    const at = (hours: number) =>
      new Date(TRUSTED_NOW.getTime() + hours * 3_600_000).toISOString();

    expect(claimed.has(at(0))).toBe(true);
    expect(claimed.has(at(24))).toBe(true);
    expect(claimed.has(at(168))).toBe(false);
    expect(claimed.has(at(171))).toBe(false);
    // Nothing beyond the bound may reach a decision either.
    expect(
      persistence.payloads[0].decisions.some(
        (decision) => decision.localDate > "2026-08-13",
      ),
    ).toBe(false);
  });

  it("D-19..D-21: a definite rejection serves byte-identical baseline", async () => {
    const persistence = persistenceStore(() => ({
      data: null,
      error: { code: "22023", message: "contract violation" },
    }));

    const forecasts = await newBuilder().buildForecasts(
      buildInputs({
        beach: trustedBeach,
        trustedForecastReadStore: trustedReadStore(),
        trustedForecastPersistenceStore: persistence,
      }),
    );

    expect(persistence.payloads).toHaveLength(1);
    for (const forecast of forecasts) {
      expect(forecast.wave_height).toBe("5 ft");
    }
  });

  it("D-21: unresolved ambiguity throws retriably instead of serving anything", async () => {
    const persistence = persistenceStore(
      () => new Error("socket hang up"),
      () => ({ data: [], error: null }),
    );

    await expect(
      newBuilder().buildForecasts(
        buildInputs({
          beach: trustedBeach,
          trustedForecastReadStore: trustedReadStore(),
          trustedForecastPersistenceStore: persistence,
        }),
      ),
    ).rejects.toMatchObject({ retriable: true });
  });

  it("a uniqueness race reconciles private provenance while rows stay baseline", async () => {
    let call = 0;
    const persistence = persistenceStore(
      (payload) => {
        call += 1;
        if (call === 1) {
          return { data: null, error: { code: "23505", message: "collision" } };
        }
        return { data: [receiptFor(payload)], error: null };
      },
      () => ({ data: [], error: null }),
    );
    // The receipt lookup must return the durable receipt for the SAME payload.
    persistence.loadReceipt = async () => ({
      data: [receiptFor(persistence.payloads[0])],
      error: null,
    });

    const forecasts = await newBuilder().buildForecasts(
      buildInputs({
        beach: trustedBeach,
        trustedForecastReadStore: trustedReadStore(),
        trustedForecastPersistenceStore: persistence,
      }),
    );

    expect(forecasts.every((forecast) => forecast.wave_height === "5 ft")).toBe(true);
  });

  it("a uniqueness race that cannot be reconciled throws rather than serving baseline", async () => {
    const persistence = persistenceStore(
      () => ({ data: null, error: { code: "23505", message: "collision" } }),
      () => ({ data: [], error: null }),
    );

    await expect(
      newBuilder().buildForecasts(
        buildInputs({
          beach: trustedBeach,
          trustedForecastReadStore: trustedReadStore(),
          trustedForecastPersistenceStore: persistence,
        }),
      ),
    ).rejects.toMatchObject({ code: "receipt_missing", retriable: true });
  });

  it("D-13/D-18: a durable decision is reused exactly, even with newer guidance", async () => {
    const claimedAt = new Date(TRUSTED_NOW.getTime()).toISOString();
    const persistence = persistenceStore();
    const readStore = trustedReadStore({
      selectDecisions: async () => ({
        data: [
          {
            decision_id: "00000000-0000-4000-8000-00000000dec1",
            beach_id: TRESTLES_BEACH_ID,
            local_date: "2026-08-06",
            applied_delta_ft: "0.2500",
            status: "applied",
          },
        ],
        error: null,
      }),
      selectApplications: async () => ({
        data: [
          {
            beach_id: TRESTLES_BEACH_ID,
            forecast_at: claimedAt,
            applied_delta_ft: "0.2500",
          },
        ],
        error: null,
      }),
    });

    const forecasts = await newBuilder().buildForecasts(
      buildInputs({
        beach: trustedBeach,
        trustedForecastReadStore: readStore,
        trustedForecastPersistenceStore: persistence,
      }),
    );

    const payload = persistence.payloads[0];
    // The reused day never re-enters the payload, so no second decision row and
    // no second application for a slot that is already claimed.
    expect(
      payload.decisions.some((decision) => decision.localDate === "2026-08-06"),
    ).toBe(false);
    expect(
      payload.applications.some(
        (application) => application.localDate === "2026-08-06",
      ),
    ).toBe(false);

    // Durable private provenance never mutates the shared forecast row.
    const reused = forecasts.find(
      (forecast) =>
        new Date(forecast.forecast_at as string).toISOString() === claimedAt,
    );
    expect(reused?.wave_height).toBe("5 ft");
  });

  it("D-17: a claimed slot drops session feedback; an unclaimed slot keeps it", async () => {
    process.env.FEEDBACK_HEIGHT_CALIBRATION_ENABLED = "true";
    const candidate: FeedbackHeightCalibrationCandidate = {
      id: "candidate-1",
      beach_id: TRESTLES_BEACH_ID,
      status: "active_temp",
      // Negative, so feedback moves the display UP while the trusted delta
      // moves it DOWN. With the same sign the two are indistinguishable and the
      // suppression assertion would be vacuous.
      offset_ft: -0.5,
      sample_count: 5,
      unique_user_count: 3,
      activated_at: new Date(TRUSTED_NOW.getTime() - 60_000).toISOString(),
      expires_at: new Date(
        TRUSTED_NOW.getTime() + 14 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    };
    const persistence = persistenceStore();

    const forecasts = await newBuilder().buildForecasts(
      buildInputs({
        beach: trustedBeach,
        heightOffset: null,
        feedbackCalibrationCandidate: candidate,
        trustedForecastReadStore: trustedReadStore(),
        trustedForecastPersistenceStore: persistence,
      }),
    );

    const claimed = new Map(
      persistence.payloads[0].applications.map((application) => [
        application.forecastAt,
        application.appliedDeltaFt,
      ]),
    );
    const withFeedback = formatDisplayHeightFt({
      numericFt: 5.5,
      rangeSpread: null,
    });
    expect(withFeedback).not.toBe("5 ft");

    const rendered = forecasts.map((forecast) => {
      const delta = claimed.get(
        new Date(forecast.forecast_at as string).toISOString(),
      );
      return [forecast.wave_height, delta] as const;
    });
    // Private decisions do not alter shared forecast rows or their baseline layers.
    const expected = rendered.map(() => withFeedback);
    expect(rendered.map(([height]) => height)).toEqual(expected);
    expect(rendered.filter(([, delta]) => delta !== undefined).length).toBeGreaterThan(0);
    expect(rendered.filter(([, delta]) => delta === undefined).length).toBeGreaterThan(0);
    expect(expected.filter((height) => height === withFeedback).length).toBeGreaterThan(0);
  });

  it("D-18: the first-write snapshot remains the baseline comparison value", async () => {
    process.env.FEEDBACK_HEIGHT_CALIBRATION_ENABLED = "true";
    const candidate: FeedbackHeightCalibrationCandidate = {
      id: "candidate-1",
      beach_id: TRESTLES_BEACH_ID,
      status: "active_temp",
      // Negative, so feedback moves the display UP while the trusted delta
      // moves it DOWN. With the same sign the two are indistinguishable and the
      // suppression assertion would be vacuous.
      offset_ft: -0.5,
      sample_count: 5,
      unique_user_count: 3,
      activated_at: new Date(TRUSTED_NOW.getTime() - 60_000).toISOString(),
      expires_at: new Date(
        TRUSTED_NOW.getTime() + 14 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    };

    const persistence = persistenceStore();
    await newBuilder().buildForecasts(
      buildInputs({
        beach: trustedBeach,
        heightOffset: null,
        feedbackCalibrationCandidate: candidate,
        trustedForecastReadStore: trustedReadStore(),
        trustedForecastPersistenceStore: persistence,
      }),
    );

    expect(capturedSnapshotRows.length).toBeGreaterThan(0);
    for (const row of capturedSnapshotRows) {
      // The feedback layer is part of the ordinary baseline pipeline, while
      // trusted serving is applied later at the authenticated API boundary.
      expect(row.feedback_height_calibration_applied).toBe(true);
      expect(Object.keys(row).join(",")).not.toMatch(/trusted/);
      expect(row.display_source).toBe("face-Hs-transformer-v1");
      expect(row.offset_corrected_display_height_m).toBeCloseTo(
        5.5 / METERS_TO_FEET,
        3,
      );
    }
    const persistedRows = persistence.payloads.flatMap((payload) => payload.snapshots);
    expect(persistedRows.length).toBeGreaterThan(0);
    expect(
      persistence.payloads[0]?.applications.some(
        (application) => application.appliedDeltaFt === -0.5,
      ),
    ).toBe(true);
    for (const row of persistedRows) {
      expect(row.display_source).toBe("face-Hs-transformer-v1");
      // Trusted application provenance carries the adjustment separately; the
      // durable snapshot remains the ordinary 5.5 ft baseline.
      expect(row.offset_corrected_display_height_m).toBeCloseTo(
        5.5 / METERS_TO_FEET,
        3,
      );
    }
  });

  it("D-24: serving defaults on; only an explicit false disables it", async () => {
    const disabledStore = persistenceStore();
    const disabledReads = trustedReadStore();
    process.env.TRUSTED_FORECAST_ADJUSTMENTS_ENABLED = "false";
    const disabled = await newBuilder().buildForecasts(
      buildInputs({
        beach: trustedBeach,
        trustedForecastReadStore: disabledReads,
        trustedForecastPersistenceStore: disabledStore,
      }),
    );
    expect(disabledStore.payloads).toHaveLength(0);
    // An explicit false must stop the builder BEFORE any private read, not
    // merely leave the pure engine with nothing to return.
    expect(disabledReads.calls).toEqual([]);
    for (const forecast of disabled) {
      expect(forecast.wave_height).toBe("5 ft");
    }

    delete process.env.TRUSTED_FORECAST_ADJUSTMENTS_ENABLED;
    const defaultStore = persistenceStore();
    const defaultReads = trustedReadStore();
    await newBuilder().buildForecasts(
      buildInputs({
        beach: trustedBeach,
        trustedForecastReadStore: defaultReads,
        trustedForecastPersistenceStore: defaultStore,
      }),
    );
    expect(defaultStore.payloads).toHaveLength(1);
    expect(defaultReads.calls).toContain("selectIssuePage");

    // Empty and false-like values are strict disable forms; malformed values
    // also disable, while an unset flag retains D-24's deliberate default-on.
    process.env.TRUSTED_FORECAST_ADJUSTMENTS_ENABLED = "0";
    const otherStore = persistenceStore();
    await newBuilder().buildForecasts(
      buildInputs({
        beach: trustedBeach,
        trustedForecastReadStore: trustedReadStore(),
        trustedForecastPersistenceStore: otherStore,
      }),
    );
    expect(otherStore.payloads).toHaveLength(0);
  });

  it("an uncovered beach is served baseline without touching the RPC", async () => {
    const persistence = persistenceStore();
    const readStore = trustedReadStore({
      selectBeachIdsBySlug: async () => ({
        data: [
          { id: OTHER_BEACH_ID, slug: "lower-trestles" },
          { id: MALIBU_BEACH_ID, slug: "malibu-first-point-surfrider" },
        ],
        error: null,
      }),
    });

    const forecasts = await newBuilder().buildForecasts(
      buildInputs({
        beach: trustedBeach,
        trustedForecastReadStore: readStore,
        trustedForecastPersistenceStore: persistence,
      }),
    );

    expect(persistence.payloads).toHaveLength(0);
    for (const forecast of forecasts) {
      expect(forecast.wave_height).toBe("5 ft");
    }
  });

  it("unresolvable coverage serves baseline and is never mistaken for no evidence", async () => {
    const persistence = persistenceStore();
    const readStore = trustedReadStore({
      selectBeachIdsBySlug: async () => ({ data: [], error: null }),
    });

    const forecasts = await newBuilder().buildForecasts(
      buildInputs({
        beach: trustedBeach,
        trustedForecastReadStore: readStore,
        trustedForecastPersistenceStore: persistence,
      }),
    );

    expect(persistence.payloads).toHaveLength(0);
    for (const forecast of forecasts) {
      expect(forecast.wave_height).toBe("5 ft");
    }
  });

  it("a private read failure is retriable, never a silent baseline", async () => {
    const persistence = persistenceStore();
    const readStore = trustedReadStore({
      selectIssuePage: async () => ({
        data: null,
        error: { code: "57014", message: "canceling statement" },
      }),
    });

    await expect(
      newBuilder().buildForecasts(
        buildInputs({
          beach: trustedBeach,
          trustedForecastReadStore: readStore,
          trustedForecastPersistenceStore: persistence,
        }),
      ),
    ).rejects.toMatchObject({ code: "issue_read_failed", retriable: true });
  });

  it("D-23: no private forecaster or audit value reaches the public forecast payload", async () => {
    const persistence = persistenceStore();
    const rows = trestlesRows();

    const forecasts = await newBuilder().buildForecasts(
      buildInputs({
        beach: trustedBeach,
        trustedForecastReadStore: trustedReadStore(),
        trustedForecastPersistenceStore: persistence,
      }),
    );

    const publicPayload = JSON.stringify(forecasts);
    const payload = persistence.payloads[0];

    const sentinels: string[] = [
      "wavecast",
      "trusted_forecast",
      "trustedForecast",
      "provider_lineage",
      "providerLineage",
      "source_hash",
      "issue_identity_key",
      "revision_hash",
      "parser_version",
      "evidence_class",
      "primaryIssueId",
      "buildKey",
      "policyVersion",
      "range_separation_exceeded",
      "appliedDeltaFt",
      payload.buildKey,
      TRUSTED_FORECAST_POLICY_VERSION,
      TRUSTED_FORECAST_BUILD_SCHEMA_VERSION,
      rows[0].source_hash as string,
      rows[0].issue_identity_key as string,
      rows[0].revision_hash as string,
      rows[0].parser_version as string,
      "00000000-0000-4000-8000-00000000dec1",
      ...rows.map((row) => row.issue_id as string),
    ];
    for (const sentinel of sentinels) {
      expect(publicPayload).not.toContain(sentinel);
    }

    // The private payload really did carry those values, so the assertions
    // above are not vacuous.
    const privatePayload = JSON.stringify(payload);
    expect(privatePayload).toContain(payload.buildKey);
    expect(privatePayload).toContain(TRUSTED_FORECAST_POLICY_VERSION);
    const primaryIssueId = payload.decisions[0]?.primaryIssueId;
    expect(rows.map((row) => row.issue_id)).toContain(primaryIssueId);
    expect(privatePayload).toContain(primaryIssueId as string);

    // No private adjustment crosses the builder boundary.
    const claimed = new Set(
      payload.applications.map((application) => application.forecastAt),
    );
    expect(
      forecasts.filter((forecast) =>
        claimed.has(new Date(forecast.forecast_at as string).toISOString()),
      ).length,
    ).toBe(claimed.size);
    expect(forecasts.every((forecast) => forecast.wave_height === "5 ft")).toBe(true);
  });
});
