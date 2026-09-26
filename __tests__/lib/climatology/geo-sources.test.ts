import { haversineKm, seawardNormalDeg } from "@/lib/climatology/geo";
import { CITY_CLIMATOLOGY_CONFIGS } from "@/lib/climatology/sources";

const config = (slug: string) => {
  const found = CITY_CLIMATOLOGY_CONFIGS.find((city) => city.citySlug === slug);
  if (!found) throw new Error(`missing ${slug}`);
  return found;
};

describe("geo helpers", () => {
  it("measures the Cape Canaveral buoy's distance to Cocoa Beach Pier", () => {
    expect(haversineKm({ lat: 28.4, lon: -80.533 }, { lat: 28.367648, lon: -80.602777 })).toBeCloseTo(7.72, 1);
  });

  it("derives shore normals from the coastline", () => {
    expect(
      seawardNormalDeg({ lat: 28.367648, lon: -80.602777 }, { lat: 28.1707, lon: -80.5913 }, "left"),
    ).toBeCloseTo(87.1, 0);
    expect(
      seawardNormalDeg({ lat: 33.655093, lon: -118.004193 }, { lat: 33.607328, lon: -117.928942 }, "right"),
    ).toBeCloseTo(217.3, 0);
  });
});

describe("CITY_CLIMATOLOGY_CONFIGS", () => {
  it("configures the three data-backed cities", () => {
    expect(CITY_CLIMATOLOGY_CONFIGS.map((city) => city.citySlug)).toEqual([
      "cocoa-beach",
      "newport-beach",
      "honolulu",
    ]);
    expect(config("cocoa-beach").shoreNormalDeg).toBe(87);
    expect(config("newport-beach").shoreNormalDeg).toBe(217);
    expect(config("honolulu").shoreNormalDeg).toBeNull();
  });

  it("gives Newport's comparison buoy the same years as its primary buoy", () => {
    const sources = config("newport-beach").sources;
    const primary = sources.find((source) => source.role === "waves");
    const comparison = sources.find((source) => source.role === "comparison-waves");
    expect(comparison?.years).toEqual(primary?.years);
  });

  it("requires a shore normal wherever a wind source is configured", () => {
    for (const city of CITY_CLIMATOLOGY_CONFIGS) {
      if (city.sources.some((source) => source.role === "wind")) {
        // eslint-disable-next-line jest/no-conditional-expect -- assertion only applies to cities with a wind source
        expect(city.shoreNormalDeg).not.toBeNull();
      }
    }
  });
});
