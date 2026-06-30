import fs from "node:fs";
import path from "node:path";

import {
  buildAeoCitationExport,
  discoverLatestAhrefsSnapshot,
  extractAhrefsAeoSummary,
  extractAiReferrers,
  inspectLlmsFiles,
} from "../../lib/seo/agent-workflow/aeo-export";
import { currentAuditDate, resolveSeoAuditDir, resolveSeoAuditFile } from "../../lib/seo/agent-workflow/audit-paths";
import type { VercelExportInput } from "../../lib/seo/agent-workflow/types";

const auditDate = currentAuditDate();
const auditDir = getFlag("--dir") ?? resolveSeoAuditDir(auditDate);
const outputPath = getFlag("--output") ?? resolveSeoAuditFile("AEO-EXPORT.json", auditDate);
const vercelPath = getFlag("--vercel") ?? resolveSeoAuditFile("VERCEL-EXPORT.json", auditDate);
const ahrefsPath = getFlag("--ahrefs");

void main();

async function main(): Promise<void> {
  const missing: string[] = [];
  const vercel = readJsonIfExists<VercelExportInput>(vercelPath);
  if (!vercel) missing.push(vercelPath);

  const resolvedAhrefsPath = ahrefsPath ?? discoverLatestAhrefsSnapshot(auditDir);
  const ahrefs = resolvedAhrefsPath ? readJsonIfExists<unknown>(resolvedAhrefsPath) : null;
  if (!ahrefs) {
    missing.push(resolvedAhrefsPath ?? "AHREFS-SCREENSHOT-INPUT.json");
  }

  const ahrefsSummary = ahrefs ? extractAhrefsAeoSummary(ahrefs) : { engines: [], citationDomains: [] };
  const llmsFiles = inspectLlmsFiles([
    path.join(process.cwd(), "public", "llms.txt"),
    path.join(process.cwd(), "public", "llms-full.txt"),
  ]);

  const result = buildAeoCitationExport(new Date().toISOString(), {
    aiReferrers: extractAiReferrers(vercel ?? undefined),
    engines: ahrefsSummary.engines,
    citationDomains: ahrefsSummary.citationDomains,
    llmsFiles,
    missing,
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({
    outputPath,
    aiReferrers: result.aiReferrers.length,
    engines: result.engines.length,
    citationDomains: result.citationDomains.length,
  }, null, 2));
}

function readJsonIfExists<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function getFlag(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}
