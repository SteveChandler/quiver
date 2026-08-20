/**
 * @jest-environment node
 */

import {
  ABOUT_CONTENT,
  FEATURES_EXTENDED_CONTENT,
  PRIVACY_CONTENT,
} from "@/lib/constants/content";

describe("lib/constants/content invariants", () => {
  test("ABOUT_CONTENT has required structure and non-empty strings", () => {
    // Hero
    expect(ABOUT_CONTENT.hero.title).toBe(
      "I built Quiver because I was tired of forecasts being wrong.",
    );
    expect(typeof ABOUT_CONTENT.hero.subtitle).toBe("string");
    expect(ABOUT_CONTENT.hero.subtitle.length).toBeGreaterThan(0);

    // Problem
    expect(Array.isArray(ABOUT_CONTENT.problem)).toBe(true);
    expect(ABOUT_CONTENT.problem).toHaveLength(2);
    for (const p of ABOUT_CONTENT.problem) {
      expect(typeof p).toBe("string");
      expect(p.length).toBeGreaterThan(0);
    }

    // Solution
    expect(typeof ABOUT_CONTENT.solution.intro).toBe("string");
    expect(ABOUT_CONTENT.solution.intro.length).toBeGreaterThan(0);
    expect(typeof ABOUT_CONTENT.solution.closer).toBe("string");
    expect(ABOUT_CONTENT.solution.closer.length).toBeGreaterThan(0);
    expect(Array.isArray(ABOUT_CONTENT.solution.stats)).toBe(true);
    expect(ABOUT_CONTENT.solution.stats).toHaveLength(4);
    for (const stat of ABOUT_CONTENT.solution.stats) {
      expect(typeof stat.value).toBe("string");
      expect(stat.value.length).toBeGreaterThan(0);
      expect(typeof stat.label).toBe("string");
      expect(stat.label.length).toBeGreaterThan(0);
    }

    // What's Next
    expect(Array.isArray(ABOUT_CONTENT.whatsNext)).toBe(true);
    expect(ABOUT_CONTENT.whatsNext).toHaveLength(3);
    for (const p of ABOUT_CONTENT.whatsNext) {
      expect(typeof p).toBe("string");
      expect(p.length).toBeGreaterThan(0);
    }

    // CTA
    expect(typeof ABOUT_CONTENT.cta.title).toBe("string");
    expect(ABOUT_CONTENT.cta.title.length).toBeGreaterThan(0);
    expect(typeof ABOUT_CONTENT.cta.subtitle).toBe("string");
    expect(typeof ABOUT_CONTENT.cta.primaryLabel).toBe("string");
    expect(typeof ABOUT_CONTENT.cta.primaryHref).toBe("string");
    expect(typeof ABOUT_CONTENT.cta.secondaryLabel).toBe("string");
    expect(typeof ABOUT_CONTENT.cta.secondaryHref).toBe("string");
    expect(ABOUT_CONTENT.cta.secondaryHref).toMatch(/^\//);
    expect(typeof ABOUT_CONTENT.cta.tertiaryLabel).toBe("string");
    expect(typeof ABOUT_CONTENT.cta.tertiaryHref).toBe("string");
    expect(ABOUT_CONTENT.cta.tertiaryHref).toMatch(/^mailto:/);
  });

  test("PRIVACY_CONTENT sections have unique ids and basic contact sanity", () => {
    const ids = PRIVACY_CONTENT.sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);

    expect(typeof PRIVACY_CONTENT.hero.lastUpdated).toBe("string");
    expect(PRIVACY_CONTENT.hero.lastUpdated.length).toBeGreaterThan(0);

    const contact = PRIVACY_CONTENT.contact.methods;
    expect(Array.isArray(contact)).toBe(true);
    expect(contact.length).toBeGreaterThan(0);

    const website = contact.find((m) => m.type.toLowerCase() === "website")?.value;
    expect(typeof website).toBe("string");
    expect(website).toMatch(/^https?:\/\//);

    const email = contact.find((m) => m.type.toLowerCase() === "email")?.value;
    expect(typeof email).toBe("string");
    expect(email).toMatch(/@/);
  });

  test("FEATURES_EXTENDED_CONTENT has required hero with non-empty content", () => {
    expect(typeof FEATURES_EXTENDED_CONTENT.hero.title).toBe("string");
    expect(FEATURES_EXTENDED_CONTENT.hero.title.length).toBeGreaterThan(0);
    expect(typeof FEATURES_EXTENDED_CONTENT.hero.subtitle).toBe("string");
    expect(FEATURES_EXTENDED_CONTENT.hero.subtitle.length).toBeGreaterThan(0);
  });
});

