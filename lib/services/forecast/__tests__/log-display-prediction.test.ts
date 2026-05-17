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
  raw_display_height_m: 1.234,
  offset_corrected_display_height_m: 1.123,
  height_offset_m: 0.111,
  height_offset_sample_count: 42,
  display_source: "face-Hs-transformer-v1",
  wave_height_om_m: null,
  wave_period_s: null,
  wave_direction_deg: null,
  wave_period_om: null,
  wave_direction_om: null,
  swell_height_om: null,
  swell_period_om: null,
  swell_direction_om: null,
  wind_wave_height_om: null,
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

  it("upsert call uses onConflict=beach_id,predicted_at and ignoreDuplicates=true", async () => {
    // Locks in the first-write-wins semantic. Changing either option silently
    // breaks the telemetry feedback-loop invariant (raw_display_height_m must
    // stay frozen at first issue) or restores the silent-rollback bug fixed
    // 2026-05-04 (insert was rolling back the whole batch on every conflict).
    await logDisplayPredictions([sampleRow()]);

    const opts = upsertMock.mock.calls[0][1];
    expect(opts).toEqual({
      onConflict: "beach_id,predicted_at",
      ignoreDuplicates: true,
    });
  });

  it("payload includes all required snapshot columns", async () => {
    await logDisplayPredictions([
      sampleRow({
        beach_id: "beach-99",
        predicted_at: "2026-05-01T00:00:00Z",
        forecast_horizon_hours: 48,
        raw_display_height_m: 2.5,
        offset_corrected_display_height_m: 2.2,
        height_offset_m: 0.3,
        height_offset_sample_count: 60,
        display_source: "face-Hs-transformer-v1",
      }),
    ]);

    const payload = upsertMock.mock.calls[0][0];
    expect(payload[0]).toEqual({
      beach_id: "beach-99",
      predicted_at: "2026-05-01T00:00:00Z",
      forecast_horizon_hours: 48,
      raw_display_height_m: 2.5,
      offset_corrected_display_height_m: 2.2,
      height_offset_m: 0.3,
      height_offset_sample_count: 60,
      display_source: "face-Hs-transformer-v1",
      // model_version falls back to display_source so the NOT NULL constraint
      // on ml_predictions_log.model_version is always satisfied.
      model_version: "face-Hs-transformer-v1",
      // v5 shadow comparator columns: null when caller doesn't supply them.
      wave_height_om: null,
      wave_period_s: null,
      wave_direction_deg: null,
      wave_period_om: null,
      wave_direction_om: null,
      swell_height_om: null,
      swell_period_om: null,
      swell_direction_om: null,
      wind_wave_height_om: null,
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
