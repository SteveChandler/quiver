import { renderHook } from "@testing-library/react";
import { useBeachClustering } from "@/hooks/use-beach-clustering";
import type { Beach } from "@/types/database";

const mockBeaches: Partial<Beach>[] = [
  { id: "1", name: "Beach 1", lat: 32.75, lon: -117.25 },
  { id: "2", name: "Beach 2", lat: 32.751, lon: -117.251 }, // Very close to Beach 1
  { id: "3", name: "Beach 3", lat: 32.85, lon: -117.35 }, // Far from others
];

const mockWaveHeights = new Map<string, number>([
  ["1", 2.5],
  ["2", 3.2],
  ["3", 1.5],
]);

describe("useBeachClustering", () => {
  it("should return clusters at low zoom", () => {
    const { result } = renderHook(() =>
      useBeachClustering({
        beaches: mockBeaches as Beach[],
        waveHeights: mockWaveHeights,
        bounds: { west: -118, south: 32, east: -117, north: 33 },
        zoom: 10,
      })
    );

    // At low zoom, nearby beaches should cluster
    expect(result.current.clusters.length).toBeLessThan(mockBeaches.length);
  });

  it("should return individual beaches at high zoom", () => {
    const { result } = renderHook(() =>
      useBeachClustering({
        beaches: mockBeaches as Beach[],
        waveHeights: mockWaveHeights,
        bounds: { west: -117.3, south: 32.7, east: -117.2, north: 32.8 },
        zoom: 16,
      })
    );

    // At high zoom, should see individual beaches (not clusters)
    const individualMarkers = result.current.clusters.filter(
      (c) => !c.isCluster
    );
    expect(individualMarkers.length).toBeGreaterThan(0);
  });

  it("returns only individual beach points when clustering is disabled", () => {
    const { result } = renderHook(() =>
      useBeachClustering({
        beaches: mockBeaches as Beach[],
        waveHeights: mockWaveHeights,
        bounds: { west: -118, south: 32, east: -117, north: 33 },
        zoom: 10,
        disableClustering: true,
      })
    );

    expect(result.current.clusters).toHaveLength(mockBeaches.length);
    expect(result.current.clusters.every((cluster) => !cluster.isCluster)).toBe(
      true
    );
    expect(result.current.clusters.map((cluster) => cluster.beach?.id)).toEqual(
      ["1", "2", "3"]
    );
    expect(result.current.clusters.map((cluster) => cluster.waveHeight)).toEqual(
      [2.5, 3.2, 1.5]
    );
  });

  it("should return empty array for empty beaches", () => {
    const { result } = renderHook(() =>
      useBeachClustering({
        beaches: [],
        waveHeights: new Map(),
        bounds: { west: -118, south: 32, east: -117, north: 33 },
        zoom: 12,
      })
    );

    expect(result.current.clusters).toEqual([]);
  });

  it("should provide getExpansionZoom for clusters", () => {
    const { result } = renderHook(() =>
      useBeachClustering({
        beaches: mockBeaches as Beach[],
        waveHeights: mockWaveHeights,
        bounds: { west: -118, south: 32, east: -117, north: 33 },
        zoom: 10,
      })
    );

    const cluster = result.current.clusters.find((c) => c.isCluster);
    expect(cluster).toMatchObject({ isCluster: true });
    if (typeof cluster?.clusterId !== "number") {
      throw new Error("Expected clustered marker to include a cluster id");
    }

    const expansionZoom = result.current.getExpansionZoom(cluster.clusterId);
    expect(typeof expansionZoom).toBe("number");
    expect(expansionZoom).toBeGreaterThan(10);
  });
});
