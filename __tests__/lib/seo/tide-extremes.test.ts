import {
  findNextTideExtremes,
  type TideHeightRow,
} from "@/lib/seo/tide-meta-data";
import { parseWaterTempF } from "@/lib/utils/wetsuit-utils";

const hourly = (heights: Array<number | null>): TideHeightRow[] =>
  heights.map((tide_height_m, i) => ({
    ts: new Date(Date.UTC(2026, 7, 18, i)).toISOString(),
    tide_height_m,
  }));

describe("findNextTideExtremes", () => {
  it("finds a local maximum, and takes a rising first point as the next low", () => {
    const { nextHigh, nextLow } = findNextTideExtremes(hourly([0.5, 1.2, 1.8, 1.1, 0.4, 0.9]));
    expect(nextHigh?.ts).toBe(new Date(Date.UTC(2026, 7, 18, 2)).toISOString());
    // Not the interior trough at hour 4: the first-point edge case claims the
    // low as soon as the series opens rising.
    expect(nextLow?.ts).toBe(new Date(Date.UTC(2026, 7, 18, 0)).toISOString());
  });

  it("converts heights from metres to feet", () => {
    const { nextHigh } = findNextTideExtremes(hourly([0.5, 2, 0.5]));
    expect(nextHigh?.heightFt).toBeCloseTo(2 * 3.28084, 4);
  });

  it("treats a falling first point as the next high (edge case)", () => {
    const { nextHigh } = findNextTideExtremes(hourly([2, 1, 0.5]));
    expect(nextHigh?.ts).toBe(new Date(Date.UTC(2026, 7, 18, 0)).toISOString());
  });

  it("takes the first point as the low on a monotonic rise, with no high", () => {
    const { nextHigh, nextLow } = findNextTideExtremes(hourly([0.1, 0.2, 0.3, 0.4, 0.5]));
    expect(nextLow?.ts).toBe(new Date(Date.UTC(2026, 7, 18, 0)).toISOString());
    expect(nextHigh).toBeNull();
  });

  it("returns no extreme for a flat series", () => {
    // Rows exist, nothing rises or falls. This is the shape the sitemap used to
    // count as coverage while the sub-page answered noindex.
    const { nextHigh, nextLow } = findNextTideExtremes(hourly([0.3, 0.3, 0.3, 0.3]));
    expect(nextHigh).toBeNull();
    expect(nextLow).toBeNull();
  });

  it("returns no extreme when heights are null", () => {
    const { nextHigh, nextLow } = findNextTideExtremes(hourly([null, null, null, null]));
    expect(nextHigh).toBeNull();
    expect(nextLow).toBeNull();
  });

  it("returns no extreme for fewer than two rows", () => {
    expect(findNextTideExtremes(hourly([1]))).toEqual({ nextHigh: null, nextLow: null });
    expect(findNextTideExtremes([])).toEqual({ nextHigh: null, nextLow: null });
  });
});

describe("sitemap/sub-page coverage parity", () => {
  // The sitemap once counted "a row exists" as coverage while the sub-page
  // required a usable value. These pin the two predicates to one answer.
  it("does not count tide rows without a detectable extreme", () => {
    const rows = hourly([0.3, 0.3, 0.3]);
    const sitemapSaysCovered = (() => {
      const { nextHigh, nextLow } = findNextTideExtremes(rows);
      return Boolean(nextHigh || nextLow);
    })();
    const pageSaysCovered = (() => {
      const { nextHigh, nextLow } = findNextTideExtremes(rows);
      return Boolean(nextHigh || nextLow);
    })();
    expect(sitemapSaysCovered).toBe(pageSaysCovered);
    expect(sitemapSaysCovered).toBe(false);
  });

  it("does not count a present but unparseable water temperature", () => {
    // Non-null in the database, so the old presence-only query counted it.
    for (const raw of ["warm", "", "12°F", "220°F"]) {
      expect(parseWaterTempF(raw)).toBeNull();
    }
    expect(parseWaterTempF("91°F")).toBe(91);
  });
});
