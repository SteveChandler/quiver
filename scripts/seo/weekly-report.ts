import fs from "node:fs";
import path from "node:path";

import { currentAuditDate, resolveSeoAuditDir } from "../../lib/seo/agent-workflow/audit-paths";
import { renderWeeklySeoReport } from "../../lib/seo/agent-workflow/weekly-report";
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
} from "../../lib/seo/agent-workflow/types";

const auditDir = getFlag("--dir") ?? resolveSeoAuditDir(currentAuditDate());
const outputPath = getFlag("--output") ?? path.join(auditDir, "SEO-WEEKLY-REPORT.md");

const inputFiles = [
  "GSC-REFRESH.json",
  "TECHNICAL-AUDIT.json",
  "VERCEL-ENRICHMENT.json",
  "POSTHOG-ENRICHMENT.json",
];
const optionalInputFiles = ["AHREFS-ENRICHMENT.json"];

const missing: string[] = [];
const metadata = readJsonIfExists<SeoMetadataAuditInput>(
  path.join(auditDir, "SEO-METADATA-AUDIT.json"),
  missing,
) ?? undefined;

const recommendations = inputFiles.flatMap((fileName) =>
  readJsonIfExists<SeoRecommendation[]>(path.join(auditDir, fileName), missing) ?? [],
).concat(metadata?.recommendations ?? [], optionalInputFiles.flatMap((fileName) =>
  readJsonIfExists<SeoRecommendation[]>(path.join(auditDir, fileName)) ?? [],
));
const technical = readJsonIfExists<SeoRecommendation[]>(
  path.join(auditDir, "TECHNICAL-AUDIT.json"),
  missing,
) ?? [];

const input: WeeklySeoReportInput = {
  generatedAt: new Date().toISOString(),
  recommendations,
  technical,
  gsc: readJsonIfExists<GscExportInput>(path.join(auditDir, "GSC-EXPORT.json"), missing) ?? undefined,
  vercel: readJsonIfExists<VercelExportInput>(path.join(auditDir, "VERCEL-EXPORT.json"), missing) ?? undefined,
  posthog: readJsonIfExists<PostHogExportInput>(path.join(auditDir, "POSTHOG-EXPORT.json"), missing) ?? undefined,
  store: readJsonIfExists<StoreSnapshotInput>(path.join(auditDir, "STORE-SNAPSHOT.json"), missing) ?? undefined,
  dataforseo: readJsonIfExists<DataForSeoExportInput>(path.join(auditDir, "DATAFORSEO-EXPORT.json")) ?? undefined,
  backlink: readJsonIfExists<BacklinkProxyInput>(path.join(auditDir, "BACKLINK-PROXY.json"), missing) ?? undefined,
  competitor: readJsonIfExists<CompetitorIntelligenceInput>(path.join(auditDir, "COMPETITOR-EXPORT.json"), missing) ?? undefined,
  aeo: readJsonIfExists<AeoCitationInput>(path.join(auditDir, "AEO-EXPORT.json"), missing) ?? undefined,
  outreach: readJsonIfExists<OutreachDigestInput>(path.join(auditDir, "OUTREACH-DIGEST.json"), missing) ?? undefined,
  metadata,
  missing,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, renderWeeklySeoReport(input));

console.log(JSON.stringify({
  outputPath,
  recommendations: recommendations.length,
  missing: missing.length,
}, null, 2));

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
