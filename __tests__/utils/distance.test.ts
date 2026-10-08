import { formatMiles } from "@/lib/utils/distance-utils";

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
