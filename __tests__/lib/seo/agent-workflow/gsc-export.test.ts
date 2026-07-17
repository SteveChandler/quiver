import { parseGscExport, toGscRefreshInput } from "@/lib/seo/agent-workflow/gsc-export";

describe("SEO workflow GSC export", () => {
  it("parses the machine-readable gsc-stats export shape", () => {
    const parsed = parseGscExport({
      generatedAt: "2026-05-20T12:00:00Z",
      siteUrl: "https://www.quiversurf.app/",
      dateRanges: {
        last7d: { start: "2026-05-11", end: "2026-05-17" },
        prior7d: { start: "2026-05-04", end: "2026-05-10" },
        last28d: { start: "2026-04-20", end: "2026-05-17" },
      },
      last7d: [{ page: "https://www.quiversurf.app/Learn/Foo/", clicks: 2, impressions: 20 }],
      prior7d: [{ page: "/learn/foo", clicks: 4, impressions: 40 }],
      last28d: [{ page: "/learn/foo", clicks: 8, impressions: 80, ctr: 0.1, position: 7 }],
      sitemapPaths: ["https://www.quiversurf.app/learn/foo/"],
      topQueries: [{ query: "surf forecast", clicks: 5, impressions: 50 }],
      topPages: [{ page: "/learn/foo", clicks: 8, impressions: 80 }],
      byDevice: [{ device: "mobile", clicks: 6, impressions: 60 }],
      byCountry: [{ country: "usa", clicks: 7, impressions: 70 }],
      indexing: {
        generatedAt: "2026-05-20T12:00:00Z",
        watchlistPath: "docs/seo/gsc-indexing-watchlist.json",
        results: [{
          canonicalPath: "/beaches/mexico",
          coverageState: "Discovered - currently not indexed",
          sitemap: ["https://www.quiversurf.app/sitemap.xml"],
        }],
      },
    });

    expect(parsed.last7d[0]?.page).toBe("/learn/foo");
    expect(parsed.sitemapPaths).toEqual(["/learn/foo"]);
    expect(toGscRefreshInput(parsed).last28d).toHaveLength(1);
    expect(toGscRefreshInput(parsed).dataThrough).toBe("2026-05-17");
    expect(toGscRefreshInput(parsed).indexing?.results[0]?.coverageState)
      .toBe("Discovered - currently not indexed");
  });

  it("rejects partial exports that cannot power the weekly workflow", () => {
    expect(() => parseGscExport({ generatedAt: "2026-05-20T12:00:00Z" }))
      .toThrow("siteUrl");
  });
});
