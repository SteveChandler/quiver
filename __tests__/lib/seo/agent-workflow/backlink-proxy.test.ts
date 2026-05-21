import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildBacklinkProxy,
  discoverManualBacklinkExportFiles,
  discoverManualBacklinkExports,
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
      }],
      competitorDeltas: ["Swellify sitemap changed"],
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

  it("ignores outreach status legend rows", () => {
    expect(parseOutreachStatuses("| Status | Meaning |\n| --- | --- |\n| `queued` | Identified |")).toEqual([]);
  });

  it("discovers and parses manual backlink CSV exports", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "quiver-backlinks-"));
    const csvPath = path.join(directory, "AHREFS-WEBMASTER-TOOLS.csv");
    fs.writeFileSync(csvPath, [
      "Referring page URL,Target URL,Anchor",
      "https://surf-school.example/blog,https://www.quiversurf.app/map,Quiver",
      "https://surf-school.example/resources,https://www.quiversurf.app/map,Quiver",
      "https://tourism.example/surf,https://www.quiversurf.app/best-time-to-surf,forecast",
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
    });
    expect(exports[0]?.topTargetUrls).toEqual(expect.arrayContaining([
      { url: "https://www.quiversurf.app/map", links: 2 },
    ]));
  });
});
