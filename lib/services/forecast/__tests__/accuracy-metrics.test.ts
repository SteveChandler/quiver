import { computeForecastAccuracyGateMetrics, computeForecastAccuracyMetrics, computeForecastAccuracyPairedGateDeltas, getForecastAccuracyHorizonBucket, getForecastAccuracyRowHorizonBucket, type ForecastAccuracyInputRow } from "../accuracy-metrics";

const baseRow = (
  overrides: Partial<ForecastAccuracyInputRow> = {}
): ForecastAccuracyInputRow => ({
  observed_m: 1,
  forecast_horizon_hours: 12,
  raw_display_height_m: 1.4,
  offset_corrected_display_height_m: 1.2,
  wave_height_om: 0.8,
  v5_shadow_height_m: 1.1,
  ...overrides,
});

describe("forecast accuracy metrics", () => {
  it("uses the canonical horizon buckets", () => {
    expect(getForecastAccuracyHorizonBucket(0)).toBe("0-24h");
    expect(getForecastAccuracyHorizonBucket(24)).toBe("0-24h");
    expect(getForecastAccuracyHorizonBucket(25)).toBe("25-72h");
    expect(getForecastAccuracyHorizonBucket(72)).toBe("25-72h");
    expect(getForecastAccuracyHorizonBucket(73)).toBe("73h+");
    expect(getForecastAccuracyHorizonBucket(-1)).toBeNull();
    expect(getForecastAccuracyHorizonBucket(null)).toBeNull();
  });

  it("uses the stored Phase 0 horizon bucket before recomputing from hours", () => {
    expect(
      getForecastAccuracyRowHorizonBucket(
        baseRow({
          forecast_horizon_hours: null,
          forecast_horizon_bucket: "25-72h",
        })
      )
    ).toBe("25-72h");
    expect(
      getForecastAccuracyRowHorizonBucket(
        baseRow({
          forecast_horizon_hours: 96,
          forecast_horizon_bucket: "0-24h",
        })
      )
    ).toBe("0-24h");
  });

  it("computes face-height MAE and bias by horizon and baseline", () => {
    const metrics = computeForecastAccuracyMetrics([
      baseRow({
        observed_m: 1,
        forecast_horizon_hours: 12,
        offset_corrected_display_height_m: 1.2,
        raw_display_height_m: 1.4,
        wave_height_om: 0.7,
        v5_shadow_height_m: 1.1,
      }),
      baseRow({
        observed_m: 2,
        forecast_horizon_hours: 30,
        offset_corrected_display_height_m: 1.6,
        raw_display_height_m: 2.5,
        wave_height_om: 2.2,
        v5_shadow_height_m: null,
      }),
    ]);

    expect(metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          horizon_bucket: "0-24h",
          baseline: "current_display",
          sample_count: 1,
          mae_m: 0.2,
          bias_m: 0.2,
        }),
        expect.objectContaining({
          horizon_bucket: "0-24h",
          baseline: "raw_om",
          sample_count: 1,
          mae_m: 0.3,
          bias_m: -0.3,
        }),
        expect.objectContaining({
          horizon_bucket: "25-72h",
          baseline: "raw_display",
          sample_count: 1,
          mae_m: 0.5,
          bias_m: 0.5,
        }),
      ])
    );
    expect(metrics).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          horizon_bucket: "25-72h",
          baseline: "v5_shadow",
        }),
      ])
    );
  });

  it("filters sentinel observations, missing horizons, and null predictions", () => {
    const metrics = computeForecastAccuracyMetrics([
      baseRow({ observed_m: -1 }),
      baseRow({ observed_m: null }),
      baseRow({ forecast_horizon_hours: null }),
      baseRow({ offset_corrected_display_height_m: null }),
    ]);

    expect(metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          baseline: "raw_display",
          sample_count: 1,
        }),
      ])
    );
    expect(metrics).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          baseline: "current_display",
        }),
      ])
    );
  });

  it("computes metrics and gate rows from stored buckets when horizon hours are absent", () => {
    const rows = [
      baseRow({
        forecast_horizon_hours: null,
        forecast_horizon_bucket: "25-72h",
        observed_m: 2,
        offset_corrected_display_height_m: 1.5,
        proposed_display_height_m: 1.8,
      }),
      baseRow({
        forecast_horizon_hours: null,
        forecast_horizon_bucket: "73h+",
        observed_m: 4,
        offset_corrected_display_height_m: 1,
        proposed_display_height_m: 4,
      }),
    ];

    expect(computeForecastAccuracyMetrics(rows, { includeProposed: true })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          horizon_bucket: "25-72h",
          baseline: "proposed_display",
          sample_count: 1,
          mae_m: 0.2,
        }),
      ])
    );
    expect(computeForecastAccuracyGateMetrics(rows, { includeProposed: true })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          horizon_group: "0-72h",
          baseline: "proposed_display",
          sample_count: 1,
          mae_m: 0.2,
        }),
      ])
    );
  });

  it("computes the 0-72h gate delta from paired rows only", () => {
    const rows = [
      baseRow({
        forecast_horizon_hours: 12,
        observed_m: 1,
        offset_corrected_display_height_m: 1.5,
        proposed_display_height_m: null,
      }),
      baseRow({
        forecast_horizon_hours: 48,
        observed_m: 1,
        offset_corrected_display_height_m: null,
        proposed_display_height_m: 2,
      }),
      baseRow({
        forecast_horizon_hours: 48,
        observed_m: 1,
        offset_corrected_display_height_m: 1.4,
        proposed_display_height_m: 1.1,
      }),
    ];

    expect(
      computeForecastAccuracyPairedGateDeltas(rows, { includeProposed: true })
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          horizon_group: "0-72h",
          baseline: "proposed_display",
          sample_count: 1,
          comparison_sample_count: 1,
          mae_m: 0.1,
          comparison_mae_m: 0.4,
          delta_mae_m: -0.3,
        }),
      ])
    );
  });
});
