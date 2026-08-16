import * as Sentry from "@sentry/nextjs";

import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from "@/lib/middleware/api-wrappers";
import { SITE_URL } from "@/lib/constants/seo";
import {
  startCronCheckIn,
  completeCronCheckIn,
} from "@/lib/monitoring/sentry-cron";
import { withObservedCron } from "@/lib/cron/observability";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const SCHEDULE = "15 6 * * *";
const MONITOR_SLUG = "sitemap-health";
const PROBE_TIMEOUT_MS = 5_000;
const CONCURRENCY = 12;
const CITY_SLICE_SIZE = 75;
const ERROR_THRESHOLD = 3;
const PROBE_USER_AGENT =
  "Mozilla/5.0 (compatible; QuiverSitemapHealth/1.0; +https://www.quiversurf.app)";

const INTENTS = new Set([
  "beginner",
  "least-crowded",
  "tide",
  "water-temp",
  "longboard",
  "dawn-patrol",
  "sunset",
]);

const US_STATE_SLUG_RE = /^[a-z]{2}$/;

type SitemapBucket = {
  guides: string[];
  stateIntent: string[];
  cityIntent: string[];
};

type ProbeOutcome = {
  url: string;
  status: number;
  pattern: string;
  error?: string;
};

function classifyPattern(url: string): string {
  try {
    const seg = new URL(url).pathname.split("/").filter(Boolean);
    if (seg.length === 0) return "/";
    const first = seg[0];
    if (INTENTS.has(first)) {
      return seg.length === 2 ? `/${first}/[city]` : `/${first}/...`;
    }
    if (first === "guides") return "/guides/[slug]";
    return `/${first}/...`;
  } catch {
    return "(invalid)";
  }
}

function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

async function fetchSitemapText(url: string): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS * 2);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": PROBE_USER_AGENT },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function loadSitemapUrls(): Promise<string[]> {
  const xml = await fetchSitemapText(`${SITE_URL}/sitemap.xml`);
  if (!xml) return [];
  if (xml.includes("<sitemapindex")) {
    const childSitemaps = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map((m) => decodeXml(m[1].trim()))
      .slice(0, 50);
    const all: string[] = [];
    for (const child of childSitemaps) {
      const childXml = await fetchSitemapText(child);
      if (!childXml) continue;
      for (const m of childXml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
        all.push(decodeXml(m[1].trim()));
      }
    }
    return all;
  }
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
    decodeXml(m[1].trim())
  );
}

function bucketSitemap(urls: string[]): SitemapBucket {
  const bucket: SitemapBucket = { guides: [], stateIntent: [], cityIntent: [] };
  for (const url of urls) {
    let path: string;
    try {
      path = new URL(url).pathname;
    } catch {
      continue;
    }
    const seg = path.split("/").filter(Boolean);
    if (seg.length === 2 && seg[0] === "guides") {
      bucket.guides.push(url);
      continue;
    }
    if (seg.length === 2 && INTENTS.has(seg[0])) {
      if (US_STATE_SLUG_RE.test(seg[1])) bucket.stateIntent.push(url);
      else bucket.cityIntent.push(url);
    }
  }
  return bucket;
}

async function probe(url: string): Promise<ProbeOutcome> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": PROBE_USER_AGENT, Accept: "text/html,*/*" },
      signal: ctrl.signal,
    });
    return { url, status: res.status, pattern: classifyPattern(url) };
  } catch (err) {
    return {
      url,
      status: -1,
      pattern: classifyPattern(url),
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function runPool(urls: string[]): Promise<ProbeOutcome[]> {
  const results: ProbeOutcome[] = [];
  let cursor = 0;
  const next = async () => {
    while (cursor < urls.length) {
      const idx = cursor++;
      results.push(await probe(urls[idx]));
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, next));
  return results;
}

function pickRotatingSlice<T>(items: T[], size: number, dayIndex: number): T[] {
  if (items.length === 0) return [];
  if (items.length <= size) return items;
  const stride = size;
  const start = (dayIndex * stride) % items.length;
  if (start + size <= items.length) return items.slice(start, start + size);
  return [...items.slice(start), ...items.slice(0, size - (items.length - start))];
}

/**
 * GET /api/cron/sitemap-health
 *
 * Daily probe of programmatic SEO URLs in the live sitemap. Always probes
 * every URL the sitemap lists under `/guides/*` and `/[intent]/[state]`, plus
 * a non-overlapping rotating slice of city-level intent URLs keyed by the day
 * index so the full city set rolls through over `ceil(N / CITY_SLICE_SIZE)`
 * days.
 *
 * On non-2xx: emits Sentry messages (severity by count). Always returns 200
 * with a JSON summary so Vercel cron history reflects scheduling health, not
 * downstream URL health.
 */
