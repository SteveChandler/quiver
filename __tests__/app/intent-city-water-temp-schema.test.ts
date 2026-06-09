import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("city water-temp structured data integration", () => {
  it("renders Dataset JSON-LD from the dedicated city water-temp branch", () => {
    const source = readFileSync(
      join(process.cwd(), "app/[intent]/[city]/page.tsx"),
      "utf8"
    );
    const branchStart = source.lastIndexOf('if (params.intent === "water-temp")');

    const waterTempBranch = source.slice(
      branchStart,
      source.indexOf('// Dawn-patrol intent')
    );

    expect(branchStart).toBeGreaterThan(-1);
    expect(waterTempBranch).toContain("WaterTempDatasetSchema");
    expect(waterTempBranch).toContain("cityMetadata.centerLat");
    expect(waterTempBranch).toContain("cityMetadata.centerLon");
    expect(waterTempBranch).toContain("expandedWaterTempData.currentTemp");
    expect(waterTempBranch).toContain(
      "expandedWaterTempData.wetsuitRecommendation.thickness"
    );
  });
});
