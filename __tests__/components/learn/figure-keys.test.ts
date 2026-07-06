import { FIGURE_KEYS, isFigureKey } from "@/components/learn/figures/figure-keys";
import { learnArticles } from "@/lib/data/learn-articles";

describe("figure keys", () => {
  it("declares the v1 figure keys", () => {
    expect([...FIGURE_KEYS]).toEqual(["swell-period-morph", "swell-origin-fetch"]);
  });

  it("isFigureKey narrows valid/invalid keys", () => {
    expect(isFigureKey("swell-period-morph")).toBe(true);
    expect(isFigureKey("nope")).toBe(false);
    expect(isFigureKey(undefined)).toBe(false);
  });

  it("every article section.figureKey is a registered key", () => {
    for (const article of learnArticles) {
      for (const section of article.sections) {
        if (section.figureKey !== undefined) {
          expect(isFigureKey(section.figureKey)).toBe(true);
        }
      }
    }
  });
});
