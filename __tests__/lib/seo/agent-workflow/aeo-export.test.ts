import {
  extractAhrefsAeoSummary,
  extractAiReferrers,
  inspectLlmsFiles,
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
});
