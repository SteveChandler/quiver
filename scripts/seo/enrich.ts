import fs from "node:fs";
import path from "node:path";

import {
  analyzeSeoEnrichment,
} from "../../lib/seo/agent-workflow/enrichment";
import { currentAuditDate, resolveSeoAuditFile } from "../../lib/seo/agent-workflow/audit-paths";
import type {
  SeoEnrichmentInput,
  SeoEnrichmentSource,
} from "../../lib/seo/agent-workflow/types";

const inputPath = getFlag("--input");
if (!inputPath) throw new Error("Missing --input path to enrichment JSON.");

const source = getFlag("--source") as SeoEnrichmentSource | null;
if (source !== "vercel" && source !== "posthog" && source !== "ahrefs") {
  throw new Error("Missing or invalid --source. Use vercel, posthog, or ahrefs.");
}

const outputPath = getFlag("--output") ??
  resolveSeoAuditFile(`${source.toUpperCase()}-ENRICHMENT.json`, currentAuditDate());
const now = getFlag("--now") ?? new Date().toISOString();
const parsedInput = JSON.parse(fs.readFileSync(inputPath, "utf8")) as Omit<SeoEnrichmentInput, "source">;
const recommendations = analyzeSeoEnrichment({ ...parsedInput, source }, now);

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
