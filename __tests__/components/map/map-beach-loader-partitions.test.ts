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
  });
});
