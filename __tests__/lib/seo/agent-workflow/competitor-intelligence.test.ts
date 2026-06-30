import {
  parseComparisonSignals,
  parseTechnicalSurfaces,
} from "@/lib/seo/agent-workflow/competitor-intelligence";

const REPORT = `# Competitor Research Refresh

## Competitor-by-Competitor Findings

### Lazy Surfer

- Direct site fetches now return \`200\`.
- The Quiver comparison page is live in captured HTML and includes structured comparison copy around Android support and data-source transparency. https://lazysurfer.app/compare/quiver.html

### Swellify

- SEO footprint unchanged: robots \`200\`, sitemap \`200\`, \`507\` URLs, no raw-HTML schema markers.

## Material Changes Since Last Check

- Lazy Surfer comparison page confirmed.
`;

describe("SEO workflow competitor intelligence", () => {
  it("parses competitor technical surface summaries", () => {
    const surfaces = parseTechnicalSurfaces(REPORT);

    expect(surfaces).toEqual(expect.arrayContaining([
      expect.objectContaining({
        competitor: "Swellify",
        robotsStatus: 200,
        sitemapStatus: 200,
        sitemapCount: 507,
        schemaSupport: "missing",
      }),
      expect.objectContaining({
        competitor: "Lazy Surfer",
        robotsStatus: undefined,
        sitemapStatus: undefined,
      }),
    ]));
  });

  it("extracts comparison-page signals", () => {
    expect(parseComparisonSignals(REPORT)).toEqual([
      expect.objectContaining({
        competitor: "Lazy Surfer",
        url: "https://lazysurfer.app/compare/quiver.html",
      }),
    ]);
  });
});
