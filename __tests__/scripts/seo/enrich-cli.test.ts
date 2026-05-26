/**
 * @jest-environment node
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

describe("scripts/seo/enrich CLI", () => {
  it("refuses to use the same path for --input and --output", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "quiver-enrich-cli-"));
    const inputPath = path.join(tmpDir, "AHREFS-SCREENSHOT-INPUT.json");
    const inputJson = JSON.stringify({
      issues: [{
        path: "/vs/surfline",
        type: "schema-validation-error",
        summary: "Structured data has schema.org validation errors.",
      }],
    }, null, 2);
    fs.writeFileSync(inputPath, `${inputJson}\n`);

    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "scripts/seo/enrich.ts",
        "--source",
        "ahrefs",
        "--input",
        inputPath,
        "--output",
        inputPath,
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      },
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("--input and --output must be different files");
    expect(fs.readFileSync(inputPath, "utf8")).toBe(`${inputJson}\n`);
  });

  it("uses same-folder GSC context to validate Ahrefs keyword priority", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "quiver-enrich-cli-"));
    const inputPath = path.join(tmpDir, "AHREFS-SCREENSHOT-INPUT.json");
    const outputPath = path.join(tmpDir, "AHREFS-ENRICHMENT.json");
    fs.writeFileSync(inputPath, `${JSON.stringify({
      keywordOpportunities: [{
        path: "/best-time-to-surf/westport",
        keyword: "westport surf report",
        volume: 250,
        difficulty: 18,
      }],
    }, null, 2)}\n`);
    fs.writeFileSync(path.join(tmpDir, "GSC-EXPORT.json"), `${JSON.stringify({
      last28d: [{
        page: "/best-time-to-surf/westport",
        clicks: 7,
        impressions: 245,
      }],
    }, null, 2)}\n`);

    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "scripts/seo/enrich.ts",
        "--source",
        "ahrefs",
        "--input",
        inputPath,
        "--output",
        outputPath,
        "--now",
        "2026-05-25T12:00:00.000Z",
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(0);
    const recommendations = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    expect(recommendations[0]).toMatchObject({
      priority: "high",
      status: "open",
    });
    expect(recommendations[0].evidence).toContain("crossCheck=gscImpressions=245,gscClicks=7");
  });
});
