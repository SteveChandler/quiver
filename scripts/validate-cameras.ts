#!/usr/bin/env tsx
/**
 * Camera Health Validator
 *
 * Checks every camera_url in beach_sources to determine whether it is live,
 * dead, or erroring. Prints real-time results with color coding and a
 * summary at the end.
 *
 * Usage:
 *   npx tsx scripts/validate-cameras.ts          # colored terminal output
 *   npx tsx scripts/validate-cameras.ts --json   # structured JSON output
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";
import { HDONTAP_HLS_RE } from "../lib/media/cam-constants";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const JSON_MODE = process.argv.includes("--json");

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

interface ValidationResult {
  status: CameraStatus;
  detail?: string;
}

interface BeachJoin {
  name: string;
  slug: string;
  city: string;
  state: string;
}

interface BeachSourceRow {
  beach_id: string;
  camera_url: string;
  beaches: BeachJoin | BeachJoin[];
}

interface CameraRecord {
  beach_id: string;
  camera_url: string;
  beach_name: string;
  city: string;
  state: string;
}

interface CameraResult extends CameraRecord {
  type: CameraType;
  status: CameraStatus;
  detail?: string;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Terminal colors
// ---------------------------------------------------------------------------

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

function colorForStatus(status: CameraStatus): string {
  switch (status) {
    case "LIVE":
      return GREEN;
    case "DEAD":
      return RED;
    case "ERROR":
      return YELLOW;
  }
}

// ---------------------------------------------------------------------------
// State normalization
// ---------------------------------------------------------------------------

const STATE_NAME_TO_ABBREV: Record<string, string> = {
  california: "CA",
  oregon: "OR",
  washington: "WA",
  hawaii: "HI",
  florida: "FL",
  "north carolina": "NC",
  "south carolina": "SC",
  texas: "TX",
  "new jersey": "NJ",
  "new york": "NY",
  virginia: "VA",
  maryland: "MD",
  delaware: "DE",
  maine: "ME",
  "rhode island": "RI",
  connecticut: "CT",
  massachusetts: "MA",
  "new hampshire": "NH",
  georgia: "GA",
  alabama: "AL",
  mississippi: "MS",
  louisiana: "LA",
  "baja california": "BCN",
};

function normalizeState(state: string | null | undefined): string {
  if (!state) return "";
  const trimmed = state.trim();
  if (trimmed.length <= 3) return trimmed.toUpperCase();
  return STATE_NAME_TO_ABBREV[trimmed.toLowerCase()] || trimmed;
}

// ---------------------------------------------------------------------------
// URL classification
// ---------------------------------------------------------------------------

function classifyUrl(rawUrl: string): CameraType {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return "generic_iframe";
  }

  const hostname = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname.toLowerCase();

  // HDOnTap (must be /stream/ path)
  if (
    (hostname === "hdontap.com" || hostname === "www.hdontap.com") &&
    pathname.startsWith("/stream/")
  ) {
    return "hdontap";
  }

  // YouTube
  if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) {
    return "youtube";
  }

  // Surfline HLS
  if (hostname === "hls.cdn-surfline.com") {
    return "surfline_hls";
  }

  // Surfchex
  if (hostname.includes("surfchex.com")) {
    return "surfchex_hls";
  }

  // Streamlock
  if (hostname.includes("streamlock.net")) {
    return "streamlock_hls";
  }

  // SurfOutlook
  if (hostname.includes("surfoutlook.com")) {
    return "surfoutlook";
  }

  // Generic HLS manifest
  if (pathname.endsWith(".m3u8")) {
    return "generic_hls";
  }

  // Direct video file
  if (
    pathname.endsWith(".mp4") ||
    pathname.endsWith(".webm") ||
    pathname.endsWith(".ogg")
  ) {
    return "direct_video";
  }

  return "generic_iframe";
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

async function validateHdontap(
  url: string,
  signal: AbortSignal
): Promise<ValidationResult> {
  const parsed = new URL(url);
  parsed.pathname = parsed.pathname.replace(/\/?$/, "/embed/");
  const res = await fetch(parsed.toString(), {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
    signal,
  });
  if (!res.ok) {
    return { status: "DEAD", detail: `HTTP ${res.status}` };
  }
  const html = await res.text();
  const unescaped = html.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
  const match = unescaped.match(HDONTAP_HLS_RE);
  return match
    ? { status: "LIVE" }
    : { status: "DEAD", detail: "No HLS URL found in page" };
}

async function validateYoutube(
  url: string,
  signal: AbortSignal
): Promise<ValidationResult> {
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  const res = await fetch(oembedUrl, { signal });
  return res.status === 200
    ? { status: "LIVE" }
    : { status: "DEAD", detail: `oEmbed returned ${res.status}` };
}

async function validateSurflineHls(
  url: string,
  signal: AbortSignal
): Promise<ValidationResult> {
  const res = await fetch(url, {
    headers: { Referer: "https://www.surfline.com/" },
    signal,
  });
  if (!res.ok) {
    return { status: "DEAD", detail: `HTTP ${res.status}` };
  }
  const body = await res.text();
  return body.trimStart().startsWith("#EXTM3U")
    ? { status: "LIVE" }
    : { status: "DEAD", detail: "Response is not a valid HLS manifest" };
}

async function validateHlsManifest(
  url: string,
  signal: AbortSignal
): Promise<ValidationResult> {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    return { status: "DEAD", detail: `HTTP ${res.status}` };
  }
  const body = await res.text();
  return body.includes("#EXTM3U")
    ? { status: "LIVE" }
    : { status: "DEAD", detail: "Response does not contain #EXTM3U" };
}

async function validateSurfOutlook(
  url: string,
  signal: AbortSignal
): Promise<ValidationResult> {
  const res = await fetch(url, { method: "HEAD", signal });
  return res.ok
    ? { status: "LIVE" }
    : { status: "DEAD", detail: `HTTP ${res.status}` };
}

async function validateDirectVideo(
  url: string,
  signal: AbortSignal
): Promise<ValidationResult> {
  const res = await fetch(url, { method: "HEAD", signal });
  if (!res.ok) {
    return { status: "DEAD", detail: `HTTP ${res.status}` };
  }
  const contentType = res.headers.get("content-type") || "";
  return contentType.startsWith("video/")
    ? { status: "LIVE" }
    : {
        status: "DEAD",
        detail: `Content-Type is "${contentType}", expected video/*`,
      };
}

async function validateGenericIframe(
  url: string,
  signal: AbortSignal
): Promise<ValidationResult> {
  const res = await fetch(url, { method: "HEAD", signal });
  if (!res.ok) {
    return { status: "DEAD", detail: `HTTP ${res.status}` };
  }
  const xfo = res.headers.get("x-frame-options") || "";
  if (
    xfo.toUpperCase() === "DENY" ||
    xfo.toUpperCase() === "SAMEORIGIN"
  ) {
    return {
      status: "LIVE",
      detail: `X-Frame-Options: ${xfo} (may not embed)`,
    };
  }
  return { status: "LIVE" };
}

function getValidator(
  type: CameraType
): (url: string, signal: AbortSignal) => Promise<ValidationResult> {
  switch (type) {
    case "hdontap":
      return validateHdontap;
    case "youtube":
      return validateYoutube;
    case "surfline_hls":
      return validateSurflineHls;
    case "surfchex_hls":
    case "streamlock_hls":
    case "generic_hls":
      return validateHlsManifest;
    case "surfoutlook":
      return validateSurfOutlook;
    case "direct_video":
      return validateDirectVideo;
    case "generic_iframe":
      return validateGenericIframe;
  }
}

// ---------------------------------------------------------------------------
// Concurrency control
// ---------------------------------------------------------------------------

class Semaphore {
  private queue: (() => void)[] = [];
  private current = 0;
  constructor(private max: number) {}
  async acquire(): Promise<void> {
    if (this.current < this.max) {
      this.current++;
      return;
    }
    return new Promise<void>((resolve) => this.queue.push(resolve));
  }
  release(): void {
    this.current--;
    const next = this.queue.shift();
    if (next) {
      this.current++;
      next();
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (!JSON_MODE) {
    console.log(`${BOLD}Camera Health Validator${RESET}`);
    console.log(`Run: ${new Date().toISOString()}\n`);
  }

  // Fetch all camera URLs from beach_sources
  const { data, error } = await supabase
    .from("beach_sources")
    .select("beach_id, camera_url, beaches!inner(name, slug, city, state)")
    .not("camera_url", "is", null)
    .neq("camera_url", "");

  if (error) {
    console.error("Failed to fetch camera data:", error.message);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    if (JSON_MODE) {
      console.log(JSON.stringify({ timestamp: new Date().toISOString(), total: 0, live: 0, dead: 0, error: 0, byType: {}, cameras: [], deadCameras: [], errors: [] }, null, 2));
    } else {
      console.log("No cameras found in beach_sources.");
    }
    process.exit(0);
  }

  // Normalize records — Supabase !inner join returns beaches as an object
  const cameras: CameraRecord[] = (data as BeachSourceRow[]).map((row) => {
    const beach = (Array.isArray(row.beaches) ? row.beaches[0] : row.beaches) as BeachJoin;
    return {
      beach_id: row.beach_id,
      camera_url: row.camera_url,
      beach_name: beach.name,
      city: beach.city || "",
      state: normalizeState(beach.state),
    };
  });

  if (!JSON_MODE) {
    console.log(`Found ${cameras.length} camera URLs to validate.\n`);
  }

  // Deduplicate by camera_url — validate each unique URL once
  const uniqueUrls = new Map<string, CameraRecord[]>();
  for (const cam of cameras) {
    const existing = uniqueUrls.get(cam.camera_url);
    if (existing) {
      existing.push(cam);
    } else {
      uniqueUrls.set(cam.camera_url, [cam]);
    }
  }

  const TIMEOUT_MS = 10_000;
  const semaphore = new Semaphore(5);
  const urlResultCache = new Map<string, ValidationResult & { type: CameraType; durationMs: number }>();
  const allResults: CameraResult[] = [];

  // Validate each unique URL
  const validationPromises = Array.from(uniqueUrls.entries()).map(
    async ([url, records]) => {
      await semaphore.acquire();
      try {
        const type = classifyUrl(url);
        const validator = getValidator(type);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
        const start = Date.now();

        let result: ValidationResult;
        try {
          result = await validator(url, controller.signal);
        } catch (err: unknown) {
          if (err instanceof Error && err.name === "AbortError") {
            result = { status: "ERROR", detail: "Timeout (10s)" };
          } else {
            const message =
              err instanceof Error ? err.message : String(err);
            result = { status: "ERROR", detail: message };
          }
        } finally {
          clearTimeout(timeoutId);
        }

        const durationMs = Date.now() - start;
        urlResultCache.set(url, { ...result, type, durationMs });

        // Emit results for every beach that uses this URL
        for (const record of records) {
          const cameraResult: CameraResult = {
            ...record,
            type,
            status: result.status,
            detail: result.detail,
            durationMs,
          };
          allResults.push(cameraResult);

          if (!JSON_MODE) {
            const color = colorForStatus(result.status);
            const location = record.state
              ? `${record.beach_name} (${record.city}, ${record.state})`
              : `${record.beach_name} (${record.city})`;
            const detailSuffix =
              result.status === "ERROR" && result.detail
                ? ` - ${result.detail}`
                : "";
            console.log(
              `${color}[${result.status}]${RESET}  ${location} - ${type} (${durationMs}ms)${detailSuffix}`
            );
          }
        }
      } finally {
        semaphore.release();
      }
    }
  );

  await Promise.all(validationPromises);

  // ------- Aggregations -------
  const liveCount = allResults.filter((r) => r.status === "LIVE").length;
  const deadCount = allResults.filter((r) => r.status === "DEAD").length;
  const errorCount = allResults.filter((r) => r.status === "ERROR").length;

  const typeGroups = new Map<CameraType, CameraResult[]>();
  for (const r of allResults) {
    const group = typeGroups.get(r.type) || [];
    group.push(r);
    typeGroups.set(r.type, group);
  }

  const typeOrder: CameraType[] = [
    "hdontap",
    "youtube",
    "surfline_hls",
    "surfchex_hls",
    "streamlock_hls",
    "surfoutlook",
    "generic_hls",
    "direct_video",
    "generic_iframe",
  ];

  const deadCameras = allResults
    .filter((r) => r.status === "DEAD")
    .sort((a, b) => a.beach_name.localeCompare(b.beach_name));

  const errorCameras = allResults
    .filter((r) => r.status === "ERROR")
    .sort((a, b) => a.beach_name.localeCompare(b.beach_name));

  // ------- JSON Output -------
  if (JSON_MODE) {
    const byType: Record<string, { live: number; dead: number; error: number }> = {};
    for (const type of typeOrder) {
      const group = typeGroups.get(type);
      if (!group) continue;
      byType[type] = {
        live: group.filter((r) => r.status === "LIVE").length,
        dead: group.filter((r) => r.status === "DEAD").length,
        error: group.filter((r) => r.status === "ERROR").length,
      };
    }

    const jsonOutput = {
      timestamp: new Date().toISOString(),
      total: allResults.length,
      live: liveCount,
      dead: deadCount,
      error: errorCount,
      byType,
      cameras: allResults.map((r) => ({
        beach: r.beach_name,
        city: r.city,
        state: r.state,
        type: r.type,
        status: r.status,
        durationMs: r.durationMs,
        url: r.camera_url,
        ...(r.detail ? { detail: r.detail } : {}),
      })),
      deadCameras: deadCameras.map((r) => ({
        beach: r.beach_name,
        city: r.city,
        state: r.state,
        type: r.type,
        url: r.camera_url,
        ...(r.detail ? { detail: r.detail } : {}),
      })),
      errors: errorCameras.map((r) => ({
        beach: r.beach_name,
        city: r.city,
        state: r.state,
        type: r.type,
        url: r.camera_url,
        detail: r.detail || "Unknown error",
      })),
    };

    console.log(JSON.stringify(jsonOutput, null, 2));
    process.exit(0);
  }

  // ------- Terminal Summary -------
  console.log(`\n${BOLD}=== Summary ===${RESET}`);

  console.log(`Total cameras: ${allResults.length}`);
  console.log(`${GREEN}LIVE:  ${liveCount}${RESET}`);
  console.log(`${RED}DEAD:  ${deadCount}${RESET}`);
  console.log(`${YELLOW}ERROR: ${errorCount}${RESET}`);

  // ------- By Type -------
  console.log(`\n${BOLD}=== By Type ===${RESET}`);

  for (const type of typeOrder) {
    const group = typeGroups.get(type);
    if (!group) continue;
    const live = group.filter((r) => r.status === "LIVE").length;
    const dead = group.filter((r) => r.status === "DEAD").length;
    const err = group.filter((r) => r.status === "ERROR").length;
    const label = `${type}:`.padEnd(16);
    console.log(
      `${label}${GREEN}${live} LIVE${RESET} / ${RED}${dead} DEAD${RESET} / ${YELLOW}${err} ERROR${RESET}`
    );
  }

  // ------- Dead Cameras -------
  if (deadCameras.length > 0) {
    console.log(`\n${BOLD}${RED}=== Dead Cameras (Action Required) ===${RESET}`);
    for (const cam of deadCameras) {
      const location = cam.state
        ? `${cam.beach_name} (${cam.city}, ${cam.state})`
        : `${cam.beach_name} (${cam.city})`;
      console.log(`- ${location} - ${cam.type} - ${cam.camera_url}`);
    }
  }

  // ------- Error Cameras -------
  if (errorCameras.length > 0) {
    console.log(`\n${BOLD}${YELLOW}=== Error Cameras (Investigate) ===${RESET}`);
    for (const cam of errorCameras) {
      const location = cam.state
        ? `${cam.beach_name} (${cam.city}, ${cam.state})`
        : `${cam.beach_name} (${cam.city})`;
      console.log(
        `- ${location} - ${cam.type} - ${cam.camera_url} - ${cam.detail || "Unknown error"}`
      );
    }
  }

  console.log("");
  process.exit(0);
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
