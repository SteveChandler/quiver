import { buildLocationPlaceStructuredData } from "@/lib/seo/location-structured-data";
import { buildRootStructuredDataGraph } from "@/lib/seo/root-structured-data";
import { SEO_CONFIG } from "@/lib/constants/seo";

describe("Location structured data", () => {
  it("does not emit AggregateRating for city/place pages", () => {
    const jsonLd = buildLocationPlaceStructuredData({
      city: "Luquillo",
      state: "PR",
      topBeaches: [
        { name: "La Pared", url: "https://www.quiversurf.app/beach/la-pared" },
      ],
    });

    expect(JSON.stringify(jsonLd)).not.toContain("AggregateRating");
    expect(JSON.stringify(jsonLd)).not.toContain("aggregateRating");
  });
});

describe("buildRootStructuredDataGraph", () => {
  it("returns an object with @context and @graph (not a top-level array)", () => {
    const jsonLd = buildRootStructuredDataGraph();

    expect(Array.isArray(jsonLd)).toBe(false);
    expect(jsonLd["@context"]).toBe("https://schema.org");
    expect(Array.isArray(jsonLd["@graph"])).toBe(true);

    const graph = jsonLd["@graph"];
    expect(graph.length).toBeGreaterThanOrEqual(2);

    const graphTypes = graph.map((node) => (node as any)["@type"]);
    expect(graphTypes).toContain("Organization");
    expect(graphTypes).toContain("WebSite");

    // Ensure the root holds the context (cleaner + more compatible).
    expect((graph[0] as any)["@context"]).toBeUndefined();
  });
});

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
