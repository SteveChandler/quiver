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

  test("FEATURES_EXTENDED_CONTENT categories have ids and at least one feature", () => {
    const ids = FEATURES_EXTENDED_CONTENT.categories.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const category of FEATURES_EXTENDED_CONTENT.categories) {
      expect(typeof category.title).toBe("string");
      expect(category.title.length).toBeGreaterThan(0);
      expect(Array.isArray(category.features)).toBe(true);
      expect(category.features.length).toBeGreaterThan(0);

      for (const f of category.features) {
        expect(typeof f.title).toBe("string");
        expect(f.title.length).toBeGreaterThan(0);
        expect(typeof f.description).toBe("string");
        expect(f.description.length).toBeGreaterThan(0);
        expect(Array.isArray(f.benefits)).toBe(true);
        expect(f.benefits.length).toBeGreaterThan(0);
      }
    }
  });
});


