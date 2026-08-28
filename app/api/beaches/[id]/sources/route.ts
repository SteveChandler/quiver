import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSuccessResponse,
  handleApiError,
} from "@/lib/middleware/api-wrappers";
import { buildCamEmbed, getViewableUrl } from "@/lib/media/cam-embed";

interface BeachLookupRow {
  id: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BEACH_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SURFLINE_HLS_HOST = "hls.cdn-surfline.com";
const SURFLINE_HEALTH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  Referer: "https://www.surfline.com/",
};

function isBeachUuid(identifier: string): boolean {
  return UUID_PATTERN.test(identifier);
}

function isBeachSlug(identifier: string): boolean {
  return BEACH_SLUG_PATTERN.test(identifier);
}

function createTimeoutSignal(milliseconds: number): AbortSignal | undefined {
  if (typeof AbortSignal.timeout !== "function") return undefined;
  return AbortSignal.timeout(milliseconds);
}

function isSurflineHlsUrl(url: string | null): url is string {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return parsed.hostname === SURFLINE_HLS_HOST && parsed.pathname.endsWith(".m3u8");
  } catch {
    return false;
  }
}

async function isSurflineHlsAvailable(url: string): Promise<boolean> {
  try {
    const response = await globalThis.fetch(url, {
      method: "HEAD",
      headers: SURFLINE_HEALTH_HEADERS,
      signal: createTimeoutSignal(3000),
    });

    return response.status === 200;
  } catch {
    return false;
  }
}

function createBeachSourcesErrorResponse(
  error: string,
  status: number
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error,
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    }
  );
}

// GET /api/beaches/[id]/sources - fetch external source mappings (e.g., camera_url)
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const requestedBeachId = params.id?.trim();
    if (!requestedBeachId) {
      return createBeachSourcesErrorResponse("Beach identifier is required", 400);
    }

    const isUuid = isBeachUuid(requestedBeachId);
    if (!isUuid && !isBeachSlug(requestedBeachId)) {
      return createBeachSourcesErrorResponse("Invalid beach identifier", 400);
    }

    const supabase = await createSupabaseServerClient();
    let beachId = requestedBeachId;

    if (!isUuid) {
      const { data: beachRow, error: beachLookupError } = await supabase
        .from("beaches")
        .select("id")
        .eq("slug", requestedBeachId)
        .maybeSingle();

      if (beachLookupError) {
        return handleApiError(beachLookupError, "Failed to fetch beach sources");
      }

      if (!beachRow) {
        return createBeachSourcesErrorResponse("Beach not found", 404);
      }

      beachId = (beachRow as BeachLookupRow).id;
    }

    const { data, error } = await supabase
      .from("beach_sources")
      .select("beach_id, forecast_source_id, camera_url, thumbnail_url")
      .eq("beach_id", beachId)
      .maybeSingle();

    if (error) {
      return handleApiError(error, "Failed to fetch beach sources");
    }

    let cameraUrl: string | null = (data as any)?.camera_url || null;
    let cameraThumbnailUrl: string | null = (data as any)?.thumbnail_url || null;

    if (isSurflineHlsUrl(cameraUrl)) {
      const hlsAvailable = await isSurflineHlsAvailable(cameraUrl);
      if (!hlsAvailable) {
        cameraUrl = null;
      }
    }

    // Diorama: match to condition_key if provided, fallback chain: exact -> medium_day -> any
    let dioramaUrl: string | null = null;
    const conditionKey = request.nextUrl.searchParams.get("condition") ?? "medium_day";
    const { data: diorama } = await supabase
      .from("beach_dioramas" as any)
      .select("video_url")
      .eq("beach_id", beachId)
      .eq("condition_key", conditionKey)
      .maybeSingle();
    if ((diorama as any)?.video_url) {
      dioramaUrl = (diorama as any).video_url;
    } else if (conditionKey !== "medium_day") {
      const { data: mid } = await supabase
        .from("beach_dioramas" as any)
        .select("video_url")
        .eq("beach_id", beachId)
        .eq("condition_key", "medium_day")
        .maybeSingle();
      if ((mid as any)?.video_url) {
        dioramaUrl = (mid as any).video_url;
      }
    }
    if (!dioramaUrl) {
      const { data: fallback } = await supabase
        .from("beach_dioramas" as any)
        .select("video_url")
        .eq("beach_id", beachId)
        .order("condition_key" as any)
        .limit(1)
        .maybeSingle();
      if ((fallback as any)?.video_url) {
        dioramaUrl = (fallback as any).video_url;
      }
    }

    // Server-side preflight for embed allow
    let embedAllowed: boolean | null = null;
    const camIntent = cameraUrl ? buildCamEmbed(cameraUrl) : { kind: "none" as const };
    if (cameraUrl) {
      // Known embeddable sources — buildCamEmbed transforms these to proper embed URLs
      if (camIntent.kind === "external") {
        embedAllowed = false;
      } else if (
        camIntent.kind === "hls" ||
        camIntent.kind === "video" ||
        camIntent.kind === "hdontap"
      ) {
        // HLS, video, and resolvable player sources are embeddable via native players
        embedAllowed = true;
      } else if (
        cameraUrl.includes("hdontap.com/") ||
        cameraUrl.includes("youtube.com/") ||
        cameraUrl.includes("youtu.be/") ||
        cameraUrl.includes("vimeo.com/")
      ) {
        // Known iframe sources with dedicated embed transforms
        embedAllowed = true;
      } else if (camIntent.kind === "iframe") {
        // Unknown iframe source — do preflight check
        try {
          const head = await fetch(cameraUrl, {
            method: "HEAD",
            signal: createTimeoutSignal(3000),
          });
          const xfo = head.headers.get("x-frame-options");
          const csp = head.headers.get("content-security-policy");
          const deniesXfo = xfo && /deny|sameorigin/i.test(xfo);
          const deniesCsp =
            csp && /frame-ancestors\s+('none'|none|self)/i.test(csp);
          embedAllowed = !(deniesXfo || deniesCsp);
        } catch {
          // Network or CORS may block reading headers; be optimistic and let client attempt
          embedAllowed = null;
        }
      }
    }

    const merged = {
      beach_id: beachId,
      forecast_source_id: (data as any)?.forecast_source_id || null,
      camera_url: cameraUrl,
      embed_allowed: embedAllowed,
      diorama_url: dioramaUrl,
      cam_open_url: cameraUrl ? getViewableUrl(cameraUrl) : null,
      cam_thumbnail_url: cameraThumbnailUrl,
      cam_kind: camIntent.kind,
    };

    // PERFORMANCE OPTIMIZATION: Cache sources for 30 minutes (1800s)
    // Camera URLs and forecast source ids don't change frequently
    const response = createSuccessResponse({ sources: merged });
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=1800, stale-while-revalidate=7200"
    );

    return response;
  } catch (err) {
    return handleApiError(err, "Failed to fetch beach sources");
  }
}
