import { SEO_CONFIG } from "@/lib/constants/seo";

describe("SEO_CONFIG structured data", () => {
  it("SoftwareApplication does not include fabricated aggregateRating", () => {
    const app = SEO_CONFIG.structuredData.softwareApplication as any;
    expect(app["@type"]).toBe("SoftwareApplication");
    expect(app.aggregateRating).toBeUndefined();
  });
});
