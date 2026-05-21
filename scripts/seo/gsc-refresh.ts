import fs from "node:fs";
import path from "node:path";

import {
  readSeoDashboard,
} from "../../lib/seo/agent-workflow/dashboard";
import { currentAuditDate, resolveSeoAuditFile } from "../../lib/seo/agent-workflow/audit-paths";
import { analyzeGscRefresh } from "../../lib/seo/agent-workflow/gsc-refresh";
import type { GscRefreshInput } from "../../lib/seo/agent-workflow/types";

const inputPath = getFlag("--input");
if (!inputPath) {
  throw new Error("Missing --input path to a GSC JSON export.");
}

const dashboardPath = getFlag("--dashboard") ?? undefined;
const outputPath = getFlag("--output") ??
  resolveSeoAuditFile("GSC-REFRESH.json", currentAuditDate());
const now = getFlag("--now") ?? new Date().toISOString();
const input = JSON.parse(fs.readFileSync(inputPath, "utf8")) as GscRefreshInput;
const dashboard = readSeoDashboard(dashboardPath);
const recommendations = analyzeGscRefresh(input, dashboard, now);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(recommendations, null, 2)}\n`);

console.log(JSON.stringify({
  outputPath,
  recommendations: recommendations.length,
}, null, 2));

function getFlag(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}
