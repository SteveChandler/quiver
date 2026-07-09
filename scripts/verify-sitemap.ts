#!/usr/bin/env tsx
/**
 * Walks https://www.quiversurf.app/sitemap.xml and probes every <loc> URL.
 * Records 200 / redirect / 4xx / 5xx, groups by URL pattern, and exits 1 if
 * any URL is not a 200 indexable self-canonical page (writing offenders to
 * /tmp/sitemap-verify-<ts>.json).
 *
 * Usage:
 *   npx tsx scripts/verify-sitemap.ts                 # walk prod
 *   SITE_URL=https://dev.quiversurf.app npx tsx scripts/verify-sitemap.ts
 */

import { writeFileSync } from "node:fs";

const SITE_URL = process.env.SITE_URL || "https://www.quiversurf.app";
const SITEMAP_URL = `${SITE_URL}/sitemap.xml`;
const CONCURRENCY = Number(process.env.CONCURRENCY || 10);
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 15_000);
const USER_AGENT =
  "Mozilla/5.0 (compatible; QuiverSitemapVerifier/1.0; +https://www.quiversurf.app)";

type ProbeResult = {
  url: string;
  status: number;
  pattern: string;
  canonical?: string;
  indexable?: boolean;
  selfCanonical?: boolean;
  redirectTo?: string;
  finalStatus?: number;
  error?: string;
  durationMs: number;
};

export function classifyPattern(url: string): string {
  try {
    const path = new URL(url).pathname;
    const seg = path.split("/").filter(Boolean);
    if (seg.length === 0) return "/";
    const first = seg[0];
    if (
      [
        "water-temp",
        "tide",
        "sunset",
        "dawn-patrol",
        "least-crowded",
        "beginner",
        "longboard",
      ].includes(first)
    ) {
      return seg.length === 2 ? `/${first}/[city]` : `/${first}/[city]/...`;
    }
    if (first === "guides") return seg.length === 2 ? "/guides/[slug]" : "/guides/...";
    if (first === "beach") return "/beach/...";
    if (first === "spots") return "/spots/[slug]";
    if (first === "learn") return "/learn/[slug]";
    if (first === "best-time-to-surf") return "/best-time-to-surf/[city]";
    if (first === "beaches") return "/beaches/...";
    if (first === "mexico") return "/mexico/...";
    if (first === "embed") return "/embed/...";
    if (/^[a-z]{2}$/.test(first)) return `/${first}/[city]/[beach]`;
    return seg.length === 1 ? `/${first}` : `/${first}/...`;
  } catch {
    return "(invalid)";
  }
}

export function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

