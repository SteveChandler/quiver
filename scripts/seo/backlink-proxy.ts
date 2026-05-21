import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

import {
  buildBacklinkProxy,
  discoverManualBacklinkExportFiles,
  discoverManualBacklinkExports,
} from "../../lib/seo/agent-workflow/backlink-proxy";
import { currentAuditDate, resolveSeoAuditFile } from "../../lib/seo/agent-workflow/audit-paths";
import type { VercelExportInput, VercelReferrerMetric } from "../../lib/seo/agent-workflow/types";
import { loadSeoEnv } from "./load-env";

loadSeoEnv();

const auditDate = currentAuditDate();
const outputPath = getFlag("--output") ??
  resolveSeoAuditFile("BACKLINK-PROXY.json", auditDate);
const vercelPath = getFlag("--vercel") ??
  resolveSeoAuditFile("VERCEL-EXPORT.json", auditDate);
const outreachPath = path.join(process.cwd(), "docs", "seo", "outreach-tracker.md");
const auditDir = path.dirname(outputPath);
const manualExportPaths = getFlags("--manual");

void main();

async function main(): Promise<void> {
  const missing: string[] = [];
  const vercel = readJsonIfExists<VercelExportInput>(vercelPath);
  if (!vercel) missing.push(vercelPath);

  const embedReferrers = await fetchEmbedReferrers(missing);
  const outreachMarkdown = fs.existsSync(outreachPath)
    ? fs.readFileSync(outreachPath, "utf8")
    : "";
  if (!outreachMarkdown) missing.push(outreachPath);

  const manualExportFiles = discoverManualBacklinkExportFiles(
    [
      auditDir,
      path.join(process.cwd(), "docs", "seo", "backlink-reports"),
    ],
    [
      ...manualExportPaths,
      ...envList("BACKLINK_MANUAL_EXPORT_PATHS"),
      path.join(process.cwd(), "docs", "seo", "backlink-reports", "ahrefs.csv"),
      path.join(process.cwd(), "docs", "seo", "backlink-reports", "moz.csv"),
      path.join(auditDir, "AHREFS-WEBMASTER-TOOLS.csv"),
      path.join(auditDir, "MOZ-LINK-EXPLORER.csv"),
      path.join(auditDir, "GSC-LINKS.csv"),
      path.join(auditDir, "GOOGLE-SEARCH-CONSOLE-LINKS.csv"),
      path.join(auditDir, "MANUAL-BACKLINKS.csv"),
      path.join(auditDir, "BACKLINKS.csv"),
    ],
  );
  const manualExports = discoverManualBacklinkExports(manualExportFiles, missing);

  writeJson(buildBacklinkProxy(new Date().toISOString(), {
    vercel: vercel ?? undefined,
    embedReferrers,
    outreachMarkdown,
    manualExports,
    competitorDeltas: readCompetitorDeltas(),
    missing,
  }));
}

async function fetchEmbedReferrers(missing: string[]): Promise<VercelReferrerMetric[]> {
  const supabaseUrl = resolveSupabaseUrl();
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRole) {
    missing.push("SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for embed_impressions read");
    return [];
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false },
  });
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("embed_impressions")
    .select("referrer_domain")
    .gte("created_at", since)
    .not("referrer_domain", "is", null);

  if (error) {
    missing.push(`embed_impressions read failed: ${error.message}`);
    return [];
  }

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const referrer = typeof row.referrer_domain === "string" ? row.referrer_domain : "";
    if (!referrer) continue;
    counts.set(referrer, (counts.get(referrer) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([referrer, visits]) => ({ referrer, visits }))
    .sort((a, b) => b.visits - a.visits);
}

function resolveSupabaseUrl(): string | undefined {
  const privateUrl = process.env.SUPABASE_URL;
  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (publicUrl && !isLocalhostUrl(publicUrl)) return publicUrl;
  return privateUrl ?? publicUrl;
}

function isLocalhostUrl(value: string): boolean {
  return value.includes("127.0.0.1") || value.includes("localhost");
}

function readCompetitorDeltas(): string[] {
  const memoryPath = "/Users/stevenchandler/.codex/automations/competitor-research-refresh/memory.md";
  if (!fs.existsSync(memoryPath)) return [];
  return fs.readFileSync(memoryPath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.startsWith("- "))
    .slice(-12);
}

function readJsonIfExists<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
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

function getFlags(name: string): string[] {
  return process.argv.flatMap((value, index) =>
    value === name && process.argv[index + 1] ? [process.argv[index + 1] as string] : [],
  );
}

function envList(name: string): string[] {
  return (process.env[name] ?? "").split(path.delimiter).map((value) => value.trim()).filter(Boolean);
}
