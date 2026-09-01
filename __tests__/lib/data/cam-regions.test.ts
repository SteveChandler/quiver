import {
  CAM_REGIONS,
  getAllCamRegionSlugs,
  getCamRegionBySlug,
  getCamRegionPath,
  getIndexableCamRegionSlugs,
} from "@/lib/data/cam-regions";

describe("cam regions", () => {
  it("routes Hawaii and Florida to their curated /surf-cams owners", () => {
    expect(getCamRegionPath(getCamRegionBySlug("hawaii")!)).toBe(
      "/surf-cams/hawaii",
    );
    expect(getCamRegionPath(getCamRegionBySlug("florida")!)).toBe(
      "/surf-cams/florida",
    );
    expect(getCamRegionPath(getCamRegionBySlug("southern-california")!)).toBe(
      "/cams/southern-california",
    );
  });

  it("excludes redirecting regions from the indexable slug list", () => {
    const indexable = getIndexableCamRegionSlugs();

    expect(indexable).not.toContain("hawaii");
    expect(indexable).not.toContain("florida");
    expect(indexable).toContain("southern-california");
    expect(indexable.length).toBe(
      getAllCamRegionSlugs().length -
        CAM_REGIONS.filter((region) => region.canonicalPath).length,
    );
  });

  it("only points canonical paths at curated surf-cams pages", () => {
    for (const region of CAM_REGIONS) {
      if (!region.canonicalPath) continue;
      expect(region.canonicalPath).toMatch(/^\/surf-cams\/[a-z-]+$/);
    }
  });
});
