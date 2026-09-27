import { findNextInteriorTideExtremes, type TideHeightRow } from "@/lib/seo/tide-meta-data";

const rows = (heights: Array<number | null>): TideHeightRow[] =>
  heights.map((tide_height_m, hour) => ({ ts: new Date(Date.UTC(2026, 8, 27, hour)).toISOString(), tide_height_m }));

describe("findNextInteriorTideExtremes", () => {
  it("ignores a falling first point and finds the next interior high and low", () => {
    const result = findNextInteriorTideExtremes(rows([2, 1, 0.5, 1, 2, 1]));
    expect(result.nextLow?.ts).toBe(rows([0, 0, 0])[2].ts);
    expect(result.nextHigh?.ts).toBe(rows([0, 0, 0, 0, 0])[4].ts);
    expect(result.nextHigh?.heightFt).toBeCloseTo(2 * 3.28084, 4);
    expect(findNextInteriorTideExtremes(rows([2, 1, 0.5])).nextHigh).toBeNull();
  });

  it("ignores a rising first point as a low", () => {
    const result = findNextInteriorTideExtremes(rows([0.5, 1, 2, 1, 0.4, 1]));
    expect(result.nextHigh?.ts).toBe(rows([0, 0, 0])[2].ts);
    expect(result.nextLow?.ts).toBe(rows([0, 0, 0, 0, 0])[4].ts);
    expect(findNextInteriorTideExtremes(rows([0.5, 1, 2])).nextLow).toBeNull();
  });

  it("returns nothing for flat or monotonic series", () => {
    expect(findNextInteriorTideExtremes(rows([1, 1, 1, 1]))).toEqual({ nextHigh: null, nextLow: null });
    expect(findNextInteriorTideExtremes(rows([1, 2, 3]))).toEqual({ nextHigh: null, nextLow: null });
  });

  it("does not bridge null heights", () => {
    expect(findNextInteriorTideExtremes(rows([2, null, 1, null, 2]))).toEqual({ nextHigh: null, nextLow: null });
  });
});
