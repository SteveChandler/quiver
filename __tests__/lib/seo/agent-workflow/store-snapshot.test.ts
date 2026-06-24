import {
  buildStoreSnapshot,
  compareListingMetadata,
  extractPriceEvidence,
  parseAppStoreLookup,
} from "@/lib/seo/agent-workflow/store-snapshot";

describe("SEO workflow store snapshot", () => {
  it("parses App Store lookup rows and detects listing drift", () => {
    const listing = parseAppStoreLookup(
      {
        results: [{
          trackName: "Surf Forecast: Quiver",
          version: "1.0",
          currentVersionReleaseDate: "2026-05-18T00:00:00Z",
          averageUserRating: 4.8,
          userRatingCount: 12,
          formattedPrice: "Free",
        }],
      },
      "Quiver",
      "https://apps.apple.com/us/app/surf-forecast-quiver/id6759300320",
    );

    listing.priceEvidence.push("$4.99");
    listing.metadataDrift = compareListingMetadata("Quiver: Personal Surf Forecast $39.99", listing);

    expect(listing.version).toBe("1.0");
    expect(listing.metadataDrift).toEqual([
      "Unexpected live title: Surf Forecast: Quiver",
      "Live price evidence not found in listing doc: $4.99",
    ]);
    expect(buildStoreSnapshot("2026-05-20T12:00:00Z", [listing], [{
      source: "competitor-report",
      runId: "20260620T202412Z",
      summary: "Swellify App Store extraction now exposes $4.99 alongside prior prices.",
    }])).toMatchObject({
      listings: [expect.objectContaining({ app: "Quiver" })],
      competitorDeltas: [expect.objectContaining({
        source: "competitor-report",
        runId: "20260620T202412Z",
      })],
    });
  });

  it("extracts public price evidence from store HTML", () => {
    expect(extractPriceEvidence("Quiver Pro $4.99/month or $39.99/year")).toEqual([
      "$39.99",
      "$4.99",
    ]);
  });

  it("parses Swell Scope as a competitor listing", () => {
    const listing = parseAppStoreLookup(
      {
        results: [{
          trackName: "Swell Scope — Surf Forecast",
          version: "1.05",
          formattedPrice: "Free",
        }],
      },
      "Swell Scope",
      "https://apps.apple.com/us/app/swell-scope-surf-forecast/id6747609653",
    );

    expect(listing.app).toBe("Swell Scope");
    expect(listing.title).toBe("Swell Scope — Surf Forecast");
    expect(listing.version).toBe("1.05");
  });
});
