import { formatTideAxisValue, tideYTicks } from "@/lib/utils/tide-axis";

describe("tideYTicks", () => {
  it("puts ticks on whole feet when half feet would be too many", () => {
    expect(tideYTicks([-0.5, 2.5])).toEqual([0, 1, 2]);
  });

  it("uses half-foot ticks on a small range", () => {
    expect(tideYTicks([-1, 1])).toEqual([-1, -0.5, 0, 0.5, 1]);
  });

  it("widens the step on a big range", () => {
    expect(tideYTicks([-0.5, 7])).toEqual([0, 2, 4, 6]);
  });

  it("never returns negative zero", () => {
    expect(tideYTicks([-0.4, 0.4]).some((v) => Object.is(v, -0))).toBe(false);
  });

  it("returns nothing for an invalid domain", () => {
    expect(tideYTicks([2, 1])).toEqual([]);
    expect(tideYTicks([Number.NaN, 1])).toEqual([]);
  });
});

describe("formatTideAxisValue", () => {
  it("labels the real value of the line", () => {
    expect(formatTideAxisValue(0.5)).toBe("0.5");
    expect(formatTideAxisValue(2)).toBe("2");
    expect(formatTideAxisValue(-1.5)).toBe("-1.5");
  });

  it("never prints -0", () => {
    expect(formatTideAxisValue(-0)).toBe("0");
    expect(formatTideAxisValue(-0.04)).toBe("0");
  });
});
