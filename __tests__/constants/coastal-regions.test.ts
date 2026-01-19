import {
  detectCoastalRegion,
  COASTAL_REGIONS,
  getSeasonalTempContext,
} from "@/lib/constants/coastal-regions";

describe("detectCoastalRegion", () => {
  it("detects SoCal from San Diego coordinates", () => {
    const region = detectCoastalRegion(32.75, -117.25);
    expect(region?.id).toBe("socal");
    expect(region?.coastFaces).toContain("SW");
  });

  it("detects Central California from Santa Cruz coordinates", () => {
    const region = detectCoastalRegion(36.95, -122.03);
    expect(region?.id).toBe("central-ca");
  });

  it("detects East Coast FL from Miami coordinates", () => {
    const region = detectCoastalRegion(25.76, -80.19);
    expect(region?.id).toBe("east-fl");
    expect(region?.coastFaces).toContain("E");
  });

  it("detects Hawaii from Oahu coordinates", () => {
    const region = detectCoastalRegion(21.27, -157.82);
    expect(region?.id).toBe("hawaii");
  });

  it("returns null for inland coordinates", () => {
    const region = detectCoastalRegion(39.74, -104.99); // Denver
    expect(region).toBeNull();
  });

  it("returns null for international coordinates", () => {
    const region = detectCoastalRegion(51.5, -0.12); // London
    expect(region).toBeNull();
  });
});

describe("COASTAL_REGIONS", () => {
  it("has water temp averages for each region", () => {
    for (const region of Object.values(COASTAL_REGIONS)) {
      expect(region.waterTempAvgByMonth).toHaveLength(12);
      expect(region.waterTempAvgByMonth.every((t) => t >= 38 && t <= 86)).toBe(true);
    }
  });
});

describe("getSeasonalTempContext", () => {
  it("returns 'warm for [month]' when temp is 5+ degrees above average", () => {
    const socal = COASTAL_REGIONS.socal;
    const result = getSeasonalTempContext(75, socal, 0); // Jan avg is 58
    expect(result).toBe("warm for January");
  });

  it("returns 'cool for [month]' when temp is 5+ degrees below average", () => {
    const socal = COASTAL_REGIONS.socal;
    const result = getSeasonalTempContext(53, socal, 0); // Jan avg is 58
    expect(result).toBe("cool for January");
  });

  it("returns null when temp is within typical range", () => {
    const socal = COASTAL_REGIONS.socal;
    const result = getSeasonalTempContext(60, socal, 0); // Within +/- 5 of 58
    expect(result).toBeNull();
  });
});
