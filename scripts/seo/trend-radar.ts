import fs from "node:fs";
import path from "node:path";

import {
  currentAuditDate,
  resolveSeoAuditFile,
} from "../../lib/seo/agent-workflow/audit-paths";
import { readSeoDashboard } from "../../lib/seo/agent-workflow/dashboard";
import { parseGscExport } from "../../lib/seo/agent-workflow/gsc-export";
import {
  buildTrendRadarReport,
  parseManualTrendImportText,
  type ManualTrendRow,
} from "../../lib/seo/agent-workflow/trend-radar";
import type { GscExportInput } from "../../lib/seo/agent-workflow/types";

const now = getFlag("--now") ?? new Date().toISOString();
const auditDate = getFlag("--date") ?? currentAuditDate();
const dashboardPath = getFlag("--dashboard") ?? undefined;
const gscPath = getFlag("--gsc") ?? resolveSeoAuditFile("GSC-EXPORT.json", auditDate);
const priorGscPath = getFlag("--prior-gsc");
const manualTrendPaths = getFlags("--manual-trends");
const outputPath = getFlag("--output") ?? resolveSeoAuditFile("TREND-RADAR.json", auditDate);

const dashboard = readSeoDashboard(dashboardPath);
const gsc = readGscIfExists(gscPath);
const priorGsc = priorGscPath ? readGscIfExists(priorGscPath) : null;
const manualTrends = manualTrendPaths.flatMap(readManualTrends);

const report = buildTrendRadarReport({
  generatedAt: now,
  dashboard,
  gsc: gsc ? {
    currentQueries: gsc.topQueries,
    priorQueries: priorGsc?.topQueries ?? [],
  } : undefined,
  manualTrends,
});

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(JSON.stringify({
  outputPath,
  candidates: report.candidates.length,
  ignored: report.ignored.length,
  gscQueries: report.sources.gscQueries,
  manualTrends: report.sources.manualTrends,
}, null, 2));

function readGscIfExists(filePath: string): GscExportInput | null {
  if (!fs.existsSync(filePath)) return null;
  return parseGscExport(JSON.parse(fs.readFileSync(filePath, "utf8")));
}

function readManualTrends(filePath: string): ManualTrendRow[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Manual trend import not found: ${filePath}`);
  }

  return parseManualTrendImportText(
    fs.readFileSync(filePath, "utf8"),
    path.basename(filePath).toLowerCase(),
  );
}

function getFlag(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

function getFlags(name: string): string[] {
  return process.argv
    .map((arg, index) => ({ arg, index }))
    .filter((item) => item.arg === name)
    .map((item) => process.argv[item.index + 1])
    .filter((value): value is string => typeof value === "string");
}
