# Map Marker Clustering Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement marker clustering to eliminate overlapping beach badges on the map.

**Architecture:** Use Supercluster library to dynamically group nearby beaches into cluster markers. Clusters display wave height range and count, expanding to individual markers when clicked or zoomed.

**Tech Stack:** Supercluster, Mapbox GL JS, React, TypeScript

---

## Task 1: Add Supercluster Dependency

**Files:**
- Modify: `package.json`

**Step 1: Install supercluster and types**

Run:
```bash
yarn add supercluster && yarn add -D @types/supercluster
```

Expected: Dependencies added to package.json

**Step 2: Verify installation**

Run:
```bash
yarn list supercluster
```

Expected: Shows supercluster version installed

**Step 3: Commit**

```bash
git add package.json yarn.lock
git commit -m "chore: add supercluster dependency for map marker clustering"
```

---

## Task 2: Create Cluster Formatting Utility

**Files:**
- Create: `lib/utils/cluster-formatter.ts`
- Create: `__tests__/lib/utils/cluster-formatter.test.ts`

**Step 1: Write the failing tests**

Create `__tests__/lib/utils/cluster-formatter.test.ts`:

```typescript
import {
  formatClusterWaveRange,
  getClusterColor,
} from "@/lib/utils/cluster-formatter";

describe("formatClusterWaveRange", () => {
  it("should return range for different wave heights", () => {
    const waveHeights = [1.5, 2.5, 3.2];
    expect(formatClusterWaveRange(waveHeights)).toBe("1-4ft");
  });

  it("should return single value when all same height", () => {
    const waveHeights = [2.5, 2.8, 2.2];
    expect(formatClusterWaveRange(waveHeights)).toBe("2-3ft");
  });

  it("should handle empty array", () => {
    expect(formatClusterWaveRange([])).toBe("—");
  });

  it("should handle undefined values in array", () => {
    const waveHeights = [1.5, undefined, 3.2, null] as (number | undefined | null)[];
    expect(formatClusterWaveRange(waveHeights)).toBe("1-4ft");
  });

  it("should return 0-1ft for very small waves", () => {
    const waveHeights = [0.3, 0.5, 0.8];
    expect(formatClusterWaveRange(waveHeights)).toBe("0-1ft");
  });

  it("should handle large wave range", () => {
    const waveHeights = [1.0, 5.5, 8.0];
    expect(formatClusterWaveRange(waveHeights)).toBe("1-8ft");
  });
});

describe("getClusterColor", () => {
  it("should return orange gradient for normal clusters", () => {
    expect(getClusterColor(false)).toBe("linear-gradient(to right, #fbbf24, #f59e0b)");
  });

  it("should return blue gradient for favorite clusters", () => {
    expect(getClusterColor(true)).toBe("linear-gradient(to right, #3b82f6, #2563eb)");
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
yarn test __tests__/lib/utils/cluster-formatter.test.ts
```

Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

Create `lib/utils/cluster-formatter.ts`:

```typescript
/**
 * Format wave height range for cluster display
 * @param waveHeights Array of wave heights in feet
 * @returns Formatted range string (e.g., "1-4ft") or "—" if no data
 */
export function formatClusterWaveRange(
  waveHeights: (number | undefined | null)[]
): string {
  const validHeights = waveHeights.filter(
    (h): h is number => typeof h === "number" && !isNaN(h) && isFinite(h)
  );

  if (validHeights.length === 0) return "—";

  const min = Math.min(...validHeights);
  const max = Math.max(...validHeights);

  // Convert to display buckets
  const minBucket = Math.max(0, Math.floor(min));
  const maxBucket = Math.ceil(max);

  // If same bucket, show single range
  if (minBucket === maxBucket || maxBucket - minBucket <= 1) {
    if (minBucket === 0) return "0-1ft";
    return `${minBucket}-${minBucket + 1}ft`;
  }

  return `${minBucket}-${maxBucket}ft`;
}

/**
 * Get cluster marker background color
 * @param hasFavorite Whether cluster contains a favorite beach
 * @returns CSS gradient string
 */
export function getClusterColor(hasFavorite: boolean): string {
  if (hasFavorite) {
    return "linear-gradient(to right, #3b82f6, #2563eb)";
  }
  return "linear-gradient(to right, #fbbf24, #f59e0b)";
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
yarn test __tests__/lib/utils/cluster-formatter.test.ts
```

