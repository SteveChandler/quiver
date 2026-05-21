import fs from "node:fs";

import {
  readSeoDashboard,
} from "../../lib/seo/agent-workflow/dashboard";
import {
  writeSeoRecommendationReport,
} from "../../lib/seo/agent-workflow/recommend";
import type { SeoRecommendation } from "../../lib/seo/agent-workflow/types";

const dashboardPath = getFlag("--dashboard") ?? undefined;
const recommendationInputs = getFlags("--input");
const now = getFlag("--now") ?? new Date().toISOString();
const dashboard = readSeoDashboard(dashboardPath);
const recommendations = recommendationInputs.flatMap((inputPath) =>
  JSON.parse(fs.readFileSync(inputPath, "utf8")) as SeoRecommendation[],
);
const outputPath = writeSeoRecommendationReport(dashboard, recommendations, now);

console.log(JSON.stringify({
  outputPath,
  recommendations: recommendations.length,
  dashboardEntries: dashboard.entries.length,
}, null, 2));

function getFlag(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

function getFlags(name: string): string[] {
  return process.argv
    .map((arg, index) => ({ arg, index }))
    .filter((item) => item.arg === name)
    .map((item) => process.argv[item.index + 1])
    .filter((value): value is string => typeof value === "string");
}
