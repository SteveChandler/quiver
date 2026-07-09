import fs from "node:fs";
import path from "node:path";

import { buildOutreachDigest } from "../../lib/seo/agent-workflow/outreach-digest";
import { currentAuditDate, resolveSeoAuditFile } from "../../lib/seo/agent-workflow/audit-paths";

const auditDate = currentAuditDate();
const outputPath = getFlag("--output") ??
  resolveSeoAuditFile("OUTREACH-DIGEST.json", auditDate);
const trackerPath = getFlag("--tracker") ??
  path.join(process.cwd(), "docs", "seo", "outreach-tracker.md");
const maxCandidates = Number(getFlag("--max") ?? "3");

const markdown = fs.existsSync(trackerPath)
  ? fs.readFileSync(trackerPath, "utf8")
  : "";

const digest = buildOutreachDigest(new Date().toISOString(), {
  reportDate: auditDate,
  markdown,
  maxCandidates: Number.isFinite(maxCandidates) ? maxCandidates : 3,
});

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(digest, null, 2)}\n`);

console.log(JSON.stringify({
  outputPath,
  rotationWeek: digest.rotationWeek,
  rotationCategory: digest.rotationCategory,
  candidates: digest.candidates.length,
  totalRows: digest.totalRows,
}, null, 2));

function getFlag(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}
