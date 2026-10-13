import { clamp } from "@/lib/utils/clamp";

describe("clamp", () => {
  it("bounds finite values to [lo, hi]", () => {
    expect(clamp(-5, 0, 100)).toBe(0);
    expect(clamp(42, 0, 100)).toBe(42);
    expect(clamp(250, 0, 100)).toBe(100);
  });

  it("maps NaN and infinities to lo instead of propagating them", () => {
    expect(clamp(Number.NaN, 0, 10)).toBe(0);
    expect(clamp(Number.POSITIVE_INFINITY, 0, 10)).toBe(0);
    expect(clamp(Number.NEGATIVE_INFINITY, 2, 10)).toBe(2);
  });
});
