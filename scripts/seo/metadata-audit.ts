import fs from "node:fs";
import path from "node:path";

import { currentAuditDate, resolveSeoAuditFile } from "../../lib/seo/agent-workflow/audit-paths";
import { analyzeSeoMetadataAudit } from "../../lib/seo/agent-workflow/metadata-audit";
import { INDEXABLE_SEO_FUNNEL_PAGES } from "../../lib/seo/funnel-pages";

const outputPath = getFlag("--output") ??
  resolveSeoAuditFile("SEO-METADATA-AUDIT.json", currentAuditDate());
const generatedAt = getFlag("--generated-at") ?? new Date().toISOString();

const audit = analyzeSeoMetadataAudit(
  INDEXABLE_SEO_FUNNEL_PAGES.map((page) => ({
    path: page.path,
    title: page.title,
    metaDescription: page.metaDescription,
  })),
  generatedAt,
);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(audit, null, 2)}\n`);

console.log(JSON.stringify({
  outputPath,
  checkedPages: audit.checkedPages,
  issues: audit.issues.length,
  recommendations: audit.recommendations.length,
}, null, 2));

function getFlag(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}
