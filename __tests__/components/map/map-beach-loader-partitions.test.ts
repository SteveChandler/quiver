import { loadBeachesAndWaveHeights } from "@/components/map/map-beach-loader";
import type { Beach } from "@/types/database";

const beach = (id: string, lat: number, lon: number): Beach =>
  ({ id, name: id, lat, lon } as unknown as Beach);

describe("loadBeachesAndWaveHeights — swell partitions", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
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
          swellPartitions: {
            a: {
              s1Dir: 270,
              s1PeriodS: 14,
              s1HeightFt: 3.9,
              s2Dir: 200,
              s2PeriodS: 8,
              s2HeightFt: 1.9,
              windDir: 310,
              windMph: 12,
            },
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
      json: async () => ({ data: { forecasts: {} } }),
    }) as unknown as typeof fetch;

    await loadBeachesAndWaveHeights(
      32.7,
      -117.2,
      [beach("a", 32.71, -117.21)],
      { fetchNearbyBeaches: async () => ({ data: [] }) },
      { timeline: "hourly" },
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/forecasts/bulk?beachIds=a&timeline=hourly",
    );
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
  });
});
