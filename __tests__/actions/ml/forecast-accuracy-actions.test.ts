/**
 * @jest-environment node
 */

const mockCreateSupabaseServiceRoleClient = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: () => mockCreateSupabaseServiceRoleClient(),
}));

describe("forecast accuracy actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns crawl-safe fallbacks when the service-role client is unavailable", async () => {
    mockCreateSupabaseServiceRoleClient.mockImplementation(() => {
      throw new Error("missing env");
    });

    const {
      getDailyAccuracyTimeSeries,
      getForecastAccuracyReport,
      getOverallAccuracyStats,
      getRegionalAccuracy,
      getTopBeaches,
    } = await import("@/actions/ml/forecast-accuracy-actions");

    await expect(getOverallAccuracyStats()).resolves.toBeNull();
    await expect(getRegionalAccuracy()).resolves.toEqual([]);
    await expect(getTopBeaches()).resolves.toEqual([]);
    await expect(getDailyAccuracyTimeSeries()).resolves.toEqual([]);

    const report = await getForecastAccuracyReport();
    expect(report.summary.status).toBe("building");
    expect(report.summary.canClaimImprovement).toBe(false);
    expect(report.summary.confidence.label).toBe("Model only");
    expect(report.buildingRows.length).toBeGreaterThan(0);
    expect(report.buildingRows.map((row) => row.status)).toEqual([
      "Building",
      "Queued",
      "Held",
    ]);
  });

  it("returns null overall stats when the baseline query fails", async () => {
    mockCreateSupabaseServiceRoleClient.mockReturnValue({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          gte: jest.fn(async () => ({
            data: null,
            error: { message: "relation does not exist" },
          })),
        })),
      })),
    });

    const { getOverallAccuracyStats } =
      await import("@/actions/ml/forecast-accuracy-actions");

    await expect(getOverallAccuracyStats()).resolves.toBeNull();
  });

  it("skips leaderboard rows with null accuracy metrics", async () => {
    const baselineLimit = jest.fn(async () => ({
      data: [
        {
          beach_id: "beach-valid",
          beach_name: "Valid Beach",
          raw_mae: 0.42,
          corrected_mae: 0.31,
          mae_improvement_pct: 26,
          predictions_matched: 24,
        },
        {
          beach_id: "beach-null",
          beach_name: "Null Beach",
          raw_mae: null,
          corrected_mae: null,
          mae_improvement_pct: null,
          predictions_matched: 24,
        },
      ],
      error: null,
    }));
    const baselineOrder = jest.fn(() => ({ limit: baselineLimit }));
    const baselineGte = jest.fn(() => ({ order: baselineOrder }));
    const baselineSelect = jest.fn(() => ({ gte: baselineGte }));

    const beachIn = jest.fn(async () => ({
      data: [
        {
          id: "beach-valid",
          slug: "valid-beach",
          city: "San Diego",
          state: "CA",
          country: "USA",
        },
      ],
      error: null,
    }));
    const beachSelect = jest.fn(() => ({ in: beachIn }));

    mockCreateSupabaseServiceRoleClient.mockReturnValue({
      from: jest
        .fn()
        .mockReturnValueOnce({ select: baselineSelect })
        .mockReturnValueOnce({ select: beachSelect }),
    });

    const { getTopBeaches } =
      await import("@/actions/ml/forecast-accuracy-actions");

    await expect(getTopBeaches()).resolves.toEqual([
      {
        beachId: "beach-valid",
        beachName: "Valid Beach",
        slug: "valid-beach",
        city: "San Diego",
        state: "CA",
        country: "USA",
        rawMae: 0.42,
        correctedMae: 0.31,
        maeImprovementPct: 26,
        predictionsMatched: 24,
      },
    ]);
  });

  it("builds a live report when validated beach rows are available", async () => {
    const lastUpdated = new Date().toISOString();
    const reportBaselineLimit = jest.fn(async () => ({
      data: [
        {
          beach_id: "beach-live",
          beach_name: "Live Metrics Beach",
          predictions_total: 80,
          predictions_matched: 52,
          raw_mae: 0.5,
          corrected_mae: 0.35,
          mae_improvement_pct: 30,
          last_prediction_at: lastUpdated,
          period_start: "2026-05-19T00:00:00.000Z",
          period_end: lastUpdated,
        },
        {
          beach_id: "beach-older-window",
          beach_name: "Older Window Beach",
          predictions_total: 20,
          predictions_matched: 8,
          raw_mae: 0.6,
          corrected_mae: 0.48,
          mae_improvement_pct: 20,
          last_prediction_at: lastUpdated,
          period_start: "2026-05-01T00:00:00.000Z",
          period_end: "2026-05-25T00:00:00.000Z",
        },
      ],
      error: null,
    }));
    const reportBaselineOrder = jest.fn(() => ({ limit: reportBaselineLimit }));
    const reportBaselineGte = jest.fn(() => ({ order: reportBaselineOrder }));
    const reportBaselineSelect = jest.fn(() => ({ gte: reportBaselineGte }));
    const reportBeachIn = jest.fn(async () => ({
      data: [
        {
          id: "beach-live",
          slug: "live-metrics-beach",
          city: "San Diego",
          state: "CA",
          country: "USA",
        },
        {
          id: "beach-older-window",
          slug: "older-window-beach",
          city: "Santa Cruz",
          state: "CA",
          country: "USA",
        },
      ],
      error: null,
    }));
    const reportBeachSelect = jest.fn(() => ({ in: reportBeachIn }));
    const reportClient = {
      from: jest
        .fn()
        .mockReturnValueOnce({ select: reportBaselineSelect })
        .mockReturnValueOnce({ select: reportBeachSelect }),
    };
    const emptyRegionalClient = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          gte: jest.fn(async () => ({ data: [], error: null })),
        })),
      })),
    };
    const emptyDailyClient = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            gt: jest.fn(() => ({
              gte: jest.fn(() => ({
                order: jest.fn(async () => ({ data: [], error: null })),
              })),
            })),
          })),
        })),
      })),
    };
    mockCreateSupabaseServiceRoleClient
      .mockReturnValueOnce(reportClient)
      .mockReturnValueOnce(emptyRegionalClient)
      .mockReturnValueOnce(emptyDailyClient);

    const { getForecastAccuracyReport } =
      await import("@/actions/ml/forecast-accuracy-actions");

    const report = await getForecastAccuracyReport();

    expect(report.summary.status).toBe("live");
    expect(report.summary.canClaimImprovement).toBe(true);
    expect(report.summary.validatedPairCount).toBe(60);
    expect(report.summary.confidence.label).toBe("High - buoy + model");
    expect(report.summary.periodStart).toBe("2026-05-01T00:00:00.000Z");
    expect(report.summary.periodEnd).toBe(lastUpdated);
    expect(report.buildingRows).toEqual([]);
    expect(report.beachRows[0]).toMatchObject({
      beachId: "beach-live",
      beachName: "Live Metrics Beach",
      noaaBaselineMae: 0.5,
      quiverMae: 0.35,
      improvementPct: 30,
      validatedPairCount: 52,
      lastUpdated,
      confidence: expect.objectContaining({
        label: "High - buoy + model",
      }),
      canClaimImprovement: true,
    });
  });

  it("returns a building report when no qualifying accuracy rows exist", async () => {
    const reportBaselineLimit = jest.fn(async () => ({
      data: [],
      error: null,
    }));
    const reportBaselineOrder = jest.fn(() => ({ limit: reportBaselineLimit }));
    const reportBaselineGte = jest.fn(() => ({ order: reportBaselineOrder }));
    const reportBaselineSelect = jest.fn(() => ({ gte: reportBaselineGte }));

    mockCreateSupabaseServiceRoleClient.mockReturnValue({
      from: jest.fn(() => ({ select: reportBaselineSelect })),
    });

    const { getForecastAccuracyReport } =
      await import("@/actions/ml/forecast-accuracy-actions");

    const report = await getForecastAccuracyReport();

    expect(report.summary.status).toBe("building");
    expect(report.summary.canClaimImprovement).toBe(false);
    expect(report.beachRows).toEqual([]);
    expect(report.buildingRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "Building",
          confidenceLabel: "Low - sparse data",
        }),
        expect.objectContaining({
          status: "Queued",
          confidenceLabel: "Model only",
        }),
      ]),
    );
  });

  it("does not allow improvement claims when Quiver MAE is not lower than NOAA", async () => {
    const lastUpdated = new Date().toISOString();
    const reportBaselineLimit = jest.fn(async () => ({
      data: [
        {
          beach_id: "beach-negative",
          beach_name: "Negative Lift Beach",
          predictions_total: 60,
          predictions_matched: 40,
          raw_mae: 0.4,
          corrected_mae: 0.5,
          mae_improvement_pct: -25,
          last_prediction_at: lastUpdated,
          period_start: "2026-05-19T00:00:00.000Z",
          period_end: lastUpdated,
        },
      ],
      error: null,
    }));
    const reportBaselineOrder = jest.fn(() => ({ limit: reportBaselineLimit }));
    const reportBaselineGte = jest.fn(() => ({ order: reportBaselineOrder }));
    const reportBaselineSelect = jest.fn(() => ({ gte: reportBaselineGte }));
    const reportBeachIn = jest.fn(async () => ({ data: [], error: null }));
    const reportBeachSelect = jest.fn(() => ({ in: reportBeachIn }));
    const reportClient = {
      from: jest
        .fn()
        .mockReturnValueOnce({ select: reportBaselineSelect })
        .mockReturnValueOnce({ select: reportBeachSelect }),
    };
    const emptyRegionalClient = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          gte: jest.fn(async () => ({ data: [], error: null })),
        })),
      })),
    };
    const emptyDailyClient = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            gt: jest.fn(() => ({
              gte: jest.fn(() => ({
                order: jest.fn(async () => ({ data: [], error: null })),
              })),
            })),
          })),
        })),
      })),
    };
    mockCreateSupabaseServiceRoleClient
      .mockReturnValueOnce(reportClient)
      .mockReturnValueOnce(emptyRegionalClient)
      .mockReturnValueOnce(emptyDailyClient);

    const { getForecastAccuracyReport } =
      await import("@/actions/ml/forecast-accuracy-actions");

    const report = await getForecastAccuracyReport();

    expect(report.summary.status).toBe("live");
    expect(report.summary.canClaimImprovement).toBe(false);
    expect(report.beachRows[0]).toMatchObject({
      beachId: "beach-negative",
      improvementPct: -25,
      canClaimImprovement: false,
    });
  });

  it("computes daily time series from live face-height columns", async () => {
    const order = jest.fn(async () => ({
      data: [
        {
          predicted_at: "2026-06-20T03:00:00.000Z",
          observed_m: 1,
          wave_height_om: 1.5,
          offset_corrected_display_height_m: 1.25,
        },
        {
          predicted_at: "2026-06-20T09:00:00.000Z",
          observed_m: 1,
          wave_height_om: null,
          offset_corrected_display_height_m: 1.1,
        },
        {
          predicted_at: "2026-06-21T03:00:00.000Z",
          observed_m: 2,
          wave_height_om: 2.75,
          offset_corrected_display_height_m: 1.5,
        },
      ],
      error: null,
    }));
    const gte = jest.fn(() => ({ order }));
    const gt = jest.fn(() => ({ gte }));
    const eq = jest.fn(() => ({ gt }));
    const select = jest.fn(() => ({ eq }));

    mockCreateSupabaseServiceRoleClient.mockReturnValue({
      from: jest.fn(() => ({ select })),
    });

    const { getDailyAccuracyTimeSeries } =
      await import("@/actions/ml/forecast-accuracy-actions");

    const points = await getDailyAccuracyTimeSeries();
    expect(points).toHaveLength(2);
    expect(points[0]).toMatchObject({
      date: "2026-06-20",
      rawMae: 0.5,
      count: 2,
    });
    expect(points[0]?.correctedMae).toBeCloseTo(0.175);
    expect(points[1]).toMatchObject({
      date: "2026-06-21",
      rawMae: 0.75,
      correctedMae: 0.5,
      count: 1,
    });
    expect(select).toHaveBeenCalledWith(
      "predicted_at, observed_m, wave_height_om, offset_corrected_display_height_m",
    );
    expect(eq).toHaveBeenCalledWith(
      "display_source",
      "face-Hs-transformer-v1",
    );
    expect(gt).toHaveBeenCalledWith("observed_m", 0);
  });
});
