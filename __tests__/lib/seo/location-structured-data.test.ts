import { buildLocationPlaceStructuredData } from "@/lib/seo/location-structured-data";

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