Expected: All tests PASS

**Step 5: Commit**

```bash
git add lib/utils/cluster-formatter.ts __tests__/lib/utils/cluster-formatter.test.ts
git commit -m "feat: add cluster formatting utilities for wave height ranges"
```

---

## Task 3: Create Supercluster Hook

**Files:**
- Create: `hooks/use-beach-clustering.ts`
- Create: `__tests__/hooks/use-beach-clustering.test.ts`

**Step 1: Write the failing tests**

Create `__tests__/hooks/use-beach-clustering.test.ts`:

```typescript
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
    if (cluster) {
      const expansionZoom = result.current.getExpansionZoom(cluster.clusterId!);
      expect(typeof expansionZoom).toBe("number");
      expect(expansionZoom).toBeGreaterThan(10);
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
yarn test __tests__/hooks/use-beach-clustering.test.ts
```

Expected: FAIL with "Cannot find module"

**Step 3: Write the implementation**

Create `hooks/use-beach-clustering.ts`:

```typescript
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
}: UseBeachClusteringProps): UseBeachClusteringReturn {
  // Create supercluster index
  const superclusterIndex = useMemo(() => {
    if (!beaches || beaches.length === 0) return null;

    const index = new Supercluster<ClusterProperties>({
      radius: 60, // Cluster radius in pixels
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
  }, [beaches, waveHeights]);

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
```

**Step 4: Run test to verify it passes**

Run:
```bash
yarn test __tests__/hooks/use-beach-clustering.test.ts
```

Expected: All tests PASS

**Step 5: Commit**

```bash
git add hooks/use-beach-clustering.ts __tests__/hooks/use-beach-clustering.test.ts
git commit -m "feat: add useBeachClustering hook with Supercluster integration"
```

---

## Task 4: Create Cluster Marker Component

**Files:**
- Create: `components/map/cluster-marker.tsx`
- Create: `__tests__/components/map/cluster-marker.test.tsx`

**Step 1: Write the failing tests**

Create `__tests__/components/map/cluster-marker.test.tsx`:

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import { createClusterMarkerElement } from "@/components/map/cluster-marker";

