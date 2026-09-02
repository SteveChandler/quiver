import {
  CAM_REGIONS,
  getAllCamRegionSlugs,
  getCamRegionBySlug,
  getCamRegionPath,
  getIndexableCamRegionSlugs,
} from "@/lib/data/cam-regions";

describe("cam regions", () => {
  it("routes Florida to its curated /surf-cams owner and keeps Hawaii on /cams", () => {
    // GSC (28d to 2026-08-31): /cams/hawaii earned 152 impressions at pos 15 while
    // /surf-cams/hawaii earned 1, so the directory page is the Hawaii canonical.
    expect(getCamRegionPath(getCamRegionBySlug("hawaii")!)).toBe(
      "/cams/hawaii",
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

    expect(indexable).toContain("hawaii");
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
