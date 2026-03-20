#!/usr/bin/env node
/**
 * Camera Health Validation Script
 *
 * Queries all camera URLs from beach_sources, deduplicates them, validates each
 * one with type-specific checks, and outputs a structured JSON report.
 *
 * Usage:
 *   npx tsx scripts/validate-cameras.ts --json
 *
 * Output: single JSON object to stdout (see .claude/commands/cam-health.md for schema)
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import pLimit from "p-limit";

config({ path: ".env.local" });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CameraType =
  | "hdontap"
  | "youtube"
  | "surfline_hls"
  | "surfchex_hls"
  | "streamlock_hls"
  | "surfoutlook"
  | "generic_hls"
  | "direct_video"
  | "generic_iframe";

type CameraStatus = "LIVE" | "DEAD" | "ERROR";

interface RawCamera {
  camera_url: string;
  beach_name: string;
  city: string | null;
  state: string | null;
}

interface CameraResult {
  beach: string;
  city: string;
  state: string;
  type: CameraType;
  url: string;
  status: CameraStatus;
  durationMs: number;
  detail?: string;
}

interface DeadOrErrorEntry {
  beach: string;
  city: string;
  state: string;
  type: CameraType;
  url: string;
  detail: string;
}

interface TypeStats {
  live: number;
  dead: number;
  error: number;
}

interface ValidationReport {
  timestamp: string;
  total: number;
  live: number;
  dead: number;
  error: number;
  byType: Record<string, TypeStats>;
  cameras: CameraResult[];
  deadCameras: DeadOrErrorEntry[];
  errors: DeadOrErrorEntry[];
}

// ---------------------------------------------------------------------------
// URL classification
// ---------------------------------------------------------------------------

function classifyCameraType(url: string): CameraType {
  const lower = url.toLowerCase();

  if (lower.includes("hdontap.com")) return "hdontap";
  if (lower.includes("youtube.com") || lower.includes("youtu.be"))
    return "youtube";
  if (lower.includes("surfline") && lower.endsWith(".m3u8"))
    return "surfline_hls";
  if (lower.includes("surfchex.com")) return "surfchex_hls";
  if (lower.includes("streamlock.net") || lower.includes("wowza"))
    return "streamlock_hls";
  if (lower.includes("surfoutlook.com")) return "surfoutlook";
  if (lower.endsWith(".m3u8")) return "generic_hls";
  if (/\.(mp4|webm|ogg|mov|avi)(\?.*)?$/.test(lower)) return "direct_video";
  return "generic_iframe";
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

const TIMEOUT_MS = 10_000;

async function fetchWithTimeout(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Type-specific validators
// Returns { live: boolean; detail: string }
// ---------------------------------------------------------------------------

async function validateHdontap(
  url: string
): Promise<{ live: boolean; detail: string }> {
  // Fetch the embed/stream page and look for an HLS manifest URL in the body
  const response = await fetchWithTimeout(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; QuiverBot/1.0; +https://quiversurf.app)",
    },
  });

  if (!response.ok) {
    return { live: false, detail: `HTTP ${response.status}` };
  }

  const text = await response.text();
  const hasHls =
    text.includes(".m3u8") ||
    text.includes("application/vnd.apple.mpegurl") ||
    text.includes("hls") ||
    text.includes("stream");

  if (!hasHls) {
    return { live: false, detail: "No HLS URL found in page" };
  }

  return { live: true, detail: "" };
}

async function validateYoutube(
  url: string
): Promise<{ live: boolean; detail: string }> {
  const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  const response = await fetchWithTimeout(oEmbedUrl);

  if (response.status === 404) {
    return { live: false, detail: "Video not found (oEmbed 404)" };
  }
  if (response.status === 401 || response.status === 403) {
    return {
      live: false,
      detail: `Video unavailable (oEmbed HTTP ${response.status})`,
    };
  }
  if (!response.ok) {
    return { live: false, detail: `oEmbed HTTP ${response.status}` };
  }

  // Enhanced check: verify the stream is actually live via YouTube Data API
  if (youtubeLiveCheck && youtubeApiKey) {
    try {
      const parsedUrl = new URL(url);
      const videoId = parsedUrl.searchParams.get("v");
      if (videoId) {
        const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=liveStreamingDetails&key=${youtubeApiKey}`;
        const apiResponse = await fetchWithTimeout(apiUrl);
        if (apiResponse.ok) {
          const apiData = await apiResponse.json();
          const item = apiData.items?.[0];
          if (!item) {
            return { live: false, detail: "Video not found via Data API" };
          }
          const liveDetails = item.liveStreamingDetails;
          if (!liveDetails?.actualStartTime || liveDetails?.actualEndTime) {
            return { live: false, detail: "Stream exists but not currently live" };
          }
          return { live: true, detail: "Confirmed live via Data API" };
        }
      }
    } catch {
      // Fall through to oEmbed-only result if Data API check fails
    }
  }

  return { live: true, detail: "" };
}

async function validateHlsManifest(
  url: string,
  extraHeaders?: Record<string, string>
): Promise<{ live: boolean; detail: string }> {
  const response = await fetchWithTimeout(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; QuiverBot/1.0; +https://quiversurf.app)",
      ...extraHeaders,
    },
  });

  if (!response.ok) {
    return { live: false, detail: `HTTP ${response.status}` };
  }

  const text = await response.text();
  if (!text.trimStart().startsWith("#EXTM3U")) {
    return { live: false, detail: "Response is not a valid HLS manifest" };
  }

  return { live: true, detail: "" };
}

async function validateSurflineHls(
  url: string
): Promise<{ live: boolean; detail: string }> {
  return validateHlsManifest(url, { Referer: "https://www.surfline.com" });
}

async function validateHead(
  url: string
): Promise<{ live: boolean; detail: string }> {
  const response = await fetchWithTimeout(url, {
    method: "HEAD",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; QuiverBot/1.0; +https://quiversurf.app)",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    return { live: false, detail: `HTTP ${response.status}` };
  }

  return { live: true, detail: "" };
}

async function validateDirectVideo(
  url: string
): Promise<{ live: boolean; detail: string }> {
  const response = await fetchWithTimeout(url, {
    method: "HEAD",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; QuiverBot/1.0; +https://quiversurf.app)",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    return { live: false, detail: `HTTP ${response.status}` };
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("video/")) {
    return {
      live: false,
      detail: `Unexpected Content-Type: ${contentType || "(none)"}`,
    };
  }

  return { live: true, detail: "" };
}

async function validateGenericIframe(
  url: string
): Promise<{ live: boolean; detail: string }> {
  const response = await fetchWithTimeout(url, {
    method: "HEAD",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; QuiverBot/1.0; +https://quiversurf.app)",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    return { live: false, detail: `HTTP ${response.status}` };
  }

  const xFrameOptions = (
    response.headers.get("x-frame-options") ?? ""
  ).toUpperCase();
  if (xFrameOptions === "DENY") {
    return { live: false, detail: "X-Frame-Options: DENY (cannot embed)" };
  }

  return { live: true, detail: "" };
}

// ---------------------------------------------------------------------------
// Dispatch to the right validator
// ---------------------------------------------------------------------------

async function validateCamera(
  url: string,
  type: CameraType
): Promise<{ live: boolean; detail: string }> {
  switch (type) {
    case "hdontap":
      return validateHdontap(url);
    case "youtube":
      return validateYoutube(url);
    case "surfline_hls":
      return validateSurflineHls(url);
    case "surfchex_hls":
      return validateHlsManifest(url);
    case "streamlock_hls":
      return validateHlsManifest(url);
    case "surfoutlook":
      return validateHead(url);
    case "generic_hls":
      return validateHlsManifest(url);
    case "direct_video":
      return validateDirectVideo(url);
    case "generic_iframe":
      return validateGenericIframe(url);
  }
}

// ---------------------------------------------------------------------------
// Supabase query
// ---------------------------------------------------------------------------

async function loadCameraRows(): Promise<RawCamera[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing required env vars: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data, error } = await supabase
    .from("beach_sources")
    .select(
      `
      camera_url,
      beaches!inner (
        name,
        city,
        state
      )
    `
    )
    .not("camera_url", "is", null)
    .neq("camera_url", "");

  if (error) {
    throw new Error(`Supabase query failed: ${error.message}`);
  }

  if (!data) return [];

  return data.map((row) => {
    const beach = (row as any).beaches;
    return {
      camera_url: row.camera_url as string,
      beach_name: beach?.name ?? "Unknown Beach",
      city: beach?.city ?? null,
      state: beach?.state ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// Main validation loop
// ---------------------------------------------------------------------------

async function run(): Promise<ValidationReport> {
  const rows = await loadCameraRows();

  // Deduplicate by URL — validate each unique URL once, then expand results
  // back to one entry per beach_sources row (total reflects raw row count)
  const urlMap = new Map<string, RawCamera>();

  for (const row of rows) {
    if (!urlMap.has(row.camera_url)) {
      urlMap.set(row.camera_url, row);
    }
  }

  const uniqueUrls = Array.from(urlMap.values());
  const totalCount = rows.length;

  const limit = pLimit(5);

  // Validate each unique URL once
  const urlResults = new Map<
    string,
    { status: CameraStatus; detail: string; durationMs: number; type: CameraType }
  >();

  await Promise.all(
    uniqueUrls.map((row) =>
      limit(async () => {
        const type = classifyCameraType(row.camera_url);
        const start = Date.now();
        let status: CameraStatus;
        let detail = "";

        try {
          const result = await validateCamera(row.camera_url, type);
          status = result.live ? "LIVE" : "DEAD";
          detail = result.detail;
        } catch (err: unknown) {
          status = "ERROR";
          if (err instanceof Error) {
            if (err.name === "AbortError") {
              detail = "Timeout (10s)";
            } else if (
              err.message.includes("ENOTFOUND") ||
              err.message.includes("getaddrinfo")
            ) {
              detail = `DNS failure: ${err.message}`;
            } else if (err.message.includes("ECONNREFUSED")) {
              detail = `Connection refused: ${err.message}`;
            } else {
              detail = err.message;
            }
          } else {
            detail = String(err);
          }
        }

        const durationMs = Date.now() - start;
        urlResults.set(row.camera_url, { status, detail, durationMs, type });
      })
    )
  );

  // Expand results back to one entry per original beach_sources row
  const cameras: CameraResult[] = [];
  const deadCameras: DeadOrErrorEntry[] = [];
  const errors: DeadOrErrorEntry[] = [];
  const byType: Record<string, TypeStats> = {};

  for (const row of rows) {
    const result = urlResults.get(row.camera_url);
    if (!result) continue;

    const { status, detail, durationMs, type } = result;

    if (!byType[type]) {
      byType[type] = { live: 0, dead: 0, error: 0 };
    }

    if (status === "LIVE") byType[type].live++;
    else if (status === "DEAD") byType[type].dead++;
    else byType[type].error++;

    const cameraResult: CameraResult = {
      beach: row.beach_name,
      city: row.city ?? "",
      state: row.state ?? "",
      type,
      url: row.camera_url,
      status,
      durationMs,
    };
    if (detail) cameraResult.detail = detail;

    cameras.push(cameraResult);

    if (status === "DEAD") {
      deadCameras.push({
        beach: row.beach_name,
        city: row.city ?? "",
        state: row.state ?? "",
        type,
        url: row.camera_url,
        detail,
      });
    } else if (status === "ERROR") {
      errors.push({
        beach: row.beach_name,
        city: row.city ?? "",
        state: row.state ?? "",
        type,
        url: row.camera_url,
        detail,
      });
    }
  }

  // Sort dead and error lists by beach name
  deadCameras.sort((a, b) => a.beach.localeCompare(b.beach));
  errors.sort((a, b) => a.beach.localeCompare(b.beach));

  const liveCount = cameras.filter((c) => c.status === "LIVE").length;
  const deadCount = cameras.filter((c) => c.status === "DEAD").length;
  const errorCount = cameras.filter((c) => c.status === "ERROR").length;

  return {
    timestamp: new Date().toISOString(),
    total: totalCount,
    live: liveCount,
    dead: deadCount,
    error: errorCount,
    byType,
    cameras,
    deadCameras,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const useJson = process.argv.includes("--json");
const youtubeLiveCheck = process.argv.includes("--youtube-live-check");
const youtubeApiKey = process.env.YOUTUBE_API_KEY;

run()
  .then((report) => {
    if (useJson) {
      process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    } else {
      // Human-readable summary when --json is not passed
      const pct = Math.round((report.live / report.total) * 100);
      console.log(`Camera Health: ${report.live}/${report.total} live (${pct}%)`);
      console.log(`  LIVE:  ${report.live}`);
      console.log(`  DEAD:  ${report.dead}`);
      console.log(`  ERROR: ${report.error}`);

      if (report.deadCameras.length > 0) {
        console.log("\nDead cameras:");
        for (const d of report.deadCameras) {
          console.log(`  [${d.type}] ${d.beach}, ${d.city}, ${d.state} — ${d.detail}`);
        }
      }

      if (report.errors.length > 0) {
        console.log("\nErrors:");
        for (const e of report.errors) {
          console.log(`  [${e.type}] ${e.beach}, ${e.city}, ${e.state} — ${e.detail}`);
        }
      }
    }
  })
  .catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    if (useJson) {
      process.stdout.write(
        JSON.stringify({ error: message, timestamp: new Date().toISOString() }) + "\n"
      );
    } else {
      console.error("Fatal error:", message);
    }
    process.exit(1);
  });
