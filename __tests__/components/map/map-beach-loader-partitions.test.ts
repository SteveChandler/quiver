import {
  loadBeachesAndWaveHeights,
  parseHourlySwellTimeline,
} from "@/components/map/map-beach-loader";
import type { Beach } from "@/types/database";

const beach = (id: string, lat: number, lon: number): Beach =>
  ({ id, name: id, lat, lon } as unknown as Beach);

const partition = (overrides: Record<string, number | null> = {}) => ({
  s1Dir: 270,
  s1PeriodS: 14,
  s1HeightFt: 3.9,
  s2Dir: 200,
  s2PeriodS: 8,
  s2HeightFt: 1.9,
  windDir: 310,
  windMph: 12,
  ...overrides,
});

describe("loadBeachesAndWaveHeights — swell partitions", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("treats a provided empty beach list as authoritative", async () => {
    const fetchNearbyBeaches = jest.fn();
    global.fetch = jest.fn() as unknown as typeof fetch;

    const result = await loadBeachesAndWaveHeights(
      32.7,
      -117.2,
      [],
      { fetchNearbyBeaches },
    );

    expect(result.locations).toEqual([]);
    expect(fetchNearbyBeaches).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("exposes nearby geometry before bulk forecast enrichment resolves", async () => {
    const resolvedBeach = beach("nearby", 32.71, -117.21);
    let resolveBulk!: (response: Response) => void;
    const bulkResponse = new Promise<Response>((resolve) => {
      resolveBulk = resolve;
    });
    global.fetch = jest.fn(() => bulkResponse) as unknown as typeof fetch;
    const onLocationsResolved = jest.fn();

    const resultPromise = loadBeachesAndWaveHeights(
      32.7,
      -117.2,
      undefined,
      { fetchNearbyBeaches: async () => ({ data: [resolvedBeach] }) },
      { onLocationsResolved },
    );

    await Promise.resolve();
    await Promise.resolve();

    expect(onLocationsResolved).toHaveBeenCalledWith([resolvedBeach]);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/forecasts/bulk?beachIds=nearby",
      { signal: undefined },
    );

    resolveBulk({
      ok: true,
      status: 200,
      json: async () => ({ data: { forecasts: {} } }),
    } as Response);
    await expect(resultPromise).resolves.toMatchObject({
      locations: [resolvedBeach],
    });
  });

  it("parses swellPartitions from the bulk response into partitionsMap", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          forecasts: { a: 3.5 },
          waterTemps: {},
          conditionScores: {},
          conditionSummaries: {},
          isCalibrated: { a: false },
          swellPartitions: {
            a: partition(),
          },
        },
      }),
    }) as unknown as typeof fetch;

    const result = await loadBeachesAndWaveHeights(
      32.7,
      -117.2,
      [beach("a", 32.71, -117.21)],
      { fetchNearbyBeaches: async () => ({ data: [] }) }
    );

    expect(result.partitionsMap.get("a")).toEqual({
      s1Dir: 270,
      s1PeriodS: 14,
      s1HeightFt: 3.9,
      s2Dir: 200,
      s2PeriodS: 8,
      s2HeightFt: 1.9,
      windDir: 310,
      windMph: 12,
    });
    expect(result.isCalibratedMap.get("a")).toBe(false);
  });

  it("parses swellPartitionTimeline from the bulk response into partitionsTimelineMap", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          forecasts: { a: 3.5 },
          waterTemps: {},
          conditionScores: {},
          conditionSummaries: {},
          swellPartitionTimeline: {
            a: [
              partition(),
              partition({
                s1Dir: 280,
                s1PeriodS: 15,
                s1HeightFt: 4.4,
                s2Dir: 210,
                s2PeriodS: 9,
                s2HeightFt: 2.1,
                windDir: 320,
                windMph: 14,
              }),
            ],
          },
        },
      }),
    }) as unknown as typeof fetch;

    const result = await loadBeachesAndWaveHeights(
      32.7,
      -117.2,
      [beach("a", 32.71, -117.21)],
      { fetchNearbyBeaches: async () => ({ data: [] }) }
    );

    expect(result.partitionsTimelineMap.get("a")).toEqual([
      {
        s1Dir: 270,
        s1PeriodS: 14,
        s1HeightFt: 3.9,
        s2Dir: 200,
        s2PeriodS: 8,
        s2HeightFt: 1.9,
        windDir: 310,
        windMph: 12,
      },
      {
        s1Dir: 280,
        s1PeriodS: 15,
        s1HeightFt: 4.4,
        s2Dir: 210,
        s2PeriodS: 9,
        s2HeightFt: 2.1,
        windDir: 320,
        windMph: 14,
      },
    ]);
  });

  it("requests the hourly timeline only when explicitly enabled", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          forecasts: {},
          hourlySwellTimeline: {
            timestamps: ["2026-07-10T20:00:00.000Z"],
            partitionsByBeach: { a: [null] },
            hasMore: false,
            nextStart: null,
          },
        },
      }),
    }) as unknown as typeof fetch;

    await loadBeachesAndWaveHeights(
      32.7,
      -117.2,
      [beach("a", 32.71, -117.21)],
      { fetchNearbyBeaches: async () => ({ data: [] }) },
      {
        timeline: "hourly",
        timelineStart: "2026-07-10T20:00:00.000Z",
        timelineHours: 48,
        timelineOnly: true,
      },
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/forecasts/bulk?beachIds=a&timeline=hourly&timelineOnly=true&timelineBeachIds=a&timelineStart=2026-07-10T20%3A00%3A00.000Z&timelineHours=48",
      { signal: undefined },
    );
  });

  it("requests timeline data for a bounded spatial sample while retaining every marker beach", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          forecasts: {},
          hourlySwellTimeline: {
            timestamps: ["2026-07-10T20:00:00.000Z"],
            partitionsByBeach: Object.fromEntries(
              Array.from({ length: 20 }, (_, index) => [`beach-${index}`, [null]]),
            ),
            hasMore: false,
            nextStart: null,
          },
        },
      }),
    }) as unknown as typeof fetch;
    const beaches = Array.from({ length: 20 }, (_, index) =>
      beach(`beach-${index}`, 32.7 + index * 0.02, -117.2),
    );

    const result = await loadBeachesAndWaveHeights(
      32.7,
      -117.2,
      beaches,
      { fetchNearbyBeaches: async () => ({ data: [] }) },
      { timeline: "hourly", timelineFocusBeachId: "beach-10" },
    );
    const requestedUrl = new URL(
      (global.fetch as jest.Mock).mock.calls[0][0] as string,
      "https://example.test",
    );

    expect(result.locations).toHaveLength(20);
    expect(result.hourlyTimelineBeachIds).toHaveLength(8);
    expect(result.hourlyTimelineBeachIds[0]).toBe("beach-10");
    expect(requestedUrl.searchParams.get("beachIds")?.split(",")).toHaveLength(20);
    expect(requestedUrl.searchParams.get("timelineBeachIds")?.split(",")).toEqual(
      result.hourlyTimelineBeachIds,
    );
  });

  it("returns a defensively parsed hourly envelope without losing current marker data", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          forecasts: { a: 3.5 },
          swellPartitions: {
            a: partition(),
          },
          hourlySwellTimeline: {
            timestamps: ["2026-07-10T20:00:00.000Z"],
            partitionsByBeach: {
              a: [partition()],
            },
            hasMore: true,
            nextStart: "2026-07-12T20:00:00.000Z",
          },
        },
      }),
    }) as unknown as typeof fetch;

    const result = await loadBeachesAndWaveHeights(
      32.7,
      -117.2,
      [beach("a", 32.71, -117.21)],
      { fetchNearbyBeaches: async () => ({ data: [] }) },
      { timeline: "hourly" },
    );

    expect(result.partitionsMap.get("a")).toMatchObject({ s1HeightFt: 3.9 });
    expect((result as typeof result & { hourlySwellTimeline?: unknown }).hourlySwellTimeline).toEqual({
      timestamps: ["2026-07-10T20:00:00.000Z"],
      partitionsByBeach: {
        a: [partition()],
      },
      hasMore: true,
      nextStart: "2026-07-12T20:00:00.000Z",
    });
  });

  it("treats malformed hourly envelopes as unavailable without losing marker data", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          forecasts: { a: 3.5 },
          swellPartitions: {
            a: partition(),
          },
          hourlySwellTimeline: {
            timestamps: ["not-a-timestamp"],
            partitionsByBeach: { a: [] },
            hasMore: "yes",
            nextStart: null,
          },
        },
      }),
    }) as unknown as typeof fetch;

    const result = await loadBeachesAndWaveHeights(
      32.7,
      -117.2,
      [beach("a", 32.71, -117.21)],
      { fetchNearbyBeaches: async () => ({ data: [] }) },
      { timeline: "hourly" },
    );

    expect(result.partitionsMap.get("a")).toMatchObject({ s1HeightFt: 3.9 });
    expect((result as typeof result & { hourlySwellTimeline?: unknown }).hourlySwellTimeline).toBeNull();
    expect(result.forecastStatus).toBe("unavailable");
  });

  it("requires canonical unique ascending UTC hours and every requested beach", () => {
    const valid = {
      timestamps: ["2026-07-10T20:00:00.000Z", "2026-07-10T21:00:00.000Z"],
      partitionsByBeach: { a: [null, null], b: [null, null] },
      hasMore: false,
      nextStart: null,
    };

    expect(parseHourlySwellTimeline(valid, ["a", "b"])).toEqual(valid);
    expect(parseHourlySwellTimeline(valid, ["a"])).toEqual(valid);
    expect(parseHourlySwellTimeline({ ...valid, timestamps: [
      "2026-07-10T20:30:00.000Z",
      "2026-07-10T21:30:00.000Z",
    ] }, ["a", "b"])).toBeNull();
    expect(parseHourlySwellTimeline({ ...valid, timestamps: [
      "2026-07-10T20:00:00Z",
      "2026-07-10T21:00:00Z",
    ] }, ["a", "b"])).toBeNull();
    expect(parseHourlySwellTimeline({ ...valid, timestamps: [
      "2026-07-10T20:00:00.000+00:00",
      "2026-07-10T21:00:00.000+00:00",
    ] }, ["a", "b"])).toBeNull();
    expect(parseHourlySwellTimeline({ ...valid, timestamps: [
      "2026-07-10T20:00:00.000Z",
      "2026-07-10T20:00:00.000Z",
    ] }, ["a", "b"])).toBeNull();
    expect(parseHourlySwellTimeline({
      ...valid,
      partitionsByBeach: { a: [null, null] },
    }, ["a", "b"])).toBeNull();
    expect(parseHourlySwellTimeline({
      ...valid,
      partitionsByBeach: { ...valid.partitionsByBeach, extra: [null] },
    }, ["a", "b"])).toBeNull();
  });

  it("rejects an aligned envelope missing a requested beach without losing current data", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          forecasts: { a: 3.5 },
          swellPartitions: { a: partition() },
          hourlySwellTimeline: {
            timestamps: ["2026-07-10T20:00:00.000Z"],
            partitionsByBeach: { extra: [null] },
            hasMore: false,
            nextStart: null,
          },
        },
      }),
    }) as unknown as typeof fetch;

    const result = await loadBeachesAndWaveHeights(
      32.7,
      -117.2,
      [beach("a", 32.71, -117.21)],
      { fetchNearbyBeaches: async () => ({ data: [] }) },
      { timeline: "hourly" },
    );

    expect(result.partitionsMap.get("a")).toEqual(partition());
    expect(result.hourlySwellTimeline).toBeNull();
    expect(result.forecastStatus).toBe("unavailable");
  });

  it.each([
    { label: "more pages without a next start", hasMore: true, nextStart: null },
    {
      label: "a terminal page with a next start",
      hasMore: false,
      nextStart: "2026-07-10T21:00:00.000Z",
    },
  ])("rejects $label without losing current marker data", async ({ hasMore, nextStart }) => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          forecasts: { a: 3.5 },
          swellPartitions: { a: partition() },
          hourlySwellTimeline: {
            timestamps: ["2026-07-10T20:00:00.000Z"],
            partitionsByBeach: { a: [null] },
            hasMore,
            nextStart,
          },
        },
      }),
    }) as unknown as typeof fetch;

    const result = await loadBeachesAndWaveHeights(
      32.7,
      -117.2,
      [beach("a", 32.71, -117.21)],
      { fetchNearbyBeaches: async () => ({ data: [] }) },
      { timeline: "hourly" },
    );

    expect(result.partitionsMap.get("a")).toEqual(partition());
    expect(result.hourlySwellTimeline).toBeNull();
    expect(result.forecastStatus).toBe("unavailable");
  });

  it("marks an all-batch forecast failure unavailable", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }) as unknown as typeof fetch;

    const result = await loadBeachesAndWaveHeights(
      32.7,
      -117.2,
      [beach("a", 32.71, -117.21)],
      { fetchNearbyBeaches: async () => ({ data: [] }) },
      { timeline: "hourly" },
    );

    expect(result.forecastStatus).toBe("unavailable");
    expect(result.partitionsMap.size).toBe(0);
  });

  it.each([
    { label: "an empty current partition", value: {} },
    { label: "a non-numeric current partition field", value: partition({ windMph: Number.NaN }) },
  ])("marks $label unavailable instead of rendering corrupt flow data", async ({ value }) => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          forecasts: { a: 3.5 },
          swellPartitions: { a: value },
        },
      }),
    }) as unknown as typeof fetch;

    const result = await loadBeachesAndWaveHeights(
      32.7,
      -117.2,
      [beach("a", 32.71, -117.21)],
      { fetchNearbyBeaches: async () => ({ data: [] }) },
    );

    expect(result.forecastStatus).toBe("unavailable");
    expect(result.partitionsMap.size).toBe(0);
  });

  it("marks a malformed timeline partition unavailable", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          forecasts: { a: 3.5 },
          swellPartitionTimeline: { a: [partition(), {}] },
        },
      }),
    }) as unknown as typeof fetch;

    const result = await loadBeachesAndWaveHeights(
      32.7,
      -117.2,
      [beach("a", 32.71, -117.21)],
      { fetchNearbyBeaches: async () => ({ data: [] }) },
    );

    expect(result.forecastStatus).toBe("unavailable");
    expect(result.partitionsTimelineMap.size).toBe(0);
  });

  it("marks malformed partition containers unavailable", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          forecasts: { a: 3.5 },
          swellPartitions: [],
          swellPartitionTimeline: "corrupt",
        },
      }),
    }) as unknown as typeof fetch;

    const result = await loadBeachesAndWaveHeights(
      32.7,
      -117.2,
      [beach("a", 32.71, -117.21)],
      { fetchNearbyBeaches: async () => ({ data: [] }) },
    );

    expect(result.forecastStatus).toBe("unavailable");
  });

  it("passes one abort signal through the bulk forecast request", async () => {
    const controller = new AbortController();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { forecasts: {} } }),
    }) as unknown as typeof fetch;

    await loadBeachesAndWaveHeights(
      32.7,
      -117.2,
      [beach("a", 32.71, -117.21)],
      { fetchNearbyBeaches: async () => ({ data: [] }) },
      { signal: controller.signal },
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/forecasts/bulk?beachIds=a",
      { signal: controller.signal },
    );
  });

  it("requests forecast data only for the capped rendered beach set", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { forecasts: {} } }),
    }) as unknown as typeof fetch;
    const beaches = Array.from({ length: 25 }, (_, index) =>
      beach(`beach-${index}`, 32.71, -117.21)
    );

    const result = await loadBeachesAndWaveHeights(32.7, -117.2, beaches, {
      fetchNearbyBeaches: async () => ({ data: [] }),
    });

    expect(result.locations).toHaveLength(20);
    const requestedUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    const requestedIds = new URL(requestedUrl, "https://example.test").searchParams
      .get("beachIds")
      ?.split(",");
    expect(requestedIds).toHaveLength(20);
    expect(requestedIds).not.toContain("beach-20");
  });

  it("returns an empty partitionsMap when the field is absent", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { forecasts: { a: 3.5 } } }),
    }) as unknown as typeof fetch;

    const result = await loadBeachesAndWaveHeights(
      32.7,
      -117.2,
      [beach("a", 32.71, -117.21)],
      { fetchNearbyBeaches: async () => ({ data: [] }) }
    );
    expect(result.partitionsMap.size).toBe(0);
    expect(result.partitionsTimelineMap.size).toBe(0);
    expect(result.forecastStatus).toBe("empty");
  });
});
