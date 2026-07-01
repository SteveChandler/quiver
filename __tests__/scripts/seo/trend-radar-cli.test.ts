/**
 * @jest-environment node
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

describe("scripts/seo/trend-radar CLI", () => {
  it("writes a review-only trend candidate report without DataForSEO", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "quiver-trend-radar-"));
    const gscPath = path.join(tmpDir, "GSC-EXPORT.json");
    const priorGscPath = path.join(tmpDir, "GSC-EXPORT-PRIOR.json");
    const trendsPath = path.join(tmpDir, "manual-trends.csv");
    const dashboardPath = path.join(tmpDir, "seo-dashboard.json");
    const outputPath = path.join(tmpDir, "TREND-RADAR.json");

    fs.writeFileSync(dashboardPath, `${JSON.stringify({
      version: 1,
      site: "https://www.quiversurf.app",
      updatedAt: "2026-06-30T12:00:00.000Z",
      entries: [],
      proposals: [],
    }, null, 2)}\n`);
    fs.writeFileSync(gscPath, `${JSON.stringify({
      generatedAt: "2026-06-30T12:00:00.000Z",
      siteUrl: "https://www.quiversurf.app",
      dateRanges: {
        last7d: { start: "2026-06-23", end: "2026-06-30" },
        prior7d: { start: "2026-06-16", end: "2026-06-22" },
        last28d: { start: "2026-06-02", end: "2026-06-30" },
      },
      last7d: [],
      prior7d: [],
      last28d: [],
      sitemapPaths: [],
      topQueries: [
        { query: "el nino surf forecast", clicks: 8, impressions: 260, position: 8.2 },
      ],
      topPages: [],
      byDevice: [],
      byCountry: [],
    }, null, 2)}\n`);
    fs.writeFileSync(priorGscPath, `${JSON.stringify({
      generatedAt: "2026-06-23T12:00:00.000Z",
      siteUrl: "https://www.quiversurf.app",
      dateRanges: {
        last7d: { start: "2026-06-16", end: "2026-06-22" },
        prior7d: { start: "2026-06-09", end: "2026-06-15" },
        last28d: { start: "2026-05-26", end: "2026-06-23" },
      },
      last7d: [],
      prior7d: [],
      last28d: [],
      sitemapPaths: [],
      topQueries: [
        { query: "el nino surf forecast", clicks: 0, impressions: 10, position: 40 },
      ],
      topPages: [],
      byDevice: [],
      byCountry: [],
    }, null, 2)}\n`);
    fs.writeFileSync(trendsPath, "query,traffic,region\nEl Niño surf,2K+,US-CA\n");

    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "scripts/seo/trend-radar.ts",
        "--gsc",
        gscPath,
        "--prior-gsc",
        priorGscPath,
        "--manual-trends",
        trendsPath,
        "--dashboard",
        dashboardPath,
        "--output",
        outputPath,
        "--now",
        "2026-06-30T12:00:00.000Z",
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("\"outputPath\"");

    const report = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    expect(report.candidates).toHaveLength(1);
    expect(report.candidates[0]).toMatchObject({
      query: "el nino surf forecast",
      action: "new-guide",
      canonicalPath: "/learn/el-nino-surf-impact",
      sources: ["gsc-query", "manual-trends"],
    });
    expect(report.guardrails).toContain("DataForSEO is intentionally excluded from this radar.");
  });
});
