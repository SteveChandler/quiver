import {
  readLatestForecastMetadata,
  type LatestForecastMetadataOptions,
} from "@/lib/utils/forecast-service-utils";

type LatestRow = {
  updated_at: string;
  data_source: string | null;
};

type QueryResult = {
  data: LatestRow | null;
  error: { message: string } | null;
};

function createMetadataClient(result: QueryResult) {
  const maybeSingle = jest.fn(async () => result);
  const eq = jest.fn(() => ({ maybeSingle }));
  const select = jest.fn(() => ({ eq }));
  const from = jest.fn(() => ({ select }));

  return {
    client: { from } as unknown as Parameters<
      typeof readLatestForecastMetadata
    >[0],
    from,
    select,
    eq,
  };
}

async function readWithSource(
  dataSource: string | null,
  options?: LatestForecastMetadataOptions,
) {
  const eightHoursAgo = new Date(
    Date.now() - 8 * 60 * 60 * 1000,
  ).toISOString();
  const { client } = createMetadataClient({
    data: { updated_at: eightHoursAgo, data_source: dataSource },
    error: null,
  });

  return readLatestForecastMetadata(client, "beach-id", options);
}

describe("readLatestForecastMetadata", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-06T12:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("queries the latest view and returns missing metadata", async () => {
    const { client, from, select, eq } = createMetadataClient({
      data: null,
      error: null,
    });

    const result = await readLatestForecastMetadata(client, "beach-id");

    expect(from).toHaveBeenCalledWith("v_enhanced_forecast_latest");
    expect(select).toHaveBeenCalledWith("updated_at, data_source");
    expect(eq).toHaveBeenCalledWith("beach_id", "beach-id");
    expect(result).toEqual({
      cached: false,
      stale: false,
      missing: true,
      dataSource: null,
      stalenessDataSource: null,
      lastUpdated: null,
      reason: "No forecast data in cache",
      stalenessDetails: null,
    });
  });

  it("preserves a null source and the default threshold when no fallback is requested", async () => {
    const result = await readWithSource(null);

    expect(result).toEqual(
      expect.objectContaining({
        stale: true,
        missing: false,
        dataSource: null,
        stalenessDataSource: null,
        reason: "Data is 8.0h old (threshold: 6h)",
      }),
    );
  });

  it("uses the requested fallback source for staleness without replacing the raw source", async () => {
    const result = await readWithSource(null, {
      fallbackDataSource: "FALLBACK",
    });

    expect(result).toEqual(
      expect.objectContaining({
        stale: false,
        missing: false,
        dataSource: null,
        stalenessDataSource: "FALLBACK",
        reason: null,
      }),
    );
    expect(result.stalenessDetails?.threshold).toBe(12);
  });

  it("propagates view query errors", async () => {
    const { client } = createMetadataClient({
      data: null,
      error: { message: "metadata query failed" },
    });

    await expect(
      readLatestForecastMetadata(client, "beach-id"),
    ).rejects.toThrow("metadata query failed");
  });
});
