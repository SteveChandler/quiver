import fs from "node:fs";
import path from "node:path";

import { readSeoDashboard } from "../../lib/seo/agent-workflow/dashboard";
import {
  analyzeTechnicalAudit,
  extractInternalLinks,
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
const MAX_LINK_CHECKS = 40;
const LINK_CHECK_TIMEOUT_MS = 8_000;

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
  const [robotsTxt, sitemapXml] = await Promise.all([
    fetchRequiredText("https://www.quiversurf.app/robots.txt"),
    fetchRequiredText("https://www.quiversurf.app/sitemap.xml"),
  ]);
  const pageUrls = uniqueUrls.map((canonicalPath) => `https://www.quiversurf.app${canonicalPath}`);
  const pageResults = await Promise.allSettled(pageUrls.map(fetchPage));
  const pageResponses = pageResults.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  const unavailablePages = pageResults.flatMap((result, index) => {
    if (result.status === "fulfilled") return [];
    return [{
      url: pageUrls[index] ?? "https://www.quiversurf.app/",
      error: normalizeFetchError(result.reason),
    }];
  });

  const linksByPage = pageResponses.map((page) => ({
    page,
    links: extractInternalLinks(page.html, page.url),
  }));
  const uniqueLinks = [...new Set(linksByPage.flatMap((entry) => entry.links))]
    .slice(0, MAX_LINK_CHECKS);
  const linkStatuses = await checkLinkStatuses(uniqueLinks);

  return {
    robotsTxt,
    sitemapXml,
    pages: linksByPage.map(({ page, links }) => ({
      ...page,
      outgoingLinks: links
        .filter((href) => linkStatuses.has(href))
        .map((href) => ({ href, status: linkStatuses.get(href) })),
    })),
    unavailablePages,
  };
}

async function fetchRequiredText(url: string): Promise<string> {
  try {
    return await fetchTextWithRetry(url);
  } catch (error) {
    throw new Error(`${url}: ${normalizeFetchError(error)}`);
  }
}

async function fetchPage(url: string): Promise<{ url: string; status: number; html: string }> {
  const response = await fetchWithRetry(url);
  return {
    url,
    status: response.status,
    html: await response.text(),
  };
}

async function checkLinkStatuses(urls: string[]): Promise<Map<string, number>> {
  const statuses = new Map<string, number>();
  await Promise.all(urls.map(async (url) => {
    try {
      const response = await fetchWithRetry(
        url,
        { method: "HEAD", redirect: "follow" },
        { timeoutMs: LINK_CHECK_TIMEOUT_MS, retries: 1 },
      );
      statuses.set(url, response.status);
    } catch {
      // Network or timeout errors are inconclusive; skip to avoid false flags.
    }
  }));
  return statuses;
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
