import { formatMiles } from "@/utils/distance";

describe("formatMiles", () => {
  it("returns an em dash when value is not a finite number", () => {
    expect(formatMiles(undefined)).toBe("—");
    expect(formatMiles(NaN)).toBe("—");
    expect(formatMiles(-1)).toBe("—");
  });

  it("returns <0.1 mi for values under 0.05", () => {
    expect(formatMiles(0)).toBe("<0.1 mi");
    expect(formatMiles(0.049)).toBe("<0.1 mi");
  });

  it("formats using the provided precision", () => {
    expect(formatMiles(1.234)).toBe("1.2 mi");
    expect(formatMiles(1.234, 2)).toBe("1.23 mi");
  });
});
