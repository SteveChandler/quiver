import React from "react";
import { BeachPageStructuredData } from "@/components/seo/structured-data";
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

    expect(combined).toBeTruthy();
    expect(combined).not.toContain("AggregateRating");
    expect(combined).not.toContain("aggregateRating");
  });
});
