#!/usr/bin/env tsx

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import pLimit from "p-limit";

import {
  buildSurfersViewApplyBatches,
  extractSurfersViewCamUrlsFromSitemapXml,
  finalizeSurfersViewImportRows,
  isAllowedSurfersViewLiveCamPage,
  matchSurfersViewCamToBeach,
  parseSurfersViewCamPage,
  toSurfersViewCamCsv,
  type QuiverBeachForMatching,
  type SurfersViewCamImportRow,
  type SurfersViewCamRecord,
} from "@/lib/importers/surfers-view-cams";
import type { Database } from "@/types/database.generated";

const SITE_ORIGIN = "https://thesurfersview.com";
const ROBOTS_URL = `${SITE_ORIGIN}/robots.txt`;
const SITEMAP_INDEX_URL = `${SITE_ORIGIN}/sitemap_index.xml`;
const DEFAULT_CONCURRENCY = 4;
const FETCH_TIMEOUT_MS = 20_000;

interface CliOptions {
  apply: boolean;
  concurrency: number;
  limit: number | null;
  outDir: string;
  skipDb: boolean;
}

interface RobotsRules {
  disallow: string[];
}

interface Summary {
  discovered: number;
  parsed: number;
  matched: number;
  needsReview: number;
  candidateNew: number;
  applied: number;
}

config({ path: ".env.local" });
config();

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const robots = await loadRobotsRules();

  assertRobotsAllowed(new URL(SITEMAP_INDEX_URL).pathname, robots);
  const pageSitemapUrls = await discoverPageSitemapUrls(robots);
  const camUrls = await discoverCamUrls(pageSitemapUrls, robots);
  const selectedCamUrls = options.limit ? camUrls.slice(0, options.limit) : camUrls;
  const camRecords = await fetchCamRecords(selectedCamUrls, robots, options.concurrency);
  const beaches = options.skipDb ? [] : await loadQuiverBeaches();
  const rows = finalizeSurfersViewImportRows(
    camRecords.map((cam) => matchSurfersViewCamToBeach(cam, beaches))
  );

  await writeArtifacts(options.outDir, rows);

  const applied = options.apply ? await applyMatchedRows(rows) : 0;
  const summary = buildSummary(camUrls.length, rows, applied);
  printSummary(summary, options);
}

function parseArgs(args: string[]): CliOptions {
  const parsed = new Map<string, string>();

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith("--")) continue;

    const [rawKey, rawValue] = arg.slice(2).split("=");
    if (rawValue !== undefined) {
      parsed.set(rawKey, rawValue);
      continue;
    }

    const next = args[i + 1];
    if (next && !next.startsWith("--")) {
      parsed.set(rawKey, next);
      i += 1;
      continue;
    }

    parsed.set(rawKey, "true");
  }

  const concurrency = Number(parsed.get("concurrency") ?? DEFAULT_CONCURRENCY);
  const limitArg = parsed.get("limit");
  const limit = limitArg ? Number(limitArg) : null;

  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("--concurrency must be a positive integer");
  }
  if (limit !== null && (!Number.isInteger(limit) || limit < 1)) {
    throw new Error("--limit must be a positive integer");
  }
  if (parsed.get("apply") === "true" && parsed.get("skip-db") === "true") {
    throw new Error("--apply cannot be combined with --skip-db");
  }

  return {
    apply: parsed.get("apply") === "true",
    concurrency,
    limit,
    outDir:
      parsed.get("out-dir") ??
      path.join(
        process.cwd(),
        "docs/imports/surfers-view-cams",
        new Date().toISOString().slice(0, 10)
      ),
    skipDb: parsed.get("skip-db") === "true",
  };
}

async function loadRobotsRules(): Promise<RobotsRules> {
  const robotsText = await fetchText(ROBOTS_URL);
  return parseRobotsRules(robotsText);
}

function parseRobotsRules(robotsText: string): RobotsRules {
  const disallow: string[] = [];
  let appliesToAllAgents = false;

  for (const line of robotsText.split(/\r?\n/)) {
    const withoutComment = line.split("#")[0]?.trim() ?? "";
    if (!withoutComment) continue;

    const [rawKey, ...rawValueParts] = withoutComment.split(":");
    const key = rawKey.trim().toLowerCase();
    const value = rawValueParts.join(":").trim();

    if (key === "user-agent") {
      appliesToAllAgents = value === "*";
      continue;
    }
    if (appliesToAllAgents && key === "disallow" && value) {
      disallow.push(value);
    }
  }

  return { disallow };
}

async function discoverPageSitemapUrls(robots: RobotsRules): Promise<string[]> {
  const sitemapIndexXml = await fetchText(SITEMAP_INDEX_URL);
  const urls = extractXmlLocs(sitemapIndexXml).filter((url) => {
    try {
      const parsed = new URL(url);
      return parsed.origin === SITE_ORIGIN && parsed.pathname.includes("page-sitemap");
    } catch {
      return false;
    }
  });

  for (const url of urls) {
    assertRobotsAllowed(new URL(url).pathname, robots);
  }

  return urls;
}

async function discoverCamUrls(
  pageSitemapUrls: string[],
  robots: RobotsRules
): Promise<string[]> {
  const sitemapXmls = await Promise.all(pageSitemapUrls.map((url) => fetchText(url)));
  const seen = new Set<string>();
  const camUrls = sitemapXmls.flatMap((xml) =>
    extractSurfersViewCamUrlsFromSitemapXml(xml)
  );

  return camUrls.filter((url) => {
    if (seen.has(url)) return false;
    seen.add(url);
    assertRobotsAllowed(new URL(url).pathname, robots);
    return true;
  });
}

