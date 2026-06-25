import { useMemo } from "react";
import Supercluster from "supercluster";
import type { Beach } from "@/types/database";

interface ClusterProperties {
  cluster: boolean;
  cluster_id?: number;
  point_count?: number;
  beachId?: string;
  beachName?: string;
  waveHeight?: number;
  // Aggregated properties for clusters
  waveHeights?: number[];
  beachIds?: string[];
}

export interface ClusterPoint {
  isCluster: boolean;
  clusterId?: number;
  pointCount?: number;
  latitude: number;
  longitude: number;
  // For individual beaches
  beach?: Beach;
  waveHeight?: number;
  // For clusters
  waveHeights?: number[];
  beachIds?: string[];
}

interface UseBeachClusteringProps {
  beaches: Beach[];
  waveHeights: Map<string, number | undefined>;
  bounds: { west: number; south: number; east: number; north: number };
  zoom: number;
  favoriteBeachIds?: Set<string>;
  /** Supercluster radius in px. 0 disables grouping (every spot shown as its own dot). */
  clusterRadius?: number;
}

interface UseBeachClusteringReturn {
  clusters: ClusterPoint[];
  getExpansionZoom: (clusterId: number) => number;
}

export function useBeachClustering({
  beaches,
  waveHeights,
  bounds,
  zoom,
  favoriteBeachIds = new Set(),
  clusterRadius = 60,
}: UseBeachClusteringProps): UseBeachClusteringReturn {
  // Create supercluster index
  const superclusterIndex = useMemo(() => {
    if (!beaches || beaches.length === 0) return null;

    const index = new Supercluster<ClusterProperties>({
      radius: clusterRadius, // 0 => no grouping (all individual dots)
      maxZoom: 14, // Max zoom to cluster at
      minZoom: 0,
      // Custom reduce function to aggregate wave heights
      map: (props) => ({
        cluster: false,
        beachId: props.beachId,
        beachName: props.beachName,
        waveHeight: props.waveHeight,
        waveHeights: props.waveHeight !== undefined ? [props.waveHeight] : [],
        beachIds: props.beachId ? [props.beachId] : [],
      }),
      reduce: (accumulated, props) => {
        // Aggregate wave heights from all points in cluster
        if (props.waveHeights) {
          accumulated.waveHeights = [
            ...(accumulated.waveHeights || []),
            ...props.waveHeights,
          ];
        }
        if (props.beachIds) {
          accumulated.beachIds = [
            ...(accumulated.beachIds || []),
            ...props.beachIds,
          ];
        }
      },
    });

    // Convert beaches to GeoJSON features
    const points: GeoJSON.Feature<GeoJSON.Point, ClusterProperties>[] = beaches
      .filter(
        (beach) =>
          typeof beach.lat === "number" &&
          typeof beach.lon === "number" &&
          isFinite(beach.lat) &&
          isFinite(beach.lon)
      )
      .map((beach) => ({
        type: "Feature",
        properties: {
          cluster: false,
          beachId: beach.id,
          beachName: beach.name,
          waveHeight: waveHeights.get(beach.id),
        },
        geometry: {
          type: "Point",
          coordinates: [beach.lon!, beach.lat!],
        },
      }));

    index.load(points);
    return index;
  }, [beaches, waveHeights, clusterRadius]);

  // Get clusters for current viewport
  const clusters = useMemo((): ClusterPoint[] => {
    if (!superclusterIndex) return [];

    const rawClusters = superclusterIndex.getClusters(
      [bounds.west, bounds.south, bounds.east, bounds.north],
      Math.floor(zoom)
    );

    return rawClusters.map((feature) => {
      const [longitude, latitude] = feature.geometry.coordinates;
      const props = feature.properties;

      if (props.cluster) {
        // It's a cluster
        return {
          isCluster: true,
          clusterId: props.cluster_id,
          pointCount: props.point_count,
          latitude,
          longitude,
          waveHeights: props.waveHeights || [],
          beachIds: props.beachIds || [],
        };
      } else {
        // It's an individual beach
        const beach = beaches.find((b) => b.id === props.beachId);
        return {
          isCluster: false,
          latitude,
          longitude,
          beach,
          waveHeight: props.waveHeight,
        };
      }
    });
  }, [superclusterIndex, bounds, zoom, beaches]);

  // Get expansion zoom for a cluster
  const getExpansionZoom = useMemo(() => {
    return (clusterId: number): number => {
      if (!superclusterIndex) return 16;
      return superclusterIndex.getClusterExpansionZoom(clusterId);
    };
  }, [superclusterIndex]);

  return { clusters, getExpansionZoom };
}
