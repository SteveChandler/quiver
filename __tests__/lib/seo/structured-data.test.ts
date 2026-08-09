import { createElement } from "react";
import { render } from "@testing-library/react";

import { BeachPageStructuredData } from "@/components/seo/structured-data";
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
    expect(graphTypes).not.toContain("SoftwareApplication");

    // Ensure the root holds the context (cleaner + more compatible).
    expect((graph[0] as any)["@context"]).toBeUndefined();
  });
});

describe("SEO_CONFIG structured data", () => {
  it("Organization sameAs contains only known official social profiles", () => {
    const org = SEO_CONFIG.structuredData.organization as any;
    expect(org["@type"]).toBe("Organization");
    expect(Array.isArray(org.sameAs)).toBe(true);
    expect(org.sameAs).toContain("https://bsky.app/profile/quiversurf.app");
    expect(org.sameAs).toContain("https://x.com/quiversurf");
  });

  it("keeps app-only properties off Organization schema", () => {
    const org = SEO_CONFIG.structuredData.organization as any;

    expect(org.applicationCategory).toBeUndefined();
    expect(org.operatingSystem).toBeUndefined();
  });

  it("WebSite includes SearchAction for sitelinks search box", () => {
    const website = SEO_CONFIG.structuredData.website as any;
    expect(website["@type"]).toBe("WebSite");
    expect(website.potentialAction).toMatchObject({
      "@type": "SearchAction",
    });
  });
});

describe("BeachPageStructuredData", () => {
  it("emits a Place without triggering LocalBusiness rich-result validation", () => {
    const { container } = render(
      createElement(BeachPageStructuredData, {
        beachName: "Banyans",
        description:
          "Surf conditions, tides, wind, swell and community intel for Banyans.",
        latitude: 19.604,
        longitude: -155.981,
        city: "Kailua-Kona",
        state: "HI",
        country: "US",
        amenities: { has_parking: true },
      }),
    );

    const scripts = [...container.querySelectorAll('script[type="application/ld+json"]')]
      .map((script) => JSON.parse(script.textContent ?? "{}"));
    const place = scripts.find((schema) => schema["@type"] === "Place");
    expect(scripts).toHaveLength(1);
    expect(place).toMatchObject({
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Kailua-Kona",
        addressRegion: "HI",
        addressCountry: "US",
      },
      amenityFeature: [
        {
          "@type": "LocationFeatureSpecification",
          name: "Parking",
          value: true,
        },
      ],
    });
    expect(JSON.stringify(scripts)).not.toContain("SportsActivityLocation");
    expect(JSON.stringify(scripts)).not.toContain('"sport"');
  });
});
