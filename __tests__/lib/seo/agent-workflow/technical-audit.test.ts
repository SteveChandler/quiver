import {
  analyzeTechnicalAudit,
  extractInternalLinks,
  extractSitemapPaths,
} from "@/lib/seo/agent-workflow/technical-audit";

const NOW = "2026-05-17T12:00:00.000Z";

describe("SEO workflow technical audit", () => {
  it("extracts sitemap URLs as canonical paths", () => {
    expect(extractSitemapPaths(`
      <urlset>
        <url><loc>https://www.quiversurf.app/learn/foo</loc></url>
        <url><loc>https://www.quiversurf.app/map?x=1</loc></url>
      </urlset>
    `)).toEqual(["/learn/foo", "/map"]);
  });

  it("extracts unique same-origin links and skips off-origin and non-page hrefs", () => {
    const html = [
      '<a href="/learn/foo">a</a>',
      '<a href="https://www.quiversurf.app/map">b</a>',
      '<a href="/learn/foo#section">dup</a>',
      '<a href="https://external.com/x">ext</a>',
      '<a href="#top">anchor</a>',
      '<a href="mailto:hi@quiversurf.app">mail</a>',
    ].join("");

    expect(extractInternalLinks(html, "https://www.quiversurf.app/")).toEqual([
      "https://www.quiversurf.app/learn/foo",
      "https://www.quiversurf.app/map",
    ]);
  });

  it("flags robots, canonical, metadata, and broken-link issues", () => {
    const recommendations = analyzeTechnicalAudit(
      {
        robotsTxt: "User-agent: *\nDisallow: /_next/\n",
        sitemapXml: "<urlset><url><loc>https://www.quiversurf.app/foo</loc></url></urlset>",
        pages: [{
          url: "https://www.quiversurf.app/foo",
          status: 200,
          html: [
            "<html><head>",
            "<title>",
            "A".repeat(70),
            "</title>",
            "<meta name=\"description\" content=\"",
            "B".repeat(180),
            "\">",
            "<link rel=\"canonical\" href=\"https://www.quiversurf.app/bar\">",
            "</head><body></body></html>",
          ].join(""),
          outgoingLinks: [{ href: "/dead", status: 404 }],
        }],
      },
      NOW,
    );

    expect(recommendations.map((item) => item.id)).toEqual([
      "technical-audit-robots-next-static",
      "technical-broken-links-foo",
      "technical-canonical-mismatch-foo",
      "technical-description-foo",
      "technical-title-foo",
    ]);
  });
});
