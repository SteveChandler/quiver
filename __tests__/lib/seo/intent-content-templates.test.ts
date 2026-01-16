// __tests__/lib/seo/intent-content-templates.test.ts
import { buildIntentPageContent } from "@/lib/seo/intent-content-templates";
import type { CityMetadata } from "@/actions/city/city-metadata-actions";

const mockMetadata: CityMetadata = {
  cityName: "Santa Cruz",
  state: "CA",
  stateName: "California",
  totalBeaches: 5,
  beginnerCount: 1,
  intermediateCount: 3,
  advancedCount: 1,
  beaches: [
    { name: "Steamer Lane", slug: "steamer-lane", skillLevel: "advanced" },
    { name: "Pleasure Point", slug: "pleasure-point", skillLevel: "intermediate" },
    { name: "38th Avenue", slug: "38th-avenue", skillLevel: "lower-intermediate" },
  ],
  centerLat: 36.95,
  centerLon: -122.02,
};

describe("buildIntentPageContent", () => {
  it("generates beginner page content", () => {
    const content = buildIntentPageContent("beginner", mockMetadata);

    expect(content.title).toContain("Santa Cruz");
    expect(content.title).toContain("Beginner");
    expect(content.heading).toContain("Santa Cruz");
    expect(content.intro).toBeTruthy();
    expect(content.metaDescription).toContain("Santa Cruz");
    expect(content.metaDescription.length).toBeLessThanOrEqual(160);
  });

  it("generates least-crowded page content", () => {
    const content = buildIntentPageContent("least-crowded", mockMetadata);

    expect(content.title).toContain("Crowded");
    expect(content.heading.toLowerCase()).toContain("crowded");
  });

  it("includes beach names in content", () => {
    const content = buildIntentPageContent("beginner", mockMetadata);

    expect(content.intro).toMatch(/Steamer Lane|Pleasure Point|38th Avenue/);
  });

  it("handles city with no beginner spots gracefully", () => {
    const noBeginnerMetadata: CityMetadata = {
      ...mockMetadata,
      beginnerCount: 0,
    };
    const content = buildIntentPageContent("beginner", noBeginnerMetadata);

    expect(content.intro).toBeTruthy();
    // Should mention alternatives or acknowledge challenge
    expect(content.intro.toLowerCase()).toMatch(/challenging|advanced|experienced/);
  });

  describe("all 7 intent types", () => {
    const intents = [
      "beginner",
      "least-crowded",
      "tide",
      "water-temp",
      "longboard",
      "dawn-patrol",
      "sunset",
    ] as const;

    intents.forEach((intent) => {
      it(`generates valid content for ${intent} intent`, () => {
        const content = buildIntentPageContent(intent, mockMetadata);

        expect(content.title).toBeTruthy();
        expect(content.heading).toBeTruthy();
        expect(content.intro).toBeTruthy();
        expect(content.metaDescription).toBeTruthy();
        expect(content.metaDescription.length).toBeLessThanOrEqual(160);
      });
    });
  });

  describe("tide intent", () => {
    it("generates tide-specific content", () => {
      const content = buildIntentPageContent("tide", mockMetadata);

      expect(content.title.toLowerCase()).toMatch(/tide|tides/);
      expect(content.heading.toLowerCase()).toMatch(/tide|tides/);
    });
  });

  describe("water-temp intent", () => {
    it("generates water temperature content", () => {
      const content = buildIntentPageContent("water-temp", mockMetadata);

      expect(content.title.toLowerCase()).toMatch(/water|temperature|temp/);
    });
  });

  describe("longboard intent", () => {
    it("generates longboard-specific content", () => {
      const content = buildIntentPageContent("longboard", mockMetadata);

      expect(content.title.toLowerCase()).toContain("longboard");
    });
  });

  describe("dawn-patrol intent", () => {
    it("generates dawn patrol content", () => {
      const content = buildIntentPageContent("dawn-patrol", mockMetadata);

      expect(content.title.toLowerCase()).toMatch(/dawn|morning|sunrise/);
    });
  });

  describe("sunset intent", () => {
    it("generates sunset session content", () => {
      const content = buildIntentPageContent("sunset", mockMetadata);

      expect(content.title.toLowerCase()).toMatch(/sunset|evening/);
    });
  });
});
