import { SEO_CONFIG } from "@/lib/constants/seo";

describe("SEO_CONFIG structured data", () => {
  it("emits a valid SoftwareApplication AggregateRating (ratingCount must be positive)", () => {
    const app = SEO_CONFIG.structuredData.softwareApplication as any;
    expect(app["@type"]).toBe("SoftwareApplication");

    const rating = app.aggregateRating as any;
    expect(rating).toBeDefined();
    expect(rating["@type"]).toBe("AggregateRating");

    // Google validators can be strict about `ratingCount` being positive.
    expect(typeof rating.ratingCount).toBe("number");
    expect(rating.ratingCount).toBeGreaterThan(0);

    expect(typeof rating.ratingValue).toBe("number");
    expect(rating.ratingValue).toBeGreaterThan(0);
  });
});












