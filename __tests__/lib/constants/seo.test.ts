import { SEO_CONFIG } from "@/lib/constants/seo";

describe("SEO_CONFIG structured data", () => {
  it("Organization does not include fabricated sameAs links", () => {
    const org = SEO_CONFIG.structuredData.organization as any;
    expect(org["@type"]).toBe("Organization");
    expect(org.sameAs).toBeUndefined();
  });

  it("WebSite includes SearchAction for sitelinks search box", () => {
    const website = SEO_CONFIG.structuredData.website as any;
    expect(website["@type"]).toBe("WebSite");
    expect(website.potentialAction).toBeDefined();
    expect(website.potentialAction["@type"]).toBe("SearchAction");
  });
});
