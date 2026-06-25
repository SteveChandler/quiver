import mapboxgl from "mapbox-gl";
import { createClusterMarkerElement } from "@/components/map/cluster-marker";
import type { ClusterPoint } from "@/hooks/use-beach-clustering";
import type { MapDisplayMode } from "@/components/map/map-marker-builder";

export type ClusterClickBehavior = "expand" | "details";

/**
 * Dependencies injected into createClusterMapMarker so the function
 * remains pure and testable — no closure capture of component state.
 */
export interface ClusterRendererDeps {
  /** Current set of favorite beach IDs */
  favoriteBeachIds: Set<string>;
  /** Map to store cleanup functions for cluster event listeners */
  clusterCleanupMap: Map<string, () => void>;
  /** Returns the zoom level at which a cluster expands */
  getExpansionZoom: (clusterId: number) => number;
  /** Current camera max-zoom cap (e.g. the swell-field coastal leash). */
  getMaxZoom?: () => number;
  /** Returns the map's current zoom level */
  getCurrentZoom: () => number;
  /** Fly the map to a location at a given zoom level */
  flyTo: (center: [number, number], zoom: number) => void;
  /** Display mode: wave-height (default) or water-temp */
  displayMode?: MapDisplayMode;
  /** Map from beach ID to water temperature string */
  waterTempMap?: Map<string, string | undefined>;
  /** How cluster marker clicks should behave */
  clusterClickBehavior?: ClusterClickBehavior;
  /** Optional handler for non-zoom cluster click behavior */
  onClusterClick?: (cluster: ClusterPoint) => void;
}

/**
 * Creates a Mapbox marker for a cluster point.
 *
 * Handles:
 * - Creating the styled cluster DOM element via createClusterMarkerElement
 * - Determining if the cluster contains a favorite beach
 * - Click-to-expand behavior (zooms to cluster expansion level)
 * - Storing cleanup functions for event listeners
 *
 * @param cluster - The cluster point data from useBeachClustering
 * @param deps - Injected dependencies (state, callbacks)
 * @returns A mapboxgl.Marker positioned at the cluster location
 */
export function createClusterMapMarker(
  cluster: ClusterPoint,
  deps: ClusterRendererDeps
): mapboxgl.Marker {
  const hasFavorite =
    cluster.beachIds?.some((id) => deps.favoriteBeachIds.has(id)) || false;

  // Collect water temps for beaches in this cluster
  const waterTemps = deps.waterTempMap && cluster.beachIds
    ? cluster.beachIds.map((id) => deps.waterTempMap!.get(id))
    : [];

  const { element, cleanup } = createClusterMarkerElement({
    waveHeights: cluster.waveHeights || [],
    pointCount: cluster.pointCount || 0,
    hasFavorite,
    onHover: () => {},
    onLeave: () => {},
    displayMode: deps.displayMode,
    waterTemps,
  });

  // Store cleanup function
  const clusterId = `cluster-${cluster.clusterId}`;
  deps.clusterCleanupMap.set(clusterId, cleanup);

  // Handle cluster click
  element.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();

    if (deps.clusterClickBehavior === "details" && deps.onClusterClick) {
      deps.onClusterClick(cluster);
      return;
    }

    if (cluster.clusterId !== undefined) {
      const expansionZoom = deps.getExpansionZoom(cluster.clusterId);
      // When a camera zoom cap (e.g. the swell-field coastal leash) sits below
      // the zoom needed to split this cluster, zooming would stall at the cap
      // and the cluster could never break into individual, tappable spots. Fall
      // back to the details popup so the user can still reach a beach.
      const maxZoom = deps.getMaxZoom?.() ?? Infinity;
      if (expansionZoom > maxZoom && deps.onClusterClick) {
        deps.onClusterClick(cluster);
        return;
      }
      const target = Math.min(expansionZoom, maxZoom, 18);
      const current = deps.getCurrentZoom();

      if (target > current + 0.3) {
        deps.flyTo([cluster.longitude, cluster.latitude], target);
      } else if (deps.onClusterClick) {
        deps.onClusterClick(cluster);
      } else {
        deps.flyTo([cluster.longitude, cluster.latitude], target);
      }
    }
  });

  const marker = new mapboxgl.Marker({
    element,
    anchor: "center",
  }).setLngLat([cluster.longitude, cluster.latitude]);

  return marker;
}
