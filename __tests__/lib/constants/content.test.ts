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
    expect(typeof ABOUT_CONTENT.hero.title).toBe("string");
    expect(ABOUT_CONTENT.hero.title.length).toBeGreaterThan(0);
    expect(typeof ABOUT_CONTENT.hero.subtitle).toBe("string");
    expect(ABOUT_CONTENT.hero.subtitle.length).toBeGreaterThan(0);
    expect(typeof ABOUT_CONTENT.hero.description).toBe("string");
    expect(ABOUT_CONTENT.hero.description.length).toBeGreaterThan(0);

    expect(Array.isArray(ABOUT_CONTENT.mission.values)).toBe(true);
    expect(ABOUT_CONTENT.mission.values.length).toBeGreaterThan(0);
    for (const v of ABOUT_CONTENT.mission.values) {
      expect(typeof v.title).toBe("string");
      expect(v.title.length).toBeGreaterThan(0);
      expect(typeof v.description).toBe("string");
      expect(v.description.length).toBeGreaterThan(0);
      // Icon should be a component reference (lucide-react exports can be function or forwardRef object)
      expect(v.icon).toBeTruthy();
      expect(["function", "object"]).toContain(typeof v.icon);
    }
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

  test("FEATURES_EXTENDED_CONTENT has required sections with non-empty content", () => {
    // Hero
    expect(typeof FEATURES_EXTENDED_CONTENT.hero.title).toBe("string");
    expect(FEATURES_EXTENDED_CONTENT.hero.title.length).toBeGreaterThan(0);
    expect(typeof FEATURES_EXTENDED_CONTENT.hero.subtitle).toBe("string");
    expect(FEATURES_EXTENDED_CONTENT.hero.subtitle.length).toBeGreaterThan(0);
    expect(Array.isArray(FEATURES_EXTENDED_CONTENT.hero.stats)).toBe(true);
    expect(FEATURES_EXTENDED_CONTENT.hero.stats.length).toBeGreaterThan(0);

    // Benefits
    expect(Array.isArray(FEATURES_EXTENDED_CONTENT.benefits.cards)).toBe(true);
    expect(FEATURES_EXTENDED_CONTENT.benefits.cards.length).toBe(4);
    for (const card of FEATURES_EXTENDED_CONTENT.benefits.cards) {
      expect(typeof card.id).toBe("string");
      expect(typeof card.title).toBe("string");
      expect(card.title.length).toBeGreaterThan(0);
      expect(typeof card.description).toBe("string");
      expect(card.description.length).toBeGreaterThan(0);
    }

    // Deep Dive
    expect(typeof FEATURES_EXTENDED_CONTENT.deepDive.heading).toBe("string");
    expect(FEATURES_EXTENDED_CONTENT.deepDive.heading.length).toBeGreaterThan(0);
    expect(Array.isArray(FEATURES_EXTENDED_CONTENT.deepDive.items)).toBe(true);
    expect(FEATURES_EXTENDED_CONTENT.deepDive.items.length).toBe(4);
    for (const item of FEATURES_EXTENDED_CONTENT.deepDive.items) {
      expect(typeof item.id).toBe("string");
      expect(typeof item.title).toBe("string");
      expect(item.title.length).toBeGreaterThan(0);
      expect(typeof item.content).toBe("string");
      expect(item.content.length).toBeGreaterThan(0);
    }

    // CTA
    expect(typeof FEATURES_EXTENDED_CONTENT.cta.title).toBe("string");
    expect(FEATURES_EXTENDED_CONTENT.cta.title.length).toBeGreaterThan(0);
    expect(typeof FEATURES_EXTENDED_CONTENT.cta.primaryCta.text).toBe("string");
    expect(typeof FEATURES_EXTENDED_CONTENT.cta.primaryCta.href).toBe("string");
  });
});


