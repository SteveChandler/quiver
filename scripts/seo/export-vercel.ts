import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { currentAuditDate, resolveSeoAuditFile } from "../../lib/seo/agent-workflow/audit-paths";
import { buildVercelExport, DEFAULT_BOT_PATHS } from "../../lib/seo/agent-workflow/vercel-export";
import { loadSeoEnv } from "./load-env";
import { fetchWithRetry, isRemoteFetchError, normalizeFetchError } from "./resilient-fetch";

loadSeoEnv();

const outputPath = getFlag("--output") ??
  resolveSeoAuditFile("VERCEL-EXPORT.json", currentAuditDate());
const projectId = process.env.VERCEL_PROJECT_ID ?? "prj_z7DDSIF65y1EbOfuDrZfYsx9Mmbx";
const token = process.env.VERCEL_TOKEN ?? readVercelCliToken();
const { from, to } = defaultDateRange();

void main();

async function main(): Promise<void> {
  if (!token) {
    writeJson({
      generatedAt: new Date().toISOString(),
      dateRange: { from, to },
      rawPageViews: 0,
      adjustedPageViews: 0,
      botPageViews: 0,
      pages: [],
      referrers: [],
      countries: [],
      devices: [],
      missing: ["VERCEL_TOKEN or ~/Library/Application Support/com.vercel.cli/auth.json token"],
    });
    return;
  }

  const result = await Promise.all([
    fetchVercel("overview"),
    fetchVercel("timeseries", { groupBy: "path", limit: "20" }),
    fetchVercel("timeseries", { groupBy: "referrer", limit: "20" }),
    fetchVercel("timeseries", { groupBy: "country", limit: "15" }),
    fetchVercel("timeseries", { groupBy: "device_type" }),
    ...DEFAULT_BOT_PATHS.map((botPath) =>
      fetchVercel("overview", {
        filter: JSON.stringify({ path: { operator: "eq", values: [botPath] } }),
      }),
    ),
  ]).then((responses) => {
    const [overview, pages, referrers, countries, devices, ...botOverviews] = responses;
    return buildVercelExport(
      { overview, pages, referrers, countries, devices, botOverviews },
      new Date().toISOString(),
      { from, to },
    );
  }).catch((error) => {
    if (!isRemoteFetchError(error)) throw error;
    return {
      generatedAt: new Date().toISOString(),
      dateRange: { from, to },
      rawPageViews: 0,
      adjustedPageViews: 0,
      botPageViews: 0,
      pages: [],
      referrers: [],
      countries: [],
      devices: [],
      missing: [`Vercel export fetch failed: ${normalizeFetchError(error)}`],
    };
  });

  writeJson(result);
}

async function fetchVercel(endpoint: string, params: Record<string, string> = {}): Promise<unknown> {
  const url = new URL(`https://vercel.com/api/web-analytics/${endpoint}`);
  url.searchParams.set("projectId", projectId);
  url.searchParams.set("environment", "production");
  url.searchParams.set("from", from);
  url.searchParams.set("to", to);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetchWithRetry(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Vercel ${endpoint} failed: ${response.status}`);
  return response.json();
}

function readVercelCliToken(): string | null {
  const authPath = path.join(os.homedir(), "Library/Application Support/com.vercel.cli/auth.json");
  if (!fs.existsSync(authPath)) return null;
  const parsed = JSON.parse(fs.readFileSync(authPath, "utf8")) as { token?: string };
  return parsed.token ?? null;
}

function defaultDateRange(): { from: string; to: string } {
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  return {
    from: start.toISOString().slice(0, 19),
    to: end.toISOString().slice(0, 19),
  };
}

function writeJson(value: unknown): void {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(value, null, 2)}\n`);
  console.log(JSON.stringify({ outputPath }, null, 2));
}

function getFlag(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}