async function _GET(request: Request): Promise<Response> {
  if (!validateCronRequest(request)) {
    return createErrorResponse(
      "Unauthorized",
      "Invalid cron authentication",
      401
    );
  }

  const checkInId = startCronCheckIn({
    slug: MONITOR_SLUG,
    schedule: SCHEDULE,
    maxRuntimeMinutes: 2,
  });
  const startMs = Date.now();

  try {
    const sitemapUrls = await loadSitemapUrls();
    if (sitemapUrls.length === 0) {
      Sentry.captureMessage("[sitemap-health] sitemap returned 0 URLs", {
        level: "error",
        tags: { cron: MONITOR_SLUG },
      });
      await completeCronCheckIn(
        checkInId,
        MONITOR_SLUG,
        "error",
        Date.now() - startMs,
      );
      return createSuccessResponse({
        probed: 0,
        ok: 0,
        failures: [],
        durationMs: Date.now() - startMs,
        sitemapEmpty: true,
      });
    }

    const bucket = bucketSitemap(sitemapUrls);
    const dayIndex = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
    const rotating = pickRotatingSlice(bucket.cityIntent, CITY_SLICE_SIZE, dayIndex);
    const probeUrls = [...bucket.guides, ...bucket.stateIntent, ...rotating];

    const outcomes = await runPool(probeUrls);
    const failures = outcomes.filter(
      (o) => !(o.status >= 200 && o.status < 300)
    );

    if (failures.length > 0) {
      const severity: "error" | "warning" =
        failures.length >= ERROR_THRESHOLD ? "error" : "warning";
      const summary = failures
        .slice(0, 10)
        .map((f) => `${f.status} ${f.url}${f.error ? ` (${f.error})` : ""}`)
        .join("\n");
      Sentry.captureMessage(
        `[sitemap-health] ${failures.length} non-2xx of ${probeUrls.length} probed:\n${summary}`,
        {
          level: severity,
          tags: { cron: MONITOR_SLUG, severity },
          extra: {
            failures,
            patterns: failures.reduce<Record<string, number>>((acc, f) => {
              acc[f.pattern] = (acc[f.pattern] ?? 0) + 1;
              return acc;
            }, {}),
          },
        }
      );
    }

    await completeCronCheckIn(
      checkInId,
      MONITOR_SLUG,
      "ok",
      Date.now() - startMs,
    );

    return createSuccessResponse({
      probed: probeUrls.length,
      ok: probeUrls.length - failures.length,
      failures: failures.slice(0, 50),
      durationMs: Date.now() - startMs,
      cityIntentTotal: bucket.cityIntent.length,
      cityIntentSliced: rotating.length,
      stateIntentTotal: bucket.stateIntent.length,
      guidesTotal: bucket.guides.length,
      rotationDays: Math.max(
        1,
        Math.ceil(bucket.cityIntent.length / CITY_SLICE_SIZE)
      ),
    });
  } catch (err) {
    await completeCronCheckIn(
      checkInId,
      MONITOR_SLUG,
      "error",
      Date.now() - startMs,
    );
    return handleApiError(err, "Sitemap health probe failed");
  }
}

export const GET = withObservedCron("/api/cron/sitemap-health", _GET);
