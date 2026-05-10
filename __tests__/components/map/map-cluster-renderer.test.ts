import {
  createClusterMapMarker,
  type ClusterRendererDeps,
} from "@/components/map/map-cluster-renderer";
import type { ClusterPoint } from "@/hooks/use-beach-clustering";

jest.mock("mapbox-gl", () => ({
  Marker: jest.fn().mockImplementation(() => ({
    setLngLat: jest.fn().mockReturnThis(),
  })),
}));

const cluster: ClusterPoint = {
  isCluster: true,
  clusterId: 12,
  pointCount: 4,
  latitude: 18.36,
  longitude: -67.26,
  beachIds: ["beach-1", "beach-2"],
  waveHeights: [0.8, 1.5],
};

function getMarkerElement(): HTMLElement {
  const Marker = require("mapbox-gl").Marker as jest.Mock;
  return Marker.mock.calls.at(-1)?.[0]?.element as HTMLElement;
}

function baseDeps(): ClusterRendererDeps {
  return {
    favoriteBeachIds: new Set(),
    clusterCleanupMap: new Map(),
    getExpansionZoom: jest.fn(() => 9),
    flyTo: jest.fn(),
  };
}

describe("createClusterMapMarker", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("opens details without zooming when configured for detail clicks", () => {
    const deps = {
      ...baseDeps(),
      clusterClickBehavior: "details",
      onClusterClick: jest.fn(),
    } satisfies ClusterRendererDeps;

    createClusterMapMarker(cluster, deps);
    getMarkerElement().dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(deps.onClusterClick).toHaveBeenCalledWith(cluster);
    expect(deps.flyTo).not.toHaveBeenCalled();
  });

  it("keeps the default click-to-expand behavior", () => {
    const deps = baseDeps();

    createClusterMapMarker(cluster, deps);
    getMarkerElement().dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(deps.getExpansionZoom).toHaveBeenCalledWith(12);
    expect(deps.flyTo).toHaveBeenCalledWith([-67.26, 18.36], 9);
  });
});
