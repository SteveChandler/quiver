import {
  detectAeoCitationRunAnomalies,
  discoverLatestAeoCitationReport,
  extractAhrefsAeoSummary,
  extractAiReferrers,
  inspectLlmsFiles,
  isVoidAeoCitationReport,
  parseAeoCitationReport,
  validateAeoCitationReport,
} from "@/lib/seo/agent-workflow/aeo-export";
import type { AeoQuerySet } from "@/lib/seo/agent-workflow/aeo-export";
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


  describe("report validation", () => {
    const querySet: AeoQuerySet = {
      brandDomains: ["quiversurf.app"],
      segments: {
        informational: ["best tide for surfing", "what is swell period"],
        "product-brand": ["surfline alternative"],
      },
    };

    function report(overrides: {
      cited?: number;
      surfaced?: string[];
      notSurfaced?: string[];
      omitSections?: string[];
    } = {}): string {
      const cited = overrides.cited ?? 1;
      const surfaced = overrides.surfaced ?? ["surfline alternative"];
      const notSurfaced = overrides.notSurfaced
        ?? ["best tide for surfing", "what is swell period"];
      const omit = overrides.omitSections ?? [];
      const sections = [
        "# AEO Citation Tracking — 2026-09-02",
        "",
        "| Segment | Cited | Total | Rate |",
        "|---|---:|---:|---:|",
        `| All queries | ${cited} | 3 | ${((cited / 3) * 100).toFixed(1)}% |`,
        "",
        omit.includes("Movement") ? "" : "## Movement\n\nPrevious run: all 0.0%. Method unchanged.\n",
        omit.includes("surfaced")
          ? ""
          : `## Queries that surfaced\n\n${surfaced.map((query) => `- ${query}`).join("\n")}\n`,
        omit.includes("notSurfaced") ? "" : `## Queries that did not surface\n\n${notSurfaced.join("; ")}\n`,
        omit.includes("Action list") ? "" : "## Action list\n\n- [NO ACTION] Nothing to do.\n",
      ];
      return sections.filter((section) => section !== "").join("\n");
    }

    it("accepts a report whose counts match the queries it lists", () => {
      expect(validateAeoCitationReport(report(), querySet)).toEqual({ ok: true, problems: [] });
    });

    it("rejects a rate that does not match the surfaced list", () => {
      const result = validateAeoCitationReport(report({ cited: 3 }), querySet);
      expect(result.ok).toBe(false);
      expect(result.problems.join(" ")).toContain("claims 3 cited but the surfaced list names 1");
    });

    it("rejects a report that omits the query lists", () => {
      const result = validateAeoCitationReport(
        report({ omitSections: ["surfaced", "notSurfaced"] }),
        querySet,
      );
      expect(result.ok).toBe(false);
      expect(result.problems.join(" ")).toContain("Queries that surfaced");
      expect(result.problems.join(" ")).toContain("appear in neither list");
    });

    it("requires a Capture points section when asked", () => {
      expect(validateAeoCitationReport(report(), querySet, { requireCapturePoints: true }).problems)
        .toEqual([expect.stringContaining("## Capture points")]);
      expect(validateAeoCitationReport(report(), querySet).ok).toBe(true);
    });

    it("rejects a report missing the Movement or Action list sections", () => {
      const result = validateAeoCitationReport(
        report({ omitSections: ["Movement", "Action list"] }),
        querySet,
      );
      expect(result.ok).toBe(false);
      expect(result.problems).toEqual(expect.arrayContaining([
        expect.stringContaining("## Movement"),
        expect.stringContaining("## Action list"),
      ]));
    });

    it("rejects a query listed as both surfaced and not surfaced", () => {
      const result = validateAeoCitationReport(
        report({ notSurfaced: ["best tide for surfing", "what is swell period", "surfline alternative"] }),
        querySet,
      );
      expect(result.ok).toBe(false);
      expect(result.problems.join(" ")).toContain("both surfaced and not surfaced");
    });


    it("matches a query split across a hard-wrapped line", () => {
      const wrapped = report({
        notSurfaced: ["best tide for surfing", "what is\nswell period"],
      });
      expect(validateAeoCitationReport(wrapped, querySet).ok).toBe(true);
    });

    it("does not match a short query inside a longer one", () => {
      const overlapping: AeoQuerySet = {
        brandDomains: ["quiversurf.app"],
        segments: { "product-brand": ["surfline alternative", "free surfline alternative"] },
      };
      const markdown = [
        "# AEO Citation Tracking — 2026-09-02",
        "",
        "| Segment | Cited | Total | Rate |",
        "|---|---:|---:|---:|",
        "| All queries | 1 | 2 | 50.0% |",
        "",
        "## Movement",
        "",
        "Method unchanged.",
        "",
        "## Queries that surfaced",
        "",
        "| Query | Segment |",
        "| --- | --- |",
        "| surfline alternative | product/brand |",
        "",
        "## Queries that did not surface",
        "",
        "free surfline alternative",
        "",
        "## Action list",
        "",
        "- [NO ACTION] Nothing to do.",
      ].join("\n");

      expect(validateAeoCitationReport(markdown, overlapping)).toEqual({ ok: true, problems: [] });
    });

    it("ignores prose in the surfaced section that names other queries", () => {
      const withProse = report().replace(
        "## Queries that surfaced\n",
        "## Queries that surfaced\n\nUnlike last run, `best tide for surfing` did not appear.\n",
      );
      expect(validateAeoCitationReport(withProse, querySet).ok).toBe(true);
    });

    it("flags a run that surfaces nothing the previous valid run surfaced", () => {
      const previous = report({ surfaced: ["best tide for surfing"], notSurfaced: ["what is swell period", "surfline alternative"] });
      expect(detectAeoCitationRunAnomalies(report(), previous, querySet).join(" "))
        .toContain("shares no query with the previous valid run");
    });

    it("does not flag a run that holds a query from the previous run", () => {
      expect(detectAeoCitationRunAnomalies(report(), report(), querySet)).toEqual([]);
    });

    it("flags a swing over 20 points with no declared method change", () => {
      const previous = report({ cited: 3, surfaced: ["surfline alternative", "best tide for surfing", "what is swell period"], notSurfaced: [] });
      expect(detectAeoCitationRunAnomalies(report(), previous, querySet).join(" "))
        .toContain("with no `## Method change` section");
    });
  });


  it("holds every report written under the runbook to its format", () => {
    const reportDir = path.join(process.cwd(), "docs/seo/reports/aeo-citation-tracking");
    const querySet = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "docs/seo/aeo-query-set.json"), "utf8"),
    ) as AeoQuerySet;

    // The runbook landed 2026-08-18. Reports before it predate the format.
    const governed = fs.readdirSync(reportDir)
      .filter((name) => /^\d{4}-\d{2}-\d{2}\.md$/.test(name))
      .filter((name) => name >= "2026-08-18")
      .sort();

    expect(governed.length).toBeGreaterThan(0);

    const failures: string[] = [];
    for (const name of governed) {
      const markdown = fs.readFileSync(path.join(reportDir, name), "utf8");
      // A void run is retained as evidence of a bad method; it is not held to the format.
      if (isVoidAeoCitationReport(markdown)) continue;
      // Capture points became required 2026-09-02; earlier runs predate the rule.
      const result = validateAeoCitationReport(markdown, querySet, {
        requireCapturePoints: name >= "2026-09-02",
      });
      if (!result.ok) failures.push(`${name}: ${result.problems.join(" | ")}`);
    }

    expect(failures).toEqual([]);
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
