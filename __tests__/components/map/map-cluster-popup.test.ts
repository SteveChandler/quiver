import {
  createClusterPopupContent,
  getClusterPopupBeaches,
} from "@/components/map/map-cluster-popup";
import type { Beach } from "@/types/database";
import type { ClusterPoint } from "@/hooks/use-beach-clustering";

const beaches = [
  {
    id: "beach-1",
    name: "Domes",
    slug: "domes",
    city: "Rincón",
    state: "PR",
    country: "USA",
    skill_level: "beginner",
    description: "Mellow inside shoulders with easy access near the point.",
    lat: 18.36,
    lon: -67.27,
    real_takeaways: null,
  },
  {
    id: "beach-2",
    name: "Sandy Beach",
    slug: "sandy-beach",
    city: "Rincón",
    state: "PR",
    country: "USA",
    skill_level: "beginner",
    description: "Beach break with forgiving corners when the swell stays small.",
    lat: 18.37,
    lon: -67.25,
    real_takeaways: null,
  },
] as Beach[];

const cluster: ClusterPoint = {
  isCluster: true,
  clusterId: 1,
  pointCount: 2,
  latitude: 18.36,
  longitude: -67.26,
  beachIds: ["beach-1", "beach-2"],
  waveHeights: [1.1, 1.7],
};

describe("map cluster popup", () => {
  it("returns beaches that belong to the cluster", () => {
    expect(getClusterPopupBeaches(cluster, beaches).map((beach) => beach.name)).toEqual([
      "Domes",
      "Sandy Beach",
    ]);
  });

  it("renders beach names and supporting details", () => {
    const content = createClusterPopupContent({
      cluster,
      beaches,
      waveHeightMap: new Map([
        ["beach-1", 2.0],
        ["beach-2", 1.7],
      ]),
    });

    expect(content.textContent).toContain("2 beginner spots nearby");
    expect(content.textContent).toContain("Domes");
    expect(content.textContent).toContain("Sandy Beach");
    expect(content.textContent).toContain("2ft");
    expect(content.textContent).toContain("1-2ft");
    expect(content.textContent).toContain("Rincón");
    expect(content.textContent).toContain("beginner option around Rincón");
  });

  it("limits long groups and notes the hidden count", () => {
    const content = createClusterPopupContent({
      cluster: { ...cluster, pointCount: 2 },
      beaches,
      waveHeightMap: new Map(),
      maxVisibleBeaches: 1,
    });

    expect(content.textContent).toContain("Domes");
    expect(content.textContent).not.toContain("Sandy Beach");
    expect(content.textContent).toContain("1 more spot in this group");
  });

  it("preserves omission of missing water temperatures", () => {
    const content = createClusterPopupContent({
      cluster,
      beaches,
      displayMode: "water-temp",
      waterTempMap: new Map([["beach-1", undefined], ["beach-2", "64°F"]]),
      waveHeightMap: new Map(),
    });

    expect(content.textContent).not.toContain("—");
    expect(content.textContent).toContain("64°F");
  });
});
