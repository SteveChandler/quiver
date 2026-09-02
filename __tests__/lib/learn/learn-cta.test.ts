import { learnArticles } from "@/lib/data/learn-articles";
import { resolveLearnAppHandoff, resolveLearnNextPaddleLink } from "@/lib/learn/learn-cta";

describe("learn next-paddle link", () => {
  it("uses the article's own first non-learn link", () => {
    expect(resolveLearnNextPaddleLink({
      relatedLinks: [
        { label: "Swell period", href: "/learn/swell-period-explained", description: "" },
        { label: "Santa Cruz beginner surf", href: "/beginner/santa-cruz", description: "" },
        { label: "Forecast", href: "/forecast", description: "" },
      ],
    })).toEqual({ href: "/beginner/santa-cruz", label: "Santa Cruz beginner surf" });
  });

  it("falls back to regional forecasts when every link is another guide", () => {
    expect(resolveLearnNextPaddleLink({
      relatedLinks: [{ label: "Tides", href: "/learn/how-do-tides-work", description: "" }],
    })).toEqual({ href: "/forecast", label: "Live regional forecasts" });
  });

  it("no longer sends every article to Santa Cruz", () => {
    const santaCruz = learnArticles.filter(
      (article) => resolveLearnNextPaddleLink(article).href === "/forecast/santa-cruz",
    );
    expect(santaCruz).toEqual([]);
  });
});

describe("learn app handoff copy", () => {
  it("attributes source and target to the article", () => {
    const resolved = resolveLearnAppHandoff({ slug: "is-it-safe-to-surf-after-rain", appHandoff: undefined });
    expect(resolved.source).toBe("content-learn-is-it-safe-to-surf-after-rain");
    expect(resolved.target).toBe("learn:is-it-safe-to-surf-after-rain");
    expect(resolved.ctaLabel).toBe("Check my beach in the app");
  });

  it("prefers article-specific copy when present", () => {
    const article = learnArticles.find(({ slug }) => slug === "beginner-breaks-santa-cruz");
    const resolved = resolveLearnAppHandoff(article!);
    expect(resolved.title).toBe("Check these spots before you go.");
    expect(resolved.ctaLabel).toBe("Open Santa Cruz in the app");
  });

  it("gives every article complete handoff copy that does not claim an ML forecast", () => {
    for (const article of learnArticles) {
      const resolved = resolveLearnAppHandoff(article);
      for (const field of [resolved.eyebrow, resolved.title, resolved.description, resolved.ctaLabel]) {
        expect(field.trim().length).toBeGreaterThan(0);
        expect(field.toLowerCase()).not.toMatch(/machine learning|\bai\b/);
        // Positioning: never "the call". See feedback memory 2026-08-23.
        expect(field.toLowerCase()).not.toMatch(/\bthe call\b/);
      }
    }
  });
});
