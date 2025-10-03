import { formatMiles, milesBetween } from "@/utils/distance";

describe("formatMiles", () => {
  it("returns an em dash when value is not a finite number", () => {
    expect(formatMiles(undefined)).toBe("—");
    expect(formatMiles(NaN)).toBe("—");
    expect(formatMiles(-1)).toBe("—");
  });

  it("returns special labels for nearby distances", () => {
    expect(formatMiles(0)).toBe("0.0 miles away");
    expect(formatMiles(0.049)).toBe("<0.1 miles away");
  });

  it("formats using the provided precision", () => {
    expect(formatMiles(1.234)).toBe("1.2 miles away");
    expect(formatMiles(1.234, 2)).toBe("1.23 miles away");
  });
});

describe("milesBetween", () => {
  it("returns null when coordinates are missing", () => {
    expect(milesBetween()).toBeNull();
    expect(milesBetween({ lat: 32.7, lon: -117.2 }, null)).toBeNull();
    expect(milesBetween({ lat: Number.NaN, lon: -117.2 }, { lat: 32.7, lon: -117.1 })).toBeNull();
  });

  it("computes the haversine distance between two points", () => {
    const sanDiego = { lat: 32.715736, lon: -117.161087 };
    const losAngeles = { lat: 34.052235, lon: -118.243683 };

    const miles = milesBetween(sanDiego, losAngeles);

    expect(miles).not.toBeNull();
    expect(miles!).toBeCloseTo(111.48, 2);
  });

  it("is zero when coordinates match exactly", () => {
    const point = { lat: 32.715736, lon: -117.161087 };
    expect(milesBetween(point, point)).toBe(0);
  });
});
