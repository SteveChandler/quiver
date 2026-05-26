import fs from "node:fs";
import path from "node:path";

import {
  createEmptyDashboard,
  readSeoDashboard,
  writeSeoDashboard,
} from "../../lib/seo/agent-workflow/dashboard";
import { buildKeywordBankDashboard } from "../../lib/seo/agent-workflow/keyword-bank";

const dashboardPath = getFlag("--dashboard") ?? undefined;
const now = getFlag("--now") ?? new Date().toISOString();
const productMarketingContext = readOptionalFile(
  path.join(process.cwd(), ".claude/product-marketing-context.md"),
);

const dashboard = dashboardPath && fs.existsSync(dashboardPath)
  ? readSeoDashboard(dashboardPath)
  : safeReadDefaultDashboard(now);
const nextDashboard = buildKeywordBankDashboard(dashboard, now, {
  productMarketingContext,
});

writeSeoDashboard(nextDashboard, dashboardPath);

console.log(JSON.stringify({
  dashboardPath: dashboardPath ?? "docs/seo/seo-dashboard.json",
  entries: nextDashboard.entries.length,
  proposals: nextDashboard.proposals.length,
  productMarketingContext: Boolean(productMarketingContext),
}, null, 2));

function safeReadDefaultDashboard(nowValue: string) {
  try {
    return readSeoDashboard();
  } catch {
    return createEmptyDashboard(nowValue);
  }
}

function getFlag(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

function readOptionalFile(filePath: string): string | null {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
}
