import fs from "node:fs";
import path from "node:path";

import { currentAuditDate, resolveSeoAuditDir } from "../../lib/seo/agent-workflow/audit-paths";
import {
  buildWeeklySeoComparison,
  renderWeeklySeoReport,
} from "../../lib/seo/agent-workflow/weekly-report";
import type {
  AeoCitationInput,
  BacklinkProxyInput,
  CompetitorIntelligenceInput,
  DataForSeoExportInput,
  GscExportInput,
  OutreachDigestInput,
  PostHogExportInput,
  SeoMetadataAuditInput,
  SeoRecommendation,
  StoreSnapshotInput,
  VercelExportInput,
  WeeklySeoReportInput,
  WeeklySeoSourceFreshness,
  WeeklySeoSourceFreshnessStatus,
} from "../../lib/seo/agent-workflow/types";

const auditDir = getFlag("--dir") ?? resolveSeoAuditDir(currentAuditDate());
const outputPath = getFlag("--output") ?? path.join(auditDir, "SEO-WEEKLY-REPORT.md");
const auditDate = getFlag("--audit-date") ?? inferAuditDate(auditDir);
const previousAuditDir = findPreviousAuditDir(auditDir);

const inputFiles = [
  "GSC-REFRESH.json",
  "TECHNICAL-AUDIT.json",
  "VERCEL-ENRICHMENT.json",
  "POSTHOG-ENRICHMENT.json",
];
const optionalInputFiles = ["AHREFS-ENRICHMENT.json"];

const input = readWeeklyReportInput(auditDir, new Date().toISOString(), auditDate, true);
const previousInput = previousAuditDir
  ? readWeeklyReportInput(previousAuditDir, new Date().toISOString(), path.basename(previousAuditDir), false)
  : undefined;
const ahrefsSnapshot = readJsonIfExists<AhrefsFreshnessSnapshot>(
  path.join(auditDir, "AHREFS-SCREENSHOT-INPUT.json"),
);
input.sourceFreshness = buildSourceFreshness(input, auditDate, ahrefsSnapshot);
input.weekOverWeek = buildWeeklySeoComparison(
  input,
  previousInput,
  previousAuditDir ? path.basename(previousAuditDir) : undefined,
);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, renderWeeklySeoReport(input));

console.log(JSON.stringify({
  outputPath,
  recommendations: input.recommendations.length,
  missing: input.missing.length,
  previousAuditDate: previousAuditDir ? path.basename(previousAuditDir) : null,
  staleSources: input.sourceFreshness.filter((source) => source.status === "stale").map((source) => source.source),
}, null, 2));

function readWeeklyReportInput(
  dir: string,
  generatedAt: string,
  reportDate: string,
  trackMissing: boolean,
): WeeklySeoReportInput {
  const missing: string[] = [];
  const missingList = trackMissing ? missing : undefined;
  const metadata = readJsonIfExists<SeoMetadataAuditInput>(
    path.join(dir, "SEO-METADATA-AUDIT.json"),
    missingList,
  ) ?? undefined;
  const recommendations = inputFiles.flatMap((fileName) =>
    readJsonIfExists<SeoRecommendation[]>(path.join(dir, fileName), missingList) ?? [],
  ).concat(metadata?.recommendations ?? [], optionalInputFiles.flatMap((fileName) =>
    readJsonIfExists<SeoRecommendation[]>(path.join(dir, fileName)) ?? [],
  ));
  const technical = readJsonIfExists<SeoRecommendation[]>(
    path.join(dir, "TECHNICAL-AUDIT.json"),
    missingList,
  ) ?? [];

  return {
    generatedAt,
    auditDate: reportDate,
    recommendations,
    technical,
    gsc: readJsonIfExists<GscExportInput>(path.join(dir, "GSC-EXPORT.json"), missingList) ?? undefined,
    vercel: readJsonIfExists<VercelExportInput>(path.join(dir, "VERCEL-EXPORT.json"), missingList) ?? undefined,
    posthog: readJsonIfExists<PostHogExportInput>(path.join(dir, "POSTHOG-EXPORT.json"), missingList) ?? undefined,
    store: readJsonIfExists<StoreSnapshotInput>(path.join(dir, "STORE-SNAPSHOT.json"), missingList) ?? undefined,
    dataforseo: readJsonIfExists<DataForSeoExportInput>(path.join(dir, "DATAFORSEO-EXPORT.json")) ?? undefined,
    backlink: readJsonIfExists<BacklinkProxyInput>(path.join(dir, "BACKLINK-PROXY.json"), missingList) ?? undefined,
    competitor: readJsonIfExists<CompetitorIntelligenceInput>(path.join(dir, "COMPETITOR-EXPORT.json"), missingList) ?? undefined,
    aeo: readJsonIfExists<AeoCitationInput>(path.join(dir, "AEO-EXPORT.json"), missingList) ?? undefined,
    outreach: readJsonIfExists<OutreachDigestInput>(path.join(dir, "OUTREACH-DIGEST.json"), missingList) ?? undefined,
    metadata,
    missing,
  };
}

