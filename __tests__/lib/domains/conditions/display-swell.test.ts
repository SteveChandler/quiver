import fixture from "@/__tests__/fixtures/display-swell-parity.json";
import {
  formatDisplaySwellPeriod,
  resolveDisplaySwell,
} from "@/lib/domains/conditions/display-swell";

describe("formatDisplaySwellPeriod", () => {
  it.each([
    [null, null],
    [Number.NaN, null],
    [Number.POSITIVE_INFINITY, null],
    [0, null],
    [-1, null],
    [9, "9s"],
    [6.9, "6.9s"],
    [6.85, "6.9s"],
  ])("formats %p as %p", (periodSeconds, expected) => {
    expect(formatDisplaySwellPeriod(periodSeconds)).toBe(expected);
  });
});

describe("resolveDisplaySwell", () => {
  it.each(fixture.cases)("$name", ({ row, window, expected }) => {
    const result = resolveDisplaySwell(row, window);

    expect({
      ...result,
      heightFt:
        result.heightFt == null ? null : Number(result.heightFt.toFixed(3)),
    }).toEqual(expected);
  });
});
