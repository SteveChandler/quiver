import React from "react";
import { BeachPageStructuredData } from "@/components/seo/structured-data";
import { HomePageStructuredData as LegacyHomePageStructuredData } from "@/components/seo/home-page-structured-data";
import { renderWithAppRouter } from "@/test-utils/test-utils";

describe("SEO Structured Data components", () => {
  it("BeachPageStructuredData does not emit AggregateRating even when rating props provided", () => {
    const { container } = renderWithAppRouter(
      <BeachPageStructuredData
        beachName="Test Beach"
        description="A great surf spot"
        latitude={32.7}
        longitude={-117.2}
        rating={4.9}
        reviewCount={120}
        city="San Diego"
        state="CA"
        country="US"
      />
    );

    const jsonLdScripts = container.querySelectorAll(
      'script[type="application/ld+json"]'
    );
    const combined = Array.from(jsonLdScripts)
      .map((n) => n.textContent || "")
      .join("\n");

    // AggregateRating is intentionally omitted — Place is not an eligible type
    // for Google review snippets, and self-served reviews are blocked even for
    // LocalBusiness subtypes. See structured-data.tsx comment for details.
    expect(combined.length).toBeGreaterThan(0);
    expect(combined).not.toContain("AggregateRating");
    expect(combined).not.toContain("aggregateRating");
  });

  it("legacy HomePageStructuredData emits an @graph object instead of a top-level JSON-LD array", () => {
    const { container } = renderWithAppRouter(<LegacyHomePageStructuredData />);

    const script = container.querySelector('script[type="application/ld+json"]');
    const schema = JSON.parse(script?.textContent || "null");

    expect(Array.isArray(schema)).toBe(false);
    expect(schema["@context"]).toBe("https://schema.org");
    expect(Array.isArray(schema["@graph"])).toBe(true);
  });
});
