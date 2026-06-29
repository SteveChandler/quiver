/**
 * Mock for supercluster library
 * Simulates clustering behavior for testing purposes
 */

interface ClusterProperties {
  cluster?: boolean;
  cluster_id?: number;
  point_count?: number;
  [key: string]: unknown;
}

interface Feature {
  type: "Feature";
  properties: ClusterProperties;
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
}

interface Options<P> {
  radius?: number;
  maxZoom?: number;
  minZoom?: number;
  map?: (props: P) => P;
  reduce?: (accumulated: P, props: P) => void;
}

// Simple distance calculation (Euclidean for simplicity in tests)
function distance(
  coords1: [number, number],
  coords2: [number, number]
): number {
  const dx = coords1[0] - coords2[0];
  const dy = coords1[1] - coords2[1];
  return Math.sqrt(dx * dx + dy * dy);
}

class MockSupercluster<P extends ClusterProperties = ClusterProperties> {
  private points: Feature[] = [];
  private options: Options<P>;
  private clusterId = 0;

  constructor(options: Options<P> = {}) {
    this.options = {
      radius: 60,
      maxZoom: 16,
      minZoom: 0,
      ...options,
    };
  }

  load(points: Feature[]): void {
    this.points = points.map((p) => {
      if (this.options.map) {
        return {
          ...p,
          properties: this.options.map(p.properties as P),
        };
      }
      return p;
    });
    this.clusterId = 0;
  }

  getClusters(
    bbox: [number, number, number, number],
    zoom: number
  ): Feature[] {
    const [west, south, east, north] = bbox;
    const maxZoom = this.options.maxZoom ?? 16;

    // Filter points within bounds
    const pointsInBounds = this.points.filter((p) => {
      const [lon, lat] = p.geometry.coordinates;
      return lon >= west && lon <= east && lat >= south && lat <= north;
    });

    // If zoom is high enough, return individual points
    if (zoom >= maxZoom) {
      return pointsInBounds.map((p) => ({
        ...p,
        properties: {
          ...p.properties,
          cluster: false,
        },
      }));
    }

    // Simple clustering: group points that are close together
    // Threshold decreases as zoom increases
    const clusterThreshold = 0.1 / Math.pow(2, zoom - 8);
    const clusters: Feature[] = [];
    const used = new Set<number>();

    for (let i = 0; i < pointsInBounds.length; i++) {
      if (used.has(i)) continue;

      const point = pointsInBounds[i];
      const nearbyIndices: number[] = [i];

      // Find nearby points
      for (let j = i + 1; j < pointsInBounds.length; j++) {
        if (used.has(j)) continue;
        const other = pointsInBounds[j];
        const dist = distance(
          point.geometry.coordinates,
          other.geometry.coordinates
        );
        if (dist < clusterThreshold) {
          nearbyIndices.push(j);
        }
      }

      if (nearbyIndices.length > 1) {
        // Create cluster
        nearbyIndices.forEach((idx) => used.add(idx));

        // Calculate center point
        let sumLon = 0;
        let sumLat = 0;
        const nearbyPoints = nearbyIndices.map((idx) => pointsInBounds[idx]);
        nearbyPoints.forEach((p) => {
          sumLon += p.geometry.coordinates[0];
          sumLat += p.geometry.coordinates[1];
        });

        // Aggregate properties using reduce
        let aggregatedProps: ClusterProperties = {
          cluster: true,
          cluster_id: this.clusterId++,
          point_count: nearbyIndices.length,
        };

        if (this.options.reduce) {
          const firstMapped = nearbyPoints[0].properties as P;
          aggregatedProps = { ...firstMapped, ...aggregatedProps };
          for (let k = 1; k < nearbyPoints.length; k++) {
            this.options.reduce(
              aggregatedProps as P,
              nearbyPoints[k].properties as P
            );
          }
        }

        clusters.push({
          type: "Feature",
          properties: aggregatedProps,
          geometry: {
            type: "Point",
            coordinates: [
              sumLon / nearbyIndices.length,
              sumLat / nearbyIndices.length,
            ],
          },
        });
      } else {
        // Single point
        used.add(i);
        clusters.push({
          ...point,
          properties: {
            ...point.properties,
            cluster: false,
          },
        });
      }
    }

    return clusters;
  }

  getClusterExpansionZoom(clusterId: number): number {
    // Return a zoom level higher than the current one
    // This simulates the behavior of expanding a cluster
    return Math.min((this.options.maxZoom ?? 16) + 1, 20);
  }

  getChildren(clusterId: number): Feature[] {
    // Return empty array for simplicity
    return [];
  }

  getLeaves(
    clusterId: number,
    limit?: number,
    offset?: number
  ): Feature[] {
    return this.points.slice(offset ?? 0, limit);
  }
}

export default MockSupercluster;
