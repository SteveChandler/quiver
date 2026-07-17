import fs from "node:fs";
import path from "node:path";

import {
  readSeoDashboard,
} from "../../lib/seo/agent-workflow/dashboard";
import { currentAuditDate, resolveSeoAuditFile } from "../../lib/seo/agent-workflow/audit-paths";
import { parseGscExport, toGscRefreshInput } from "../../lib/seo/agent-workflow/gsc-export";
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
const watchlistPath = getFlag("--watchlist") ??
  path.join(process.cwd(), "docs", "seo", "ctr-watchlist.json");
const exportInput = parseGscExport(JSON.parse(fs.readFileSync(inputPath, "utf8")) as unknown);
const input = {
  ...toGscRefreshInput(exportInput),
  ctrWatchlist: readCtrWatchlist(watchlistPath),
};
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

function readCtrWatchlist(filePath: string): NonNullable<GscRefreshInput["ctrWatchlist"]> {
  if (!fs.existsSync(filePath)) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
  } catch (error) {
    console.warn(`Skipping invalid CTR watchlist ${filePath}: ${String(error)}`);
    return [];
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.pages)) return [];

  return parsed.pages.flatMap((item) => {
    if (!isRecord(item)) return [];
    const { canonicalPath, label, monitorUntil, reason } = item;
    if (
      typeof canonicalPath !== "string" ||
      typeof label !== "string" ||
      typeof monitorUntil !== "string" ||
      typeof reason !== "string"
    ) {
      return [];
    }
    return [{ canonicalPath, label, monitorUntil, reason }];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
