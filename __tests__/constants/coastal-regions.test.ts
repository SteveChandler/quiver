import { COASTAL_REGIONS } from "@/lib/constants/coastal-regions";


describe("COASTAL_REGIONS", () => {
  it("has water temp averages for each region", () => {
    for (const region of Object.values(COASTAL_REGIONS)) {
      expect(region.waterTempAvgByMonth).toHaveLength(12);
      expect(region.waterTempAvgByMonth.every((t) => t >= 38 && t <= 86)).toBe(true);
    }
  });
});
