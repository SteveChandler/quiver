import {
  discoverLatestAeoCitationReport,
  extractAhrefsAeoSummary,
  extractAiReferrers,
  inspectLlmsFiles,
  isVoidAeoCitationReport,
  parseAeoCitationReport,
} from "@/lib/seo/agent-workflow/aeo-export";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

describe("SEO workflow AEO export", () => {
  it("extracts AI referrers from Vercel export data", () => {
    expect(extractAiReferrers({
      generatedAt: "2026-06-28T12:00:00Z",
      dateRange: { from: "2026-06-21", to: "2026-06-28" },
      rawPageViews: 10,
      adjustedPageViews: 10,
      botPageViews: 0,
      pages: [],
      referrers: [
        { referrer: "google.com", visits: 5 },
        { referrer: "perplexity.ai", visits: 2 },
        { referrer: "chatgpt.com", visits: 1 },
      ],
      countries: [],
      devices: [],
    })).toEqual([
      { referrer: "perplexity.ai", visits: 2 },
      { referrer: "chatgpt.com", visits: 1 },
    ]);
  });

  it("extracts Ahrefs AI citation engine counts and citation domains", () => {
    const summary = extractAhrefsAeoSummary({
      summary: {
        siteExplorer: {
          aiCitations: {
            chatgpt: { citations: 53, pages: 26 },
            perplexity: { citations: 7, pages: 3 },
          },
        },
      },
      rows: [
        { "referring domain": "grokipedia.com", spam: false, "dofollow links": 1, "links to target": 1, "domain rating": 77 },
        { "referring domain": "spam.example", spam: true, "dofollow links": 10, "links to target": 10, "domain rating": 90 },
      ],
    });

    expect(summary.engines).toEqual(expect.arrayContaining([
      { engine: "chatgpt", citations: 53, pages: 26 },
      { engine: "perplexity", citations: 7, pages: 3 },
    ]));
    expect(summary.citationDomains).toEqual([
      { domain: "grokipedia.com", links: 1, domainRating: 77 },
    ]);
  });

  it("inspects llms files on disk", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "quiver-aeo-"));
    const llmsPath = path.join(directory, "llms.txt");
    fs.writeFileSync(llmsPath, "# Quiver\n- Forecast\n");

    expect(inspectLlmsFiles([llmsPath, path.join(directory, "llms-full.txt")])).toEqual([
      expect.objectContaining({ path: llmsPath, exists: true, lines: 2 }),
      expect.objectContaining({ exists: false, lines: 0, bytes: 0 }),
    ]);
  });

  it("skips void citation reports when discovering the latest baseline", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aeo-citation-"));
    fs.writeFileSync(
      path.join(dir, "2026-07-27.md"),
      "# AEO Citation Tracking — 2026-07-27\n\n| Segment | Cited | Total | Rate |\n|---|---:|---:|---:|\n| All queries | 8 | 30 | 26.7% |\n",
    );
    fs.writeFileSync(
      path.join(dir, "2026-08-17.md"),
      "# AEO Citation Tracking — 2026-08-17 (VOID)\n\nRate could not be reproduced.\n",
    );

    expect(discoverLatestAeoCitationReport(dir)).toBe(path.join(dir, "2026-07-27.md"));
  });

  it("treats a Status: void line as void", () => {
    expect(isVoidAeoCitationReport("# AEO Citation Tracking — 2026-08-17\n\nStatus: void\n")).toBe(true);
    expect(isVoidAeoCitationReport("# AEO Citation Tracking — 2026-08-18\n\nStatus: complete\n")).toBe(false);
  });

  it("returns null when every report is void", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aeo-citation-void-"));
    fs.writeFileSync(path.join(dir, "2026-08-17.md"), "# AEO Citation Tracking — 2026-08-17 (VOID)\n");
    expect(discoverLatestAeoCitationReport(dir)).toBeNull();
  });

  it("parses the citation baseline table from an aeo-citation-tracking report", () => {
    const markdown = [
      "# AEO Citation Tracking - 2026-06-15",
      "Status: user-provided pending validation",
      "",
      "## User-Provided Citation Baseline",
      "",
      "| Segment | Cited | Total | Rate | Notes |",
      "| --- | ---: | ---: | ---: | --- |",
      "| All queries | 5 | 30 | 16.7% | needs re-run |",
      "| Informational queries | 2 | 20 | 10.0% | reported |",
      "| Product/brand queries | 3 | 10 | 30.0% | reported |",
    ].join("\n");

    const baseline = parseAeoCitationReport(
      markdown,
      "docs/seo/reports/aeo-citation-tracking/2026-06-15.md",
    );

    expect(baseline.reportDate).toBe("2026-06-15");
    expect(baseline.status).toBe("user-provided pending validation");
    expect(baseline.overall?.cited).toBe(5);
    expect(baseline.overall?.total).toBe(30);
    expect(baseline.overall?.rate).toBeCloseTo(0.167, 3);
    expect(baseline.segments).toHaveLength(2);
    expect(baseline.segments[0]).toMatchObject({
      segment: "Informational queries",
      cited: 2,
      total: 20,
    });
  });
});