interface AhrefsFreshnessSnapshot {
  capturedAt?: string;
  capturedForAuditDate?: string;
  crawl?: { latestRun?: { date?: string } };
}

function buildSourceFreshness(
  input: WeeklySeoReportInput,
  reportDate: string,
  ahrefs?: AhrefsFreshnessSnapshot | null,
): WeeklySeoSourceFreshness[] {
  return [
    makeFreshness("GSC Search Console", input.gsc?.dateRanges.last28d.end, reportDate, "data through"),
    makeFreshness("Vercel Analytics", input.vercel?.dateRange.to, reportDate, "window ends"),
    makeFreshness("PostHog", input.posthog?.dateRange.to, reportDate, "window ends"),
    makeFreshness("DataForSEO", input.dataforseo?.generatedAt, reportDate, "export generated"),
    makeFreshness("Store listings", input.store?.generatedAt, reportDate, "snapshot generated"),
    makeFreshness(
      "Ahrefs Site Audit",
      ahrefs?.capturedForAuditDate ?? ahrefs?.crawl?.latestRun?.date ?? ahrefs?.capturedAt,
      reportDate,
      "capture date",
    ),
    makeFreshness("Competitor deep-dive", dateFromRunId(input.competitor?.runId), reportDate, "run date"),
    makeFreshness("AEO citation baseline", input.aeo?.narrativeBaseline?.reportDate, reportDate, "30-query audit date"),
    makeFreshness("Backlink target report", input.backlink?.narrativeTargets?.reportDate, reportDate, "target report date"),
  ];
}

function makeFreshness(
  source: string,
  observedAt: string | undefined,
  reportDate: string,
  label: string,
): WeeklySeoSourceFreshness {
  const date = dateOnly(observedAt);
  if (!date) {
    return { source, status: "missing", note: "no dated input was available" };
  }
  const ageDays = dayDifference(reportDate, date);
  const status: WeeklySeoSourceFreshnessStatus = ageDays <= 1
    ? "fresh"
    : ageDays <= 3
      ? "lagged"
      : "stale";
  const ageNote = ageDays === 0 ? "same-day" : `${ageDays} day${ageDays === 1 ? "" : "s"} old`;
  return { source, observedAt: date, status, note: `${label} ${date} (${ageNote})` };
}

function findPreviousAuditDir(auditDirPath: string): string | null {
  const auditRoot = path.dirname(auditDirPath);
  const currentDate = path.basename(auditDirPath);
  if (!fs.existsSync(auditRoot)) return null;
  const previous = fs.readdirSync(auditRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name) && entry.name < currentDate)
    .map((entry) => entry.name)
    .sort()
    .at(-1);
  return previous ? path.join(auditRoot, previous) : null;
}

function inferAuditDate(auditDirPath: string): string {
  const date = path.basename(auditDirPath);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : currentAuditDate();
}

function dateFromRunId(runId?: string): string | undefined {
  const compact = runId?.match(/^(\d{4})(\d{2})(\d{2})/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  return runId?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
}

function dateOnly(value?: string): string | undefined {
  return value?.match(/\d{4}-\d{2}-\d{2}/)?.[0];
}

function dayDifference(later: string, earlier: string): number {
  const laterMs = Date.parse(`${later}T00:00:00Z`);
  const earlierMs = Date.parse(`${earlier}T00:00:00Z`);
  if (!Number.isFinite(laterMs) || !Number.isFinite(earlierMs)) return 999;
  return Math.max(0, Math.round((laterMs - earlierMs) / 86_400_000));
}

function readJsonIfExists<T>(filePath: string, missingList?: string[]): T | null {
  if (!fs.existsSync(filePath)) {
    missingList?.push(filePath);
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function getFlag(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}
