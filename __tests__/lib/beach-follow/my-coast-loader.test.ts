import {
  MY_COAST_FOLLOW_LIMIT,
  loadMyCoastBatch,
  type MyCoastBatchSources,
} from "@/lib/beach-follow/my-coast-loader";

const BEACH_IDS = Array.from(
  { length: MY_COAST_FOLLOW_LIMIT + 2 },
  (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
);

function sources(): jest.Mocked<MyCoastBatchSources> {
  return {
    loadBeaches: jest.fn(async (beachIds) => beachIds.map((id, index) => ({
      id,
      name: `Beach ${index + 1}`,
      slug: `beach-${index + 1}`,
      city: "San Diego",
      state: "CA",
      country: "USA",
      windOffshoreDeg: 270,
      windOffshoreToleranceDeg: 45,
    }))),
    loadForecasts: jest.fn(async (beachIds) => beachIds.map((beachId) => ({
      beachId,
      forecastAt: "2026-08-25T16:00:00.000Z",
      updatedAt: "2026-08-25T15:55:00.000Z",
      waterTemp: "68°F",
      tideStatus: "Rising",
      nextTideAt: "2026-08-25T18:00:00.000Z",
      nextTideHeight: "4.2",
      nextTideType: "high",
      windSpeed: "8 mph",
      windDirection: "W",
      windDirectionDeg: 270,
      waveHeight: "3.1 ft",
      dataSource: "NOAA",
    }))),
    loadWaterQuality: jest.fn(async (_beachIds: string[]) => []),
  };
}

describe("loadMyCoastBatch", () => {
  it("caps followed beaches and calls each source once with the same bounded batch", async () => {
    const batchSources = sources();

    const result = await loadMyCoastBatch(BEACH_IDS, batchSources);

    const boundedIds = BEACH_IDS.slice(0, MY_COAST_FOLLOW_LIMIT);
    expect(result.beaches).toHaveLength(MY_COAST_FOLLOW_LIMIT);
    expect(result.truncatedCount).toBe(2);
    expect(batchSources.loadBeaches).toHaveBeenCalledTimes(1);
    expect(batchSources.loadForecasts).toHaveBeenCalledTimes(1);
    expect(batchSources.loadWaterQuality).toHaveBeenCalledTimes(1);
    expect(batchSources.loadBeaches).toHaveBeenCalledWith(boundedIds);
    expect(batchSources.loadForecasts).toHaveBeenCalledWith(boundedIds);
    expect(batchSources.loadWaterQuality).toHaveBeenCalledWith(boundedIds);
  });

  it("keeps beach and forecast data useful when water quality fails", async () => {
    const batchSources = sources();
    batchSources.loadWaterQuality.mockRejectedValue(new Error("source down"));

    const result = await loadMyCoastBatch(BEACH_IDS.slice(0, 2), batchSources);

    expect(result.beaches).toHaveLength(2);
    expect(result.beaches[0]).toMatchObject({
      name: "Beach 1",
      forecast: { waterTemp: "68°F" },
      waterQuality: null,
      unavailableSources: ["water_quality"],
    });
  });

  it("returns no work for an empty follow list", async () => {
    const batchSources = sources();

    await expect(loadMyCoastBatch([], batchSources)).resolves.toEqual({
      beaches: [],
      truncatedCount: 0,
    });
    expect(batchSources.loadBeaches).not.toHaveBeenCalled();
    expect(batchSources.loadForecasts).not.toHaveBeenCalled();
    expect(batchSources.loadWaterQuality).not.toHaveBeenCalled();
  });
});
