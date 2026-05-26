import fs from "node:fs";
import path from "node:path";

import {
  analyzeSeoEnrichment,
} from "../../lib/seo/agent-workflow/enrichment";
import { currentAuditDate, resolveSeoAuditFile } from "../../lib/seo/agent-workflow/audit-paths";
import type {
  GscExportInput,
  PostHogExportInput,
  SeoEnrichmentContext,
  SeoEnrichmentInput,
  SeoEnrichmentSource,
  VercelExportInput,
} from "../../lib/seo/agent-workflow/types";

const inputPath = getFlag("--input");
if (!inputPath) throw new Error("Missing --input path to enrichment JSON.");

const source = getFlag("--source") as SeoEnrichmentSource | null;
if (source !== "vercel" && source !== "posthog" && source !== "ahrefs") {
  throw new Error("Missing or invalid --source. Use vercel, posthog, or ahrefs.");
}

const outputPath = getFlag("--output") ??
  resolveSeoAuditFile(`${source.toUpperCase()}-ENRICHMENT.json`, currentAuditDate());
if (path.resolve(inputPath) === path.resolve(outputPath)) {
  throw new Error("--input and --output must be different files to avoid overwriting the source export.");
}

const now = getFlag("--now") ?? new Date().toISOString();
const parsedInput = JSON.parse(fs.readFileSync(inputPath, "utf8")) as Omit<SeoEnrichmentInput, "source">;
const context = source === "ahrefs" ? readSameFolderSeoContext(path.dirname(inputPath)) : {};
const recommendations = analyzeSeoEnrichment({ ...parsedInput, source }, now, context);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(recommendations, null, 2)}\n`);

console.log(JSON.stringify({
  outputPath,
  source,
  recommendations: recommendations.length,
}, null, 2));

function getFlag(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

function readSameFolderSeoContext(dir: string): SeoEnrichmentContext {
  return {
    gsc: readJsonIfExists<GscExportInput>(path.join(dir, "GSC-EXPORT.json")) ?? undefined,
    vercel: readJsonIfExists<VercelExportInput>(path.join(dir, "VERCEL-EXPORT.json")) ?? undefined,
    posthog: readJsonIfExists<PostHogExportInput>(path.join(dir, "POSTHOG-EXPORT.json")) ?? undefined,
  };
}

function readJsonIfExists<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}
