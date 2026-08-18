import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildBacklinkProxy,
  discoverManualBacklinkExportFiles,
  discoverManualBacklinkExports,
  parseBacklinkReport,
  parseOutreachStatuses,
} from "@/lib/seo/agent-workflow/backlink-proxy";

describe("SEO workflow backlink proxy", () => {
  it("aggregates free referrer, embed, outreach, and manual-export signals", () => {
    const outreach = [
      "| Target | Contact | Status |",
      "| --- | --- | --- |",
      "| Surf School | hello@example.com | backlink-confirmed |",
    ].join("\n");

    const proxy = buildBacklinkProxy("2026-05-20T12:00:00Z", {
      vercel: {
        generatedAt: "2026-05-20T12:00:00Z",
        dateRange: { from: "2026-05-13", to: "2026-05-20" },
        rawPageViews: 10,
        adjustedPageViews: 9,
        botPageViews: 1,
        pages: [],
        referrers: [{ referrer: "google.com", visits: 5 }],
        countries: [],
        devices: [],
      },
      embedReferrers: [{ referrer: "shop.example", visits: 2 }],
      outreachMarkdown: outreach,
      manualExports: [{
        source: "moz",
        path: "/tmp/moz.csv",
        rows: 3,
        uniqueReferringDomains: 2,
        sampleReferringDomains: ["surf-school.example"],
        topTargetUrls: [{ url: "https://www.quiversurf.app/map", links: 2 }],
        spamRows: 1,
        nonSpamRows: 2,
        dofollowLinks: 2,
        topCitationDomains: [{ domain: "surf-school.example", links: 1, domainRating: 72 }],
      }],
    });

    expect(proxy.referrers).toEqual([{ referrer: "google.com", visits: 5 }]);
    expect(proxy.embedReferrers).toEqual([{ referrer: "shop.example", visits: 2 }]);
    expect(proxy.outreachStatuses).toEqual([{ target: "Surf School", status: "backlink-confirmed" }]);
    expect(proxy.manualExports[0]?.rows).toBe(3);
    expect(proxy.manualExports[0]?.uniqueReferringDomains).toBe(2);
  });

  it("parses outreach tracker markdown tables", () => {
    expect(parseOutreachStatuses("| Target | Status |\n| --- | --- |\n| A | sent |")).toEqual([
      { target: "A", status: "sent" },
    ]);
  });

  it("parses confirmed and unverified targets from a weekly backlink report", () => {
    const markdown = [
      "# Weekly Backlink Scan - 2026-06-15",
      "",
      "## Confirmed Targets",
      "",
      "| Target | Source URL | Status | Opportunity | Replacement angle | Next action |",
      "| --- | --- | --- | --- | --- | --- |",
      "| UMass Lowell | https://uml.edu/surfing | confirmed | links MSW | pitch Quiver | Verify URL |",
      "",
      "## Unverified Targets",
      "",
      "| Target | Status | Reason | Next action |",
      "| --- | --- | --- | --- |",
      "| Surfrider Central Texas | unverified | No live source URL | Do not outreach |",
    ].join("\n");

    const report = parseBacklinkReport(
      markdown,
      "docs/seo/backlink-reports/2026-06-15.md",
    );

    expect(report.reportDate).toBe("2026-06-15");
    expect(report.confirmed).toEqual([{
      target: "UMass Lowell",
      sourceUrl: "https://uml.edu/surfing",
      status: "confirmed",
      nextAction: "Verify URL",
    }]);
    expect(report.unverified).toEqual([{
      target: "Surfrider Central Texas",
      sourceUrl: undefined,
      status: "unverified",
      nextAction: "Do not outreach",
    }]);
  });

  it("ignores outreach status legend rows", () => {
    expect(parseOutreachStatuses("| Status | Meaning |\n| --- | --- |\n| `queued` | Identified |")).toEqual([]);
  });

  it("discovers and parses manual backlink CSV exports", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "quiver-backlinks-"));
    const csvPath = path.join(directory, "AHREFS-WEBMASTER-TOOLS.csv");
    fs.writeFileSync(csvPath, [
      "Referring page URL,Target URL,Anchor,Spam,Dofollow Links,Domain Rating",
      "https://surf-school.example/blog,https://www.quiversurf.app/map,Quiver,false,1,68",
      "https://surf-school.example/resources,https://www.quiversurf.app/map,Quiver,true,0,15",
      "https://tourism.example/surf,https://www.quiversurf.app/best-time-to-surf,forecast,false,2,72",
    ].join("\n"));

    const files = discoverManualBacklinkExportFiles([directory]);
    const exports = discoverManualBacklinkExports(files);

    expect(files).toEqual([csvPath]);
    expect(exports).toHaveLength(1);
    expect(exports[0]).toMatchObject({
      source: "ahrefs-webmaster-tools",
      rows: 3,
      uniqueReferringDomains: 2,
      sampleReferringDomains: ["surf-school.example", "tourism.example"],
      spamRows: 1,
      nonSpamRows: 2,
      dofollowLinks: 3,
    });
    expect(exports[0]?.topTargetUrls).toEqual(expect.arrayContaining([
      { url: "https://www.quiversurf.app/map", links: 2 },
    ]));
    expect(exports[0]?.topCitationDomains).toEqual([
      { domain: "surf-school.example", links: 1, domainRating: 68 },
      { domain: "tourism.example", links: 1, domainRating: 72 },
    ]);
  });

  it("ignores audit-tool output that merely mentions a backlink vendor", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "quiver-backlinks-"));
    const exportPath = path.join(directory, "AHREFS-WEBMASTER-TOOLS.csv");
    fs.writeFileSync(exportPath, [
      "Referring page URL,Target URL,Dofollow Links",
      "https://surf-school.example/blog,https://www.quiversurf.app/map,1",
    ].join("\n"));

    // Ahrefs Site Audit findings, not a backlink index. Previously matched on the
    // "ahrefs" substring and reported a referring domain named "ahrefs-audit".
    fs.writeFileSync(path.join(directory, "AHREFS-ENRICHMENT.json"), JSON.stringify([
      { id: "ahrefs-external-timeout", source: "ahrefs-audit", priority: "medium" },
    ]));
    fs.writeFileSync(path.join(directory, "AHREFS-SCREENSHOT-INPUT.json"), "[]");
    fs.writeFileSync(path.join(directory, "BACKLINK-PROXY.json"), "[]");

    expect(discoverManualBacklinkExportFiles([directory])).toEqual([exportPath]);
  });

  it("still discovers underscored variants of documented export filenames", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "quiver-backlinks-"));
    const exportPath = path.join(directory, "GSC_LINKS.csv");
    fs.writeFileSync(exportPath, "Source URL,Target URL\nhttps://a.example,https://www.quiversurf.app/");

    expect(discoverManualBacklinkExportFiles([directory])).toEqual([exportPath]);
  });

  it("loads non-standard filenames passed explicitly", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "quiver-backlinks-"));
    const oddPath = path.join(directory, "partner-link-dump.csv");
    fs.writeFileSync(oddPath, "Source URL,Target URL\nhttps://a.example,https://www.quiversurf.app/");

    expect(discoverManualBacklinkExportFiles([directory])).toEqual([]);
    expect(discoverManualBacklinkExportFiles([directory], [oddPath])).toEqual([oddPath]);
  });
});
