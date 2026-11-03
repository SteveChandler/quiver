import { median } from "@/lib/utils/median";

describe("median", () => {
  it("returns the middle value of an odd-length array", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([7])).toBe(7);
  });

  it("averages the two middle values of an even-length array", () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([-2, 2])).toBe(0);
  });

  it("sorts numerically, not lexically", () => {
    expect(median([10, 9, 100])).toBe(10);
  });

  it("does not mutate its input", () => {
    const values = [3, 1, 2];
    median(values);
    expect(values).toEqual([3, 1, 2]);
  });

  it("returns NaN for an empty array", () => {
    expect(median([])).toBeNaN();
  });
});
