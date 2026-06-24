import fs from "node:fs";
import path from "node:path";

import type { CompetitorDelta } from "./types";

const COMPETITOR_AUTOMATION_ROOT =
  "/Users/stevenchandler/.codex/automations/competitor-research-refresh";

export function readLatestCompetitorReportDeltas(
  automationRoot: string = COMPETITOR_AUTOMATION_ROOT,
): CompetitorDelta[] {
  const latestReport = findLatestCompetitorReportPath(automationRoot);
  if (!latestReport) return [];

  const report = fs.readFileSync(latestReport, "utf8");
  const runId = path.basename(path.dirname(latestReport));
  const summaries = extractMaterialDeltaSummaries(report);

  return summaries.map((summary) => ({
    source: "competitor-report",
    runId,
    summary,
  }));
}

export function extractMaterialDeltaSummaries(markdown: string): string[] {
  const materialChanges = extractSectionBullets(markdown, "## Material Changes Since Last Check");
  if (materialChanges.length > 0) return dedupeSummaries(materialChanges);

  const executiveSummary = extractSectionBullets(markdown, "## Executive Summary");
  return dedupeSummaries(executiveSummary);
}

function findLatestCompetitorReportPath(automationRoot: string): string | null {
  const runsDir = path.join(automationRoot, "runs");
  if (!fs.existsSync(runsDir)) return null;

  const runDirs = fs.readdirSync(runsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(runsDir, entry.name, "report.md"))
    .filter((reportPath) => fs.existsSync(reportPath))
    .sort();

  return runDirs.at(-1) ?? null;
}

function extractSectionBullets(markdown: string, heading: string): string[] {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start === -1) return [];

  const bullets: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? "";
    if (line.startsWith("## ")) break;
    if (!line.startsWith("- ")) continue;

    const summary = line.replace(/^-+\s*/, "").trim();
    if (summary.length > 0) bullets.push(summary);
  }

  return bullets;
}

function dedupeSummaries(summaries: string[]): string[] {
  return [...new Set(summaries.map((summary) => summary.trim()).filter(Boolean))];
}
