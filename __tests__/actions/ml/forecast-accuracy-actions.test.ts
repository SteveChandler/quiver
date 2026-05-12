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
      getOverallAccuracyStats,
      getRegionalAccuracy,
      getTopBeaches,
    } = await import("@/actions/ml/forecast-accuracy-actions");

    await expect(getOverallAccuracyStats()).resolves.toBeNull();
    await expect(getRegionalAccuracy()).resolves.toEqual([]);
    await expect(getTopBeaches()).resolves.toEqual([]);
    await expect(getDailyAccuracyTimeSeries()).resolves.toEqual([]);
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
});
