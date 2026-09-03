import { FIGURE_KEYS, isFigureKey } from "@/components/learn/figures/figure-keys";
import { learnArticles } from "@/lib/data/learn-articles";

describe("figure keys", () => {
  it("declares the v1 figure keys", () => {
    expect([...FIGURE_KEYS]).toEqual([
      "swell-period-morph",
      "swell-origin-fetch",
      "wave-height-reference",
      "tide-window",
    ]);
  });

  it("isFigureKey narrows valid/invalid keys", () => {
    expect(isFigureKey("swell-period-morph")).toBe(true);
    expect(isFigureKey("nope")).toBe(false);
    expect(isFigureKey(undefined)).toBe(false);
  });

  it("every article section.figureKey is a registered key", () => {
    const invalidFigureKeys: string[] = [];

    for (const article of learnArticles) {
      for (const section of article.sections) {
        if (section.figureKey !== undefined) {
          if (!isFigureKey(section.figureKey)) {
            invalidFigureKeys.push(`${article.slug}:${section.id}:${section.figureKey}`);
          }
        }
      }
    }

    expect(invalidFigureKeys).toEqual([]);
  });
});

it("groundswell article wires both v1 figures and a bumped dateModified", () => {
  const article = learnArticles.find((a) => a.slug === "groundswell-vs-wind-swell");

  if (!article) {
    throw new Error("Expected groundswell-vs-wind-swell article to exist");
  }

  const keys = article.sections.map((s) => s.figureKey).filter(Boolean);
  expect(keys).toEqual(expect.arrayContaining(["swell-period-morph", "swell-origin-fetch"]));
  // The figure retrofit landed 2026-07-06; later edits may bump the date again.
  expect(article.dateModified! >= "2026-07-06").toBe(true);
});

it("reuses registered figures across the swell education cluster", () => {
  const expectedFigures = [
    {
      slug: "swell-period-explained",
      figureKey: "swell-period-morph",
    },
    {
      slug: "how-swell-direction-affects-surf",
      figureKey: "swell-origin-fetch",
    },
    {
      slug: "how-swell-wraps-around-points",
      figureKey: "swell-period-morph",
    },
    {
      slug: "how-are-waves-measured",
      figureKey: "wave-height-reference",
    },
    {
      slug: "how-do-tides-work",
      figureKey: "tide-window",
    },
  ] as const;

  for (const { slug, figureKey } of expectedFigures) {
    const article = learnArticles.find((a) => a.slug === slug);

    if (!article) {
      throw new Error(`Expected ${slug} article to exist`);
    }

    expect(article.sections.map((section) => section.figureKey)).toContain(figureKey);
    // Each figure retrofit bumped dateModified; treat that date as a floor, not a pin.
    const retrofitDate =
      figureKey === "wave-height-reference" || figureKey === "tide-window"
        ? "2026-07-23"
        : "2026-07-06";
    expect(article.dateModified! >= retrofitDate).toBe(true);
  }
});
