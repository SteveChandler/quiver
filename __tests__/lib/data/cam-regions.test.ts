import {
  CAM_REGIONS,
  getAllCamRegionSlugs,
  getCamRegionBySlug,
  getCamRegionPath,
} from "@/lib/data/cam-regions";

describe("cam regions", () => {
  it("uses /surf-cams as the canonical family for every region", () => {
    for (const region of CAM_REGIONS) {
      expect(getCamRegionPath(region)).toBe(`/surf-cams/${region.slug}`);
    }
  });

  it("keeps the canonical slug list aligned with the configured regions", () => {
    expect(getAllCamRegionSlugs()).toEqual(CAM_REGIONS.map((region) => region.slug));
    expect(getCamRegionBySlug("missing-region")).toBeUndefined();
  });
});
