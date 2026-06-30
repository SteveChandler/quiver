import fs from "node:fs";
import path from "node:path";

import {
  buildCompetitorIntelligence,
  readLatestCompetitorIntelligence,
} from "../../lib/seo/agent-workflow/competitor-intelligence";
import { currentAuditDate, resolveSeoAuditFile } from "../../lib/seo/agent-workflow/audit-paths";

const outputPath = getFlag("--output") ??
  resolveSeoAuditFile("COMPETITOR-EXPORT.json", currentAuditDate());

void main();

async function main(): Promise<void> {
  const latest = readLatestCompetitorIntelligence();
  const result = latest ?? buildCompetitorIntelligence(new Date().toISOString(), {
    missing: ["competitor-research-refresh report.md unavailable"],
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({
    outputPath,
    runId: result.runId ?? null,
    technicalSurfaces: result.technicalSurfaces.length,
    comparisonSignals: result.comparisonSignals.length,
  }, null, 2));
}

function getFlag(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}
