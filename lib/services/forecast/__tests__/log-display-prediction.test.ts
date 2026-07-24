/**
 * Tests for the display-prediction snapshot writer.
 *
 * Critical invariants verified here:
 *  1. Env-gated: missing SUPABASE_SERVICE_ROLE_KEY → no insert + warn.
 *  2. Fire-and-forget: supabase failures NEVER throw to caller.
 *  3. Batch insert: a single supabase call regardless of N rows.
 *  4. Payload shape: every required column present.
 */

import {
  logDisplayPredictions,
  type DisplayPredictionRow,
} from "../log-display-prediction";
import { WAVE_HEIGHT_SOURCE_TAGS } from "@/lib/utils/wave-height-source";

// Capture supabase calls. We swap the service-role factory so we observe the
// .from("ml_predictions_log").upsert(payload, opts) flow.
const upsertMock: jest.Mock = jest.fn();
const fromMock: jest.Mock = jest.fn(() => ({ upsert: upsertMock }));

jest.mock("@/lib/supabase", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => fromMock(table),
  }),
}));

// Silence the logger.
jest.mock("@/lib/logger", () => ({
  createContextLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

const sampleRow = (
  overrides: Partial<DisplayPredictionRow> = {}
): DisplayPredictionRow => ({
  beach_id: "beach-1",
  predicted_at: "2026-05-01T00:00:00Z",
  forecast_horizon_hours: 24,
  forecast_horizon_bucket: "0-24h",
  raw_display_height_m: 1.234,
  offset_corrected_display_height_m: 1.123,
  height_offset_m: 0.111,
  height_offset_sample_count: 42,
  feedback_height_calibration_candidate_id: null,
  feedback_height_offset_ft: null,
  feedback_height_calibration_applied: false,
  display_source: "face-Hs-transformer-v1",
  display_wave_source: "model_swell",
  display_raw_input_height_m: 0.8,
  wave_height_om_m: null,
  noaa_swell_1_height_m: null,
  noaa_swell_1_period_s: null,
  noaa_swell_1_direction_deg: null,
  noaa_swell_2_height_m: null,
  noaa_swell_2_period_s: null,
  noaa_swell_2_direction_deg: null,
  noaa_wind_wave_height_m: null,
  noaa_wind_wave_period_s: null,
  noaa_wind_wave_direction_deg: null,
  wave_period_s: null,
  wave_direction_deg: null,
  wave_period_om: null,
  wave_direction_om: null,
  wave_peak_period_om: null,
  swell_height_om: null,
  swell_period_om: null,
  swell_direction_om: null,
  swell_wave_peak_period_om: null,
  wind_wave_height_om: null,
  wind_wave_period_om: null,
  wind_wave_direction_om: null,
  wind_wave_peak_period_om: null,
  secondary_swell_height_om: null,
  secondary_swell_period_om: null,
  secondary_swell_direction_om: null,
  tertiary_swell_height_om: null,
  tertiary_swell_period_om: null,
  tertiary_swell_direction_om: null,
  om_wind_wave_missing: null,
  om_primary_swell_missing: null,
  om_secondary_swell_missing: null,
  om_tertiary_swell_missing: null,
  om_partition_schema_version: null,
  wind_speed_ms: null,
  wind_direction_deg: null,
  v5_shadow_height_m: null,
  v5_model_version: null,
  direction_bucket: null,
  om_bucket: null,
  ...overrides,
});

describe("logDisplayPredictions", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    upsertMock.mockResolvedValue({ data: null, error: null });
    fromMock.mockImplementation(() => ({ upsert: upsertMock }));
    process.env = {
      ...ORIGINAL_ENV,
      SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
    };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("returns immediately for empty input", async () => {
    await logDisplayPredictions([]);
    expect(upsertMock).not.toHaveBeenCalled();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("env-gated: missing SUPABASE_SERVICE_ROLE_KEY skips insert + warns", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Should not throw and should not insert anything.
    await expect(
      logDisplayPredictions([sampleRow()])
    ).resolves.toBeUndefined();
    expect(upsertMock).not.toHaveBeenCalled();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("env-gated: missing NEXT_PUBLIC_SUPABASE_URL skips insert", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    await logDisplayPredictions([sampleRow()]);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("performs ONE batch upsert for N rows", async () => {
    const rows = [
      sampleRow({ predicted_at: "2026-05-01T00:00:00Z" }),
      sampleRow({ predicted_at: "2026-05-01T03:00:00Z" }),
      sampleRow({ predicted_at: "2026-05-01T06:00:00Z" }),
      sampleRow({ predicted_at: "2026-05-01T09:00:00Z" }),
      sampleRow({ predicted_at: "2026-05-01T12:00:00Z" }),
    ];

    await logDisplayPredictions(rows);

    // ONE supabase.from() call, ONE .upsert() call.
    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(fromMock).toHaveBeenCalledWith("ml_predictions_log");
    expect(upsertMock).toHaveBeenCalledTimes(1);

    const payload = upsertMock.mock.calls[0][0];
    expect(Array.isArray(payload)).toBe(true);
    expect(payload).toHaveLength(5);
  });

  it("upsert call uses horizon-bucket conflict key and ignoreDuplicates=true", async () => {
    // Locks in the first-write-wins semantic. Changing either option silently
    // breaks the per-horizon telemetry feedback-loop invariant
    // (raw_display_height_m must stay frozen at first issue within a bucket) or
    // restores the silent-rollback bug fixed 2026-05-04 (insert was rolling
    // back the whole batch on every conflict).
    await logDisplayPredictions([sampleRow()]);

    const opts = upsertMock.mock.calls[0][1];
    expect(opts).toEqual({
      onConflict:
        "beach_id,predicted_at,forecast_horizon_bucket,display_source",
      ignoreDuplicates: true,
    });
  });

  it("falls back to the legacy conflict key when the Phase 0 column is not live yet", async () => {
    upsertMock
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: "PGRST204",
          message:
            "Could not find the 'forecast_horizon_bucket' column of 'ml_predictions_log' in the schema cache",
        },
      })
      .mockResolvedValueOnce({ data: null, error: null });

    await logDisplayPredictions([sampleRow()]);

    expect(upsertMock).toHaveBeenCalledTimes(2);
    expect(upsertMock.mock.calls[0][1]).toEqual({
      onConflict:
        "beach_id,predicted_at,forecast_horizon_bucket,display_source",
      ignoreDuplicates: true,
    });
    expect(upsertMock.mock.calls[1][1]).toEqual({
      onConflict: "beach_id,predicted_at",
      ignoreDuplicates: true,
    });
    expect(upsertMock.mock.calls[0][0][0]).toHaveProperty(
      "forecast_horizon_bucket",
      "0-24h"
    );
    expect(upsertMock.mock.calls[1][0][0]).not.toHaveProperty(
      "forecast_horizon_bucket"
    );
    expect(upsertMock.mock.calls[1][0][0]).not.toHaveProperty(
      "display_wave_source"
    );
    expect(upsertMock.mock.calls[1][0][0]).not.toHaveProperty(
      "display_raw_input_height_m"
    );
  });

  it("falls back to the legacy conflict key when the horizon-aware unique index is not live yet", async () => {
    upsertMock
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: "42P10",
          message:
            "there is no unique or exclusion constraint matching the ON CONFLICT specification",
        },
      })
      .mockResolvedValueOnce({ data: null, error: null });

    await logDisplayPredictions([sampleRow()]);

    expect(upsertMock).toHaveBeenCalledTimes(2);
    expect(upsertMock.mock.calls[1][1]).toEqual({
      onConflict: "beach_id,predicted_at",
      ignoreDuplicates: true,
    });
  });

  it("does not use the legacy conflict key for ordinary insert failures", async () => {
    upsertMock.mockResolvedValueOnce({
      data: null,
      error: {
        code: "23502",
        message: "null value in column model_version violates not-null constraint",
      },
    });

    await logDisplayPredictions([sampleRow()]);

    expect(upsertMock).toHaveBeenCalledTimes(1);
  });

  it("does not use the legacy conflict key for Phase 0 constraint failures", async () => {
    upsertMock.mockResolvedValueOnce({
      data: null,
      error: {
        code: "23514",
        message:
          'new row for relation "ml_predictions_log" violates check constraint "ml_predictions_log_display_wave_source_check"',
      },
    });

    await logDisplayPredictions([sampleRow()]);

    expect(upsertMock).toHaveBeenCalledTimes(1);
  });

  it("logs no-source Flat rows with null raw input instead of fabricating output as input", async () => {
    await logDisplayPredictions([
      sampleRow({
        beach_id: "beach-flat",
        display_wave_source: null,
        display_raw_input_height_m: null,
        raw_display_height_m: 0,
        offset_corrected_display_height_m: 0,
      }),
    ]);

    expect(upsertMock).toHaveBeenCalledTimes(1);
    const payload = upsertMock.mock.calls[0][0];
    expect(payload).toHaveLength(1);
    expect(payload[0]).toEqual(
      expect.objectContaining({
        beach_id: "beach-flat",
        display_wave_source: null,
        display_raw_input_height_m: null,
        raw_display_height_m: 0,
        offset_corrected_display_height_m: 0,
      })
    );
  });

  it("preserves the builder's true raw transform input for valid-source rows", async () => {
    await logDisplayPredictions([
      sampleRow({
        beach_id: "beach-valid",
        display_wave_source: "model_swell",
        display_raw_input_height_m: 0.8,
        raw_display_height_m: 1.234,
      }),
    ]);

    expect(upsertMock).toHaveBeenCalledTimes(1);
    const payload = upsertMock.mock.calls[0][0];
    expect(payload[0]).toEqual(
      expect.objectContaining({
        beach_id: "beach-valid",
        display_wave_source: "model_swell",
        display_raw_input_height_m: 0.8,
        raw_display_height_m: 1.234,
      })
    );
  });

  it("does not fabricate a missing raw transform input from the displayed output", async () => {
    await logDisplayPredictions([
      sampleRow({
        beach_id: "beach-missing-raw-input",
        display_wave_source: "model_swell",
        display_raw_input_height_m: null,
        raw_display_height_m: 1.234,
      }),
    ]);

    expect(upsertMock).toHaveBeenCalledTimes(1);
    const payload = upsertMock.mock.calls[0][0];
    expect(payload).toHaveLength(1);
    expect(payload[0]).toEqual(
      expect.objectContaining({
        beach_id: "beach-missing-raw-input",
        raw_display_height_m: 1.234,
        display_wave_source: "model_swell",
        display_raw_input_height_m: null,
      })
    );
  });

  it("writes the caller's EF display value into the sidecar displayed-value column", async () => {
    const efDisplayHeightM = 1.456;

    await logDisplayPredictions([
      sampleRow({
        raw_display_height_m: 1.789,
        offset_corrected_display_height_m: efDisplayHeightM,
        display_raw_input_height_m: 0.91,
      }),
    ]);

    const payload = upsertMock.mock.calls[0][0];
    expect(payload[0].offset_corrected_display_height_m).toBe(
      efDisplayHeightM
    );
  });

  it("accepts every shared WaveHeightSourceTag for Phase 0 replay provenance", async () => {
    await logDisplayPredictions(
      WAVE_HEIGHT_SOURCE_TAGS.map((displayWaveSource, index) =>
        sampleRow({
          beach_id: `beach-${index}`,
          display_wave_source: displayWaveSource,
          display_raw_input_height_m: 0.8 + index / 100,
        })
      )
    );

    expect(upsertMock).toHaveBeenCalledTimes(1);
    const payload = upsertMock.mock.calls[0][0];
    expect(payload).toHaveLength(WAVE_HEIGHT_SOURCE_TAGS.length);
    expect(
      payload.map(
        (row: { display_wave_source: string }) => row.display_wave_source
      )
    ).toEqual([...WAVE_HEIGHT_SOURCE_TAGS]);
  });

  it("skips the insert when every row has invalid sidecar provenance values", async () => {
    await logDisplayPredictions([
      sampleRow({
        display_wave_source: "unknown-source" as never,
        display_raw_input_height_m: null,
      }),
      sampleRow({
        display_wave_source: "model_swell",
        display_raw_input_height_m: Number.NaN,
      }),
      sampleRow({
        display_wave_source: "model_swell",
        display_raw_input_height_m: -0.1,
      }),
    ]);

    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("payload includes all required snapshot columns", async () => {
    await logDisplayPredictions([
      sampleRow({
        beach_id: "beach-99",
        predicted_at: "2026-05-01T00:00:00Z",
        forecast_horizon_hours: 48,
        forecast_horizon_bucket: "25-72h",
        raw_display_height_m: 2.5,
        offset_corrected_display_height_m: 2.2,
        height_offset_m: 0.3,
        height_offset_sample_count: 60,
        display_source: "face-Hs-transformer-v1",
        display_wave_source: "cdip_sig",
        display_raw_input_height_m: 0.9,
      }),
    ]);

    const payload = upsertMock.mock.calls[0][0];
    expect(payload[0]).toEqual({
      beach_id: "beach-99",
      predicted_at: "2026-05-01T00:00:00Z",
      forecast_horizon_hours: 48,
      forecast_horizon_bucket: "25-72h",
      raw_display_height_m: 2.5,
      offset_corrected_display_height_m: 2.2,
      height_offset_m: 0.3,
      height_offset_sample_count: 60,
      feedback_height_calibration_candidate_id: null,
      feedback_height_offset_ft: null,
      feedback_height_calibration_applied: false,
      display_source: "face-Hs-transformer-v1",
      display_wave_source: "cdip_sig",
      display_raw_input_height_m: 0.9,
      // model_version falls back to display_source so the NOT NULL constraint
      // on ml_predictions_log.model_version is always satisfied.
      model_version: "face-Hs-transformer-v1",
      // v5 shadow comparator columns: null when caller doesn't supply them.
      wave_height_om: null,
      noaa_swell_1_height_m: null,
      noaa_swell_1_period_s: null,
      noaa_swell_1_direction_deg: null,
      noaa_swell_2_height_m: null,
      noaa_swell_2_period_s: null,
      noaa_swell_2_direction_deg: null,
      noaa_wind_wave_height_m: null,
      noaa_wind_wave_period_s: null,
      noaa_wind_wave_direction_deg: null,
      wave_period_s: null,
      wave_direction_deg: null,
      wave_period_om: null,
      wave_direction_om: null,
      wave_peak_period_om: null,
      swell_height_om: null,
      swell_period_om: null,
      swell_direction_om: null,
      swell_wave_peak_period_om: null,
      wind_wave_height_om: null,
      wind_wave_period_om: null,
      wind_wave_direction_om: null,
      wind_wave_peak_period_om: null,
      secondary_swell_height_om: null,
      secondary_swell_period_om: null,
      secondary_swell_direction_om: null,
      tertiary_swell_height_om: null,
      tertiary_swell_period_om: null,
      tertiary_swell_direction_om: null,
      om_wind_wave_missing: null,
      om_primary_swell_missing: null,
      om_secondary_swell_missing: null,
      om_tertiary_swell_missing: null,
      om_partition_schema_version: null,
      wind_speed_ms: null,
      wind_direction_deg: null,
      v5_shadow_height_m: null,
      v5_model_version: null,
      direction_bucket: null,
      om_bucket: null,
    });
  });

  it("respects explicit model_version override", async () => {
    await logDisplayPredictions([
      sampleRow({ model_version: "explicit-model-v2" }),
    ]);
    const payload = upsertMock.mock.calls[0][0];
    expect(payload[0].model_version).toBe("explicit-model-v2");
  });

  it("maps the expanded Open-Meteo partition stack into the upsert payload", async () => {
    await logDisplayPredictions([
      sampleRow({
        wave_peak_period_om: 12,
        swell_wave_peak_period_om: 16,
        wind_wave_period_om: 6,
        wind_wave_direction_om: 210,
        wind_wave_peak_period_om: 8,
        secondary_swell_height_om: 0.25,
        secondary_swell_period_om: 12,
        secondary_swell_direction_om: 195,
        tertiary_swell_height_om: 0.15,
        tertiary_swell_period_om: 10,
        tertiary_swell_direction_om: 145,
        om_wind_wave_missing: false,
        om_primary_swell_missing: false,
        om_secondary_swell_missing: false,
        om_tertiary_swell_missing: false,
        om_partition_schema_version: 1,
      }),
    ]);

    const payload = upsertMock.mock.calls[0][0];
    expect(payload[0]).toEqual(
      expect.objectContaining({
        wave_peak_period_om: 12,
        swell_wave_peak_period_om: 16,
        wind_wave_period_om: 6,
        wind_wave_direction_om: 210,
        wind_wave_peak_period_om: 8,
        secondary_swell_height_om: 0.25,
        secondary_swell_period_om: 12,
        secondary_swell_direction_om: 195,
        tertiary_swell_height_om: 0.15,
        tertiary_swell_period_om: 10,
        tertiary_swell_direction_om: 145,
        om_wind_wave_missing: false,
        om_primary_swell_missing: false,
        om_secondary_swell_missing: false,
        om_tertiary_swell_missing: false,
        om_partition_schema_version: 1,
      })
    );
  });

  it("maps NOAA partition inputs into the upsert payload", async () => {
    await logDisplayPredictions([
      sampleRow({
        noaa_swell_1_height_m: 0.8,
        noaa_swell_1_period_s: 14,
        noaa_swell_1_direction_deg: 220,
        noaa_swell_2_height_m: 0.15,
        noaa_swell_2_period_s: 11,
        noaa_swell_2_direction_deg: 190,
        noaa_wind_wave_height_m: 0.3,
        noaa_wind_wave_period_s: 6,
        noaa_wind_wave_direction_deg: 200,
      }),
    ]);

    const payload = upsertMock.mock.calls[0][0];
    expect(payload[0]).toEqual(
      expect.objectContaining({
        noaa_swell_1_height_m: 0.8,
        noaa_swell_1_period_s: 14,
        noaa_swell_1_direction_deg: 220,
        noaa_swell_2_height_m: 0.15,
        noaa_swell_2_period_s: 11,
        noaa_swell_2_direction_deg: 190,
        noaa_wind_wave_height_m: 0.3,
        noaa_wind_wave_period_s: 6,
        noaa_wind_wave_direction_deg: 200,
      })
    );
  });

  it("supabase insert failure does NOT throw to caller (fire-and-forget)", async () => {
    upsertMock.mockResolvedValueOnce({
      data: null,
      error: { message: "constraint violation", code: "23505" },
    });

    // Must resolve, not reject.
    await expect(logDisplayPredictions([sampleRow()])).resolves.toBeUndefined();
  });

  it("unexpected synchronous throw inside client does NOT propagate", async () => {
    fromMock.mockImplementationOnce(() => {
      throw new Error("client-construction blew up");
    });

    await expect(logDisplayPredictions([sampleRow()])).resolves.toBeUndefined();
  });

  it("rejected insert promise does NOT propagate", async () => {
    upsertMock.mockRejectedValueOnce(new Error("network died"));

    await expect(logDisplayPredictions([sampleRow()])).resolves.toBeUndefined();
  });

  it("handles null offset rows (no offset applied)", async () => {
    await logDisplayPredictions([
      sampleRow({
        height_offset_m: null,
        height_offset_sample_count: null,
        offset_corrected_display_height_m: 1.234, // equal to raw
      }),
    ]);

    const payload = upsertMock.mock.calls[0][0];
    expect(payload[0].height_offset_m).toBeNull();
    expect(payload[0].height_offset_sample_count).toBeNull();
    expect(payload[0].offset_corrected_display_height_m).toBe(
      payload[0].raw_display_height_m
    );
  });
});
