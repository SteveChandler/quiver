import fs from "node:fs";
import path from "node:path";

import { readSeoDashboard } from "../../lib/seo/agent-workflow/dashboard";
import {
  analyzeTechnicalAudit,
} from "../../lib/seo/agent-workflow/technical-audit";
import { currentAuditDate, resolveSeoAuditFile } from "../../lib/seo/agent-workflow/audit-paths";
import type { TechnicalAuditInput } from "../../lib/seo/agent-workflow/types";
import {
  fetchTextWithRetry,
  fetchWithRetry,
  isRemoteFetchError,
  normalizeFetchError,
} from "./resilient-fetch";

const dashboardPath = getFlag("--dashboard") ?? undefined;
const outputPath = getFlag("--output") ??
  resolveSeoAuditFile("TECHNICAL-AUDIT.json", currentAuditDate());
const now = getFlag("--now") ?? new Date().toISOString();
const fixturePath = getFlag("--input");

void main();

async function main(): Promise<void> {
  let recommendations;
  try {
    const input = fixturePath
      ? JSON.parse(fs.readFileSync(fixturePath, "utf8")) as TechnicalAuditInput
      : await fetchLiveInput(dashboardPath);
    recommendations = analyzeTechnicalAudit(input, now);
  } catch (error) {
    if (!isRemoteFetchError(error)) throw error;
    recommendations = [buildFetchFailureRecommendation(error)];
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(recommendations, null, 2)}\n`);

  console.log(JSON.stringify({
    outputPath,
    recommendations: recommendations.length,
  }, null, 2));
}

async function fetchLiveInput(dashboardFilePath?: string): Promise<TechnicalAuditInput> {
  const dashboard = readSeoDashboard(dashboardFilePath);
  const urls = [
    "/",
    ...dashboard.entries.slice(0, 10).map((entry) => entry.canonicalPath),
  ];
  const uniqueUrls = [...new Set(urls)];
  const [robotsTxt, sitemapXml, ...pageResponses] = await Promise.all([
    fetchTextWithRetry("https://www.quiversurf.app/robots.txt"),
    fetchTextWithRetry("https://www.quiversurf.app/sitemap.xml"),
    ...uniqueUrls.map(async (canonicalPath) => {
      const url = `https://www.quiversurf.app${canonicalPath}`;
      const response = await fetchWithRetry(url);
      return {
        url,
        status: response.status,
        html: await response.text(),
      };
    }),
  ]);

  return {
    robotsTxt,
    sitemapXml,
    pages: pageResponses,
  };
}

function buildFetchFailureRecommendation(error: unknown) {
  const detail = normalizeFetchError(error);
  return {
    id: `technical-audit-fetch-failure-${now.slice(0, 10)}`,
    createdAt: now,
    source: "technical-audit" as const,
    priority: "high" as const,
    canonicalPath: "/",
    summary: "Technical crawl unavailable due to network/fetch failure.",
    evidence: [detail],
    status: "open" as const,
  };
}

function getFlag(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}