describe("createClusterMarkerElement", () => {
  it("should create element with wave range and count", () => {
    const element = createClusterMarkerElement({
      waveHeights: [1.5, 2.5, 3.2],
      pointCount: 5,
      hasFavorite: false,
      onHover: jest.fn(),
      onLeave: jest.fn(),
    });

    expect(element.textContent).toContain("1-4ft");
    expect(element.textContent).toContain("5");
  });

  it("should show dash when no wave data", () => {
    const element = createClusterMarkerElement({
      waveHeights: [],
      pointCount: 3,
      hasFavorite: false,
      onHover: jest.fn(),
      onLeave: jest.fn(),
    });

    expect(element.textContent).toContain("—");
  });

  it("should apply blue gradient for favorites", () => {
    const element = createClusterMarkerElement({
      waveHeights: [2.0],
      pointCount: 2,
      hasFavorite: true,
      onHover: jest.fn(),
      onLeave: jest.fn(),
    });

    const badge = element.querySelector("[data-cluster-badge]");
    expect(badge?.getAttribute("style")).toContain("#3b82f6");
  });

  it("should call onHover on mouseenter", () => {
    const onHover = jest.fn();
    const element = createClusterMarkerElement({
      waveHeights: [2.0],
      pointCount: 3,
      hasFavorite: false,
      onHover,
      onLeave: jest.fn(),
    });

    const event = new MouseEvent("mouseenter", { bubbles: true });
    element.dispatchEvent(event);

    expect(onHover).toHaveBeenCalled();
  });

  it("should have correct test id", () => {
    const element = createClusterMarkerElement({
      waveHeights: [2.0],
      pointCount: 3,
      hasFavorite: false,
      onHover: jest.fn(),
      onLeave: jest.fn(),
    });

    expect(element.getAttribute("data-testid")).toBe("cluster-marker");
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
yarn test __tests__/components/map/cluster-marker.test.tsx
```

Expected: FAIL with "Cannot find module"

**Step 3: Write the implementation**

Create `components/map/cluster-marker.tsx`:

```typescript
import {
  formatClusterWaveRange,
  getClusterColor,
} from "@/lib/utils/cluster-formatter";

interface ClusterMarkerOptions {
  waveHeights: (number | undefined)[];
  pointCount: number;
  hasFavorite: boolean;
  onHover: () => void;
  onLeave: () => void;
}

/**
 * Creates a DOM element for a cluster marker
 * Used with Mapbox GL custom markers
 */
export function createClusterMarkerElement({
  waveHeights,
  pointCount,
  hasFavorite,
  onHover,
  onLeave,
}: ClusterMarkerOptions): HTMLElement {
  const waveRange = formatClusterWaveRange(waveHeights);
  const bgColor = getClusterColor(hasFavorite);

  // Create wrapper
  const wrapper = document.createElement("div");
  wrapper.setAttribute("data-testid", "cluster-marker");
  wrapper.style.cssText = `
    pointer-events: auto;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  // Create badge
  const badge = document.createElement("div");
  badge.setAttribute("data-cluster-badge", "true");
  badge.style.cssText = `
    padding: 8px 16px;
    border-radius: 9999px;
    color: white;
    font-size: 14px;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    cursor: pointer;
    min-width: 90px;
    text-align: center;
    border: 2px solid white;
    user-select: none;
    transform-origin: center;
    transition: all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
    background: ${bgColor};
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  `;

  // Wave range text
  const rangeText = document.createElement("span");
  rangeText.textContent = waveRange;
  rangeText.style.fontWeight = "700";

  // Count badge
  const countBadge = document.createElement("span");
  countBadge.textContent = `${pointCount}`;
  countBadge.style.cssText = `
    background: rgba(255, 255, 255, 0.25);
    padding: 2px 6px;
    border-radius: 9999px;
    font-size: 12px;
    font-weight: 500;
  `;

  badge.appendChild(rangeText);
  badge.appendChild(countBadge);

  // Hover effects
  badge.addEventListener("mouseenter", () => {
    badge.style.transform = "scale(1.1)";
    badge.style.boxShadow = "0 8px 20px rgba(0, 0, 0, 0.4)";
    onHover();
  });

  badge.addEventListener("mouseleave", () => {
    badge.style.transform = "scale(1)";
    badge.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.3)";
    onLeave();
  });

  wrapper.appendChild(badge);

  // Forward events to wrapper for Mapbox
  wrapper.addEventListener("mouseenter", () => {
    const event = new MouseEvent("mouseenter", { bubbles: true });
    badge.dispatchEvent(event);
  });

  wrapper.addEventListener("mouseleave", () => {
    const event = new MouseEvent("mouseleave", { bubbles: true });
    badge.dispatchEvent(event);
  });

  return wrapper;
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
yarn test __tests__/components/map/cluster-marker.test.tsx
```

Expected: All tests PASS

**Step 5: Commit**

```bash
git add components/map/cluster-marker.tsx __tests__/components/map/cluster-marker.test.tsx
git commit -m "feat: add cluster marker component for map clustering"
```

---

## Task 5: Integrate Clustering into InteractiveMap

**Files:**
- Modify: `components/map/interactive-map.tsx`

**Step 1: Add imports and hook usage**

Add at top of file after existing imports:

```typescript
import { useBeachClustering, type ClusterPoint } from "@/hooks/use-beach-clustering";
import { createClusterMarkerElement } from "@/components/map/cluster-marker";
```

**Step 2: Add state for map bounds**

Add after the existing state declarations (around line 66):

```typescript
const [mapBounds, setMapBounds] = useState<{
  west: number;
  south: number;
  east: number;
  north: number;
} | null>(null);
const [currentZoom, setCurrentZoom] = useState(initialZoom);
```

**Step 3: Add clustering hook**

Add after the mapBounds state:

```typescript
// Wave heights map for clustering
const [waveHeightMap, setWaveHeightMap] = useState<Map<string, number | undefined>>(new Map());

// Use clustering hook
const { clusters, getExpansionZoom } = useBeachClustering({
  beaches: beaches || [],
  waveHeights: waveHeightMap,
  bounds: mapBounds || { west: -118, south: 32, east: -117, north: 33 },
  zoom: currentZoom,
  favoriteBeachIds,
});
```

**Step 4: Update map initialization to track bounds**

In the map "load" event handler (around line 566), add:

```typescript
map.on("load", async () => {
  setIsMapReady(true);
  // Initialize bounds
  const bounds = map.getBounds();
  if (bounds) {
    setMapBounds({
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth(),
    });
  }
  setCurrentZoom(map.getZoom());
});
```

**Step 5: Update moveend handler to track bounds and zoom**

Modify the handleMoveEnd function to update bounds:

```typescript
const handleMoveEnd = useMemo(
  () =>
    debounce(async () => {
      if (!mapRef.current) return;
      const center = mapRef.current.getCenter();
      const zoom = mapRef.current.getZoom();
      const bounds = mapRef.current.getBounds();

      // Update bounds and zoom for clustering
      if (bounds) {
        setMapBounds({
          west: bounds.getWest(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          north: bounds.getNorth(),
        });
      }
      setCurrentZoom(zoom);

      // Only fetch if viewport has significantly changed
      if (!hasViewportChanged(center.lat, center.lng, zoom)) {
        return;
      }
      lastViewportRef.current = { lat: center.lat, lng: center.lng, zoom };

      // Only populate locations with enhanced forecast data
      await populateLocations(center.lat, center.lng);
    }, 1500),
  [populateLocations, hasViewportChanged]
);
```

**Step 6: Create cluster marker rendering function**

Add a new function to create and handle cluster markers:

```typescript
const createClusterMarker = useCallback(
  (cluster: ClusterPoint): mapboxgl.Marker => {
    const hasFavorite = cluster.beachIds?.some((id) =>
      favoriteBeachIdsRef.current.has(id)
    ) || false;

    const element = createClusterMarkerElement({
      waveHeights: cluster.waveHeights || [],
      pointCount: cluster.pointCount || 0,
      hasFavorite,
      onHover: () => {
        // Show tooltip on hover
      },
      onLeave: () => {
        // Hide tooltip
      },
    });

    // Handle cluster click - zoom to expansion level
    element.addEventListener("click", (e) => {
      e.stopPropagation();
      if (mapRef.current && cluster.clusterId !== undefined) {
        const expansionZoom = getExpansionZoom(cluster.clusterId);
        mapRef.current.flyTo({
          center: [cluster.longitude, cluster.latitude],
          zoom: Math.min(expansionZoom, 16),
          duration: 500,
        });
      }
    });

    const marker = new mapboxgl.Marker({
      element,
      anchor: "center",
    }).setLngLat([cluster.longitude, cluster.latitude]);

    return marker;
  },
  [getExpansionZoom]
);
```

**Step 7: Modify populateLocations to use clusters**

Replace the marker creation loop in populateLocations with cluster-aware rendering:

```typescript
// Inside populateLocations, after fetching wave heights, replace marker creation with:

// Store wave heights for clustering
setWaveHeightMap(waveHeightMap);

// Clear existing markers
cleanupMarkers();

// Render clusters and individual markers
clusters.forEach((cluster) => {
  if (cluster.isCluster) {
    // Render cluster marker
    const marker = createClusterMarker(cluster);
    const markerId = `cluster-${cluster.clusterId}`;
    if (mapRef.current && mapRef.current.getCanvasContainer()) {
      marker.addTo(mapRef.current);
    }
    markersRef.current[markerId] = marker;
  } else if (cluster.beach) {
    // Render individual beach marker (existing logic)
    const location = cluster.beach;
    const markerId = `location-${location.id}`;
    const waveHeight = cluster.waveHeight;

    const badgeElement = createWaveHeightBadge(location, waveHeight);
    // ... rest of existing marker creation code
  }
});
```

**Step 8: Add effect to re-render markers when clusters change**

Add a useEffect to handle cluster updates:

```typescript
// Re-render markers when clusters change
useEffect(() => {
  if (!isMapReady || !mapRef.current || clusters.length === 0) return;

  // Clean up existing markers
  cleanupMarkers();

  // Render all clusters and individual markers
  clusters.forEach((cluster) => {
    if (cluster.isCluster) {
      const marker = createClusterMarker(cluster);
      const markerId = `cluster-${cluster.clusterId}`;
      if (mapRef.current?.getCanvasContainer()) {
        marker.addTo(mapRef.current);
      }
      markersRef.current[markerId] = marker;
    } else if (cluster.beach) {
      const location = cluster.beach;
      const markerId = `location-${location.id}`;
      markersRef.current[markerId]?.remove();

      const waveHeight = waveHeightMap.get(location.id);
      const badgeElement = createWaveHeightBadge(location, waveHeight);

      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        className: "forecast-popup-mapbox",
        maxWidth: "200px",
      }).setHTML(`
        <div class="forecast-popup-content">
          <h4 class="font-semibold">${location.name}</h4>
        </div>
      `);

      const marker = new mapboxgl.Marker({
        element: badgeElement,
        draggable: false,
        anchor: "center",
      })
        .setLngLat([location.lon!, location.lat!])
        .setPopup(popup);

      badgeElement.addEventListener("mouseenter", () => {
        if (mapRef.current) marker.getPopup()?.addTo(mapRef.current);
      });
      badgeElement.addEventListener("mouseleave", () => {
        marker.getPopup()?.remove();
      });

      if (mapRef.current?.getCanvasContainer()) {
        marker.addTo(mapRef.current);
      }
      markersRef.current[markerId] = marker;
    }
  });
}, [clusters, isMapReady, createClusterMarker, createWaveHeightBadge, cleanupMarkers, waveHeightMap]);
```

**Step 9: Run existing tests to ensure no regressions**

Run:
```bash
yarn test __tests__/components/map/
```

Expected: All existing tests PASS

**Step 10: Commit**

```bash
git add components/map/interactive-map.tsx
git commit -m "feat: integrate Supercluster for map marker clustering"
```

---

## Task 6: Manual Testing & Polish

**Step 1: Start development server**

Run:
```bash
yarn dev
```

**Step 2: Test clustering behavior**

Navigate to http://localhost:3000/map and verify:
- [ ] Clusters appear at low zoom (zoom out)
- [ ] Clusters show wave range and count
- [ ] Clicking cluster zooms to show individual beaches
- [ ] Individual markers appear at high zoom
- [ ] Smooth animations on zoom
- [ ] No overlapping markers at any zoom level

**Step 3: Test edge cases**

- [ ] Empty map (no beaches)
- [ ] Single beach in area
- [ ] All beaches with same wave height
- [ ] Missing wave data

**Step 4: Fix any issues found**

Address any visual or behavioral issues discovered during testing.

**Step 5: Final commit**

```bash
git add -A
git commit -m "fix: polish cluster rendering and edge cases"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add Supercluster dependency | package.json |
| 2 | Cluster formatting utilities | lib/utils/cluster-formatter.ts |
| 3 | useBeachClustering hook | hooks/use-beach-clustering.ts |
| 4 | ClusterMarker component | components/map/cluster-marker.tsx |
| 5 | Integrate into InteractiveMap | components/map/interactive-map.tsx |
| 6 | Manual testing & polish | - |

**Total estimated steps:** 30+
**Testing approach:** TDD with unit tests, followed by manual E2E verification