async function fetchXml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Sitemap fetch failed (${res.status}): ${url}`);
  return res.text();
}

async function fetchSitemap(): Promise<string[]> {
  const xml = await fetchXml(SITEMAP_URL);
  if (xml.includes("<sitemapindex")) {
    const childSitemaps = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
      decodeXml(m[1].trim())
    );
    console.error(`Sitemap index detected with ${childSitemaps.length} children.`);
    const all: string[] = [];
    for (const child of childSitemaps) {
      try {
        const childXml = await fetchXml(child);
        for (const m of childXml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
          all.push(decodeXml(m[1].trim()));
        }
      } catch (err) {
        console.error(`  child sitemap fetch failed: ${child}`, err);
      }
    }
    return all;
  }
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
    decodeXml(m[1].trim())
  );
}

async function probe(url: string): Promise<ProbeResult> {
  const start = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*" },
      signal: ctrl.signal,
    });
    const result: ProbeResult = {
      url,
      status: res.status,
      pattern: classifyPattern(url),
      durationMs: Date.now() - start,
    };
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (loc) {
        result.redirectTo = loc;
      }
    }
    if (res.status >= 200 && res.status < 300) {
      const html = await res.text();
      result.canonical = extractCanonicalHref(html, url);
      result.indexable = isIndexableResponse(
        html,
        res.headers.get("x-robots-tag"),
      );
      result.selfCanonical = isSelfCanonical(url, result.canonical);
    }
    return result;
  } catch (err) {
    return {
      url,
      status: -1,
      pattern: classifyPattern(url),
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function extractCanonicalHref(html: string, baseUrl: string): string | undefined {
  const linkTags = html.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of linkTags) {
    const attrs = readHtmlAttributes(tag);
    const rel = attrs.get("rel")?.toLowerCase();
    const href = attrs.get("href");
    if (!rel?.split(/\s+/).includes("canonical") || !href) {
      continue;
    }

    try {
      return new URL(href, baseUrl).toString();
    } catch {
      return href;
    }
  }

  return undefined;
}

export function isIndexableResponse(
  html: string,
  xRobotsTag: string | null = null,
): boolean {
  if (hasNoindexToken(xRobotsTag)) {
    return false;
  }

  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of metaTags) {
    const attrs = readHtmlAttributes(tag);
    const name = attrs.get("name")?.toLowerCase();
    if (name !== "robots" && name !== "googlebot") {
      continue;
    }

    const content = attrs.get("content")?.toLowerCase() ?? "";
    if (hasNoindexToken(content)) {
      return false;
    }
  }

  return true;
}

function hasNoindexToken(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  return value
    .toLowerCase()
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .includes("noindex");
}

export function isSelfCanonical(url: string, canonical: string | undefined): boolean {
  if (!canonical) {
    return false;
  }

  try {
    return normalizeComparableUrl(url) === normalizeComparableUrl(canonical);
  } catch {
    return url === canonical;
  }
}

function readHtmlAttributes(tag: string): Map<string, string> {
  const attrs = new Map<string, string>();
  const attrPattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(["'])(.*?)\2/g;
  for (const match of tag.matchAll(attrPattern)) {
    attrs.set(match[1].toLowerCase(), match[3]);
  }
  return attrs;
}

function normalizeComparableUrl(value: string): string {
  const url = new URL(value);
  const pathname =
    url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : url.pathname;
  return `${url.origin}${pathname}`;
}

async function runPool<T>(items: T[], worker: (item: T) => Promise<ProbeResult>) {
  const results: ProbeResult[] = [];
  let cursor = 0;
  let done = 0;
  const total = items.length;
  const next = async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      const r = await worker(items[idx]);
      results.push(r);
      done++;
      if (done % 100 === 0 || done === total) {
        process.stderr.write(`  probed ${done}/${total}\n`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, next));
  return results;
}

export function isOk(r: ProbeResult): boolean {
  return r.status >= 200 && r.status < 300 &&
    r.indexable === true &&
    r.selfCanonical === true;
}

function main() {
  console.error(`Fetching sitemap: ${SITEMAP_URL}`);
  return fetchSitemap().then(async (urls) => {
    console.error(`Found ${urls.length} URLs. Probing with concurrency=${CONCURRENCY}.`);
    const results = await runPool(urls, probe);

    const byPattern = new Map<string, { ok: number; bad: number; samples: ProbeResult[] }>();
    for (const r of results) {
      const bucket = byPattern.get(r.pattern) ?? { ok: 0, bad: 0, samples: [] };
      if (isOk(r)) bucket.ok++;
      else {
        bucket.bad++;
        if (bucket.samples.length < 5) bucket.samples.push(r);
      }
      byPattern.set(r.pattern, bucket);
    }

    const totalOk = results.filter(isOk).length;
    const totalBad = results.length - totalOk;

    console.log("\nResults by pattern:");
    const rows = [...byPattern.entries()].sort((a, b) => b[1].bad - a[1].bad);
    for (const [pattern, stats] of rows) {
      const flag = stats.bad > 0 ? "FAIL" : " ok ";
      console.log(`  [${flag}] ${pattern.padEnd(32)} ok=${stats.ok}  bad=${stats.bad}`);
    }

    console.log(`\nTotal: ${totalOk} OK / ${totalBad} unhealthy out of ${results.length}`);

    if (totalBad > 0) {
      const offenders = results.filter((r) => !isOk(r));
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const outPath = `/tmp/sitemap-verify-${ts}.json`;
      writeFileSync(outPath, JSON.stringify({ totalOk, totalBad, offenders }, null, 2));
      console.error(`\nWrote ${offenders.length} offenders to ${outPath}`);
      process.exit(1);
    }
  });
}

if (!process.env.JEST_WORKER_ID) {
  main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(2);
  });
}
