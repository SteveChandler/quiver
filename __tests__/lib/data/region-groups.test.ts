/**
 * Tests for Region Groups Configuration
 *
 * Validates that REGION_GROUPS is consistent with FORECAST_REGIONS:
 * - Every slug in REGION_GROUPS exists in FORECAST_REGIONS
 * - No duplicate slugs across groups
 * - Every FORECAST_REGIONS slug appears in exactly one group
 */

import { REGION_GROUPS } from "@/lib/data/region-groups";
import { FORECAST_REGIONS } from "@/lib/data/forecast-regions";

describe("REGION_GROUPS", () => {
  it("every slug in REGION_GROUPS exists in FORECAST_REGIONS", () => {
    for (const group of REGION_GROUPS) {
      for (const slug of group.slugs) {
        expect(FORECAST_REGIONS).toHaveProperty(
          slug,
          expect.objectContaining({ slug })
        );
      }
    }
  });

  it("has no duplicate slugs across groups", () => {
    const allSlugs = REGION_GROUPS.flatMap((g) => g.slugs);
    const uniqueSlugs = new Set(allSlugs);
    expect(allSlugs.length).toBe(uniqueSlugs.size);
  });

  it("every FORECAST_REGIONS slug appears in exactly one group", () => {
    const groupedSlugs = new Set(REGION_GROUPS.flatMap((g) => g.slugs));
    const regionSlugs = Object.keys(FORECAST_REGIONS);

    for (const slug of regionSlugs) {
      expect(groupedSlugs).toContain(slug);
    }

    // Also verify count matches (no extras in groups)
    expect(groupedSlugs.size).toBe(regionSlugs.length);
  });

  it("has non-empty labels for all groups", () => {
    for (const group of REGION_GROUPS) {
      expect(group.label.trim()).toBeTruthy();
      expect(group.slugs.length).toBeGreaterThan(0);
    }
  });
});
