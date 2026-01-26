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

    // Pipeline
    expect(typeof FEATURES_EXTENDED_CONTENT.pipeline.title).toBe("string");
    expect(FEATURES_EXTENDED_CONTENT.pipeline.title.length).toBeGreaterThan(0);
    expect(Array.isArray(FEATURES_EXTENDED_CONTENT.pipeline.steps)).toBe(true);
    expect(FEATURES_EXTENDED_CONTENT.pipeline.steps.length).toBe(4);
    for (const step of FEATURES_EXTENDED_CONTENT.pipeline.steps) {
      expect(typeof step.id).toBe("string");
      expect(typeof step.title).toBe("string");
      expect(step.title.length).toBeGreaterThan(0);
      expect(typeof step.description).toBe("string");
      expect(step.description.length).toBeGreaterThan(0);
    }

    // Personalization
    expect(Array.isArray(FEATURES_EXTENDED_CONTENT.personalization.features)).toBe(true);
    expect(FEATURES_EXTENDED_CONTENT.personalization.features.length).toBeGreaterThan(0);
    for (const f of FEATURES_EXTENDED_CONTENT.personalization.features) {
      expect(typeof f.title).toBe("string");
      expect(f.title.length).toBeGreaterThan(0);
      expect(typeof f.description).toBe("string");
      expect(f.description.length).toBeGreaterThan(0);
    }

    // Intelligence
    expect(Array.isArray(FEATURES_EXTENDED_CONTENT.intelligence.cards)).toBe(true);
    expect(FEATURES_EXTENDED_CONTENT.intelligence.cards.length).toBeGreaterThan(0);

    // CTA
    expect(typeof FEATURES_EXTENDED_CONTENT.cta.title).toBe("string");
    expect(FEATURES_EXTENDED_CONTENT.cta.title.length).toBeGreaterThan(0);
    expect(typeof FEATURES_EXTENDED_CONTENT.cta.primaryCta.text).toBe("string");
    expect(typeof FEATURES_EXTENDED_CONTENT.cta.primaryCta.href).toBe("string");
  });
});