async function fetchCamRecords(
  camUrls: string[],
  robots: RobotsRules,
  concurrency: number
): Promise<SurfersViewCamRecord[]> {
  const limit = pLimit(concurrency);
  const records = await Promise.all(
    camUrls.map((sourcePageUrl) =>
      limit(async () => {
        if (!isAllowedSurfersViewLiveCamPage(sourcePageUrl)) {
          throw new Error(`Refusing to fetch disallowed cam URL: ${sourcePageUrl}`);
        }
        assertRobotsAllowed(new URL(sourcePageUrl).pathname, robots);
        try {
          const html = await fetchText(sourcePageUrl, 3);
          return parseSurfersViewCamPage({ sourcePageUrl, html });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`Unable to fetch ${sourcePageUrl}: ${message}`);
          return buildFallbackCamRecord(sourcePageUrl);
        }
      })
    )
  );

  return records.sort((a, b) => a.source_page_url.localeCompare(b.source_page_url));
}

async function loadQuiverBeaches(): Promise<QuiverBeachForMatching[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "Supabase env is required for matching. Set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL plus SUPABASE_SERVICE_ROLE_KEY, or pass --skip-db."
    );
  }

  const supabase = createClient<Database>(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
  const { data, error } = await supabase
    .from("beaches")
    .select("id,name,slug,city,state,country")
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to load Quiver beaches: ${error.message}`);
  }

  return (data ?? []).map((beach) => ({
    id: beach.id,
    name: beach.name,
    slug: beach.slug,
    city: beach.city,
    state: beach.state,
    country: beach.country,
  }));
}

async function applyMatchedRows(rows: SurfersViewCamImportRow[]): Promise<number> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "--apply requires NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL plus SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  const matchedRows = rows.filter(
    (row) => row.match_status === "matched" && row.quiver_beach_id
  );
  if (matchedRows.length === 0) return 0;
  const applyBatches = buildSurfersViewApplyBatches(rows);

  const supabase = createClient<Database>(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
  const { error } = await supabase.from("beach_sources").upsert(
    applyBatches.cameraRows,
    { onConflict: "beach_id" }
  );

  if (error) {
    throw new Error(`Failed to upsert beach_sources rows: ${error.message}`);
  }

  if (applyBatches.thumbnailRows.length > 0) {
    const { error: thumbnailError } = await supabase.from("beach_sources").upsert(
      applyBatches.thumbnailRows,
      { onConflict: "beach_id" }
    );

    if (thumbnailError) {
      throw new Error(
        `Failed to upsert beach_sources thumbnails: ${thumbnailError.message}`
      );
    }
  }

  return matchedRows.length;
}

async function writeArtifacts(
  outDir: string,
  rows: SurfersViewCamImportRow[]
): Promise<void> {
  await mkdir(outDir, { recursive: true });
  await Promise.all([
    writeFile(
      path.join(outDir, "surfers-view-cams.json"),
      JSON.stringify(rows, null, 2) + "\n"
    ),
    writeFile(path.join(outDir, "surfers-view-cams.csv"), toSurfersViewCamCsv(rows)),
  ]);
}

function buildSummary(
  discovered: number,
  rows: SurfersViewCamImportRow[],
  applied: number
): Summary {
  return {
    discovered,
    parsed: rows.length,
    matched: rows.filter((row) => row.match_status === "matched").length,
    needsReview: rows.filter((row) => row.match_status === "needs_review").length,
    candidateNew: rows.filter((row) => row.match_status === "candidate_new").length,
    applied,
  };
}

function printSummary(summary: Summary, options: CliOptions): void {
  console.log(
    JSON.stringify(
      {
        mode: options.apply ? "apply" : "dry-run",
        output_dir: options.outDir,
        ...summary,
      },
      null,
      2
    )
  );
}

function assertRobotsAllowed(pathname: string, robots: RobotsRules): void {
  const blockedBy = robots.disallow.find((rule) => {
    if (rule === "/") return true;
    return pathname.startsWith(rule);
  });

  if (blockedBy) {
    throw new Error(`Robots.txt disallows ${pathname} via ${blockedBy}`);
  }
}

function extractXmlLocs(xml: string): string[] {
  return Array.from(
    xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi),
    (match) => decodeXmlEntities(match[1] ?? "").trim()
  ).filter(Boolean);
}

async function fetchText(url: string, attempts = 2): Promise<string> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "QuiverSurf/1.0 webcam import contact=support@quiversurf.app",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} fetching ${url}`);
      }

      return await response.text();
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Failed to fetch ${url}`);
}

function buildFallbackCamRecord(sourcePageUrl: string): SurfersViewCamRecord {
  const parsed = new URL(sourcePageUrl);
  const segments = parsed.pathname.replace(/\/+$/g, "").split("/").filter(Boolean);
  const regionSlug = segments[1] ?? "";
  const pageSlug = segments[2] ?? "unknown";
  const spotName = titleizeSlug(
    pageSlug.replace(
      /-(?:webcam|web-cam|surf-cam|live-cam|cam)(?:-and-surf-report|-surf-report|-beach-report)?$/i,
      ""
    )
  );

  return {
    source_page_url: sourcePageUrl,
    title: `${spotName} - The Surfers View`,
    spot_name: spotName,
    region_slug: regionSlug,
    provider: "The Surfers View",
    thumbnail_url: null,
    audit_stream_url: null,
    fetch_status: "fetch_failed",
    import_camera_url: sourcePageUrl,
    source_rights_status: "public_linkout",
    licensed_override_note: null,
    stream_import_allowed: false,
  };
}

function titleizeSlug(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
