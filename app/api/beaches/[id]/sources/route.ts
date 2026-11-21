import { RETIRED_CAMERA_BEACH_IDS } from "@/lib/media/retired-camera-beaches";
import { isBlockedCameraUrl } from "@/lib/media/camera-provider-policy";
import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSuccessResponse,
  handleApiError,
} from "@/lib/middleware/api-wrappers";
import { buildCamEmbed, getViewableUrl, toProxiedHlsUrl } from "@/lib/media/cam-embed";
import { toNativeCamEmbed } from "@/lib/media/native-cam-embed";
import { withErrorNoStore } from "@/lib/middleware/api-wrappers/error-cache-wrapper";
import {
  isSurflineHlsAvailable,
  isSurflineHlsUrl,
  preflightCamEmbed,
} from "@/lib/media/cam-embed-preflight";

interface BeachLookupRow {
  id: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BEACH_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function isBeachUuid(identifier: string): boolean {
  return UUID_PATTERN.test(identifier);
}

function isBeachSlug(identifier: string): boolean {
  return BEACH_SLUG_PATTERN.test(identifier);
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
async function handleGet(request: NextRequest, props: { params: Promise<{ id: string }> }) {
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

    const blockedCamera = isBlockedCameraUrl(cameraUrl);
    if (blockedCamera) {
      cameraUrl = null;
      cameraThumbnailUrl = null;
    } else if (isBlockedCameraUrl(cameraThumbnailUrl)) {
      cameraThumbnailUrl = null;
    }

    if (isSurflineHlsUrl(cameraUrl)) {
      const hlsAvailable = await isSurflineHlsAvailable(cameraUrl);
      if (!hlsAvailable) {
        cameraUrl = null;
      }
    }

    const proxiedCamera = cameraUrl ? toProxiedHlsUrl(cameraUrl) : null;
    if (proxiedCamera?.startsWith("/api/hls-proxy/watch.hdrelay.io/")) {
      cameraUrl = new URL(proxiedCamera, request.url).href;
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
    let camIntent = cameraUrl ? buildCamEmbed(cameraUrl) : { kind: "none" as const };
    if (cameraUrl) {
      const preflight = await preflightCamEmbed(cameraUrl, camIntent);
      embedAllowed = preflight.embedAllowed;
      if (preflight.redirectsToBlockedProvider) {
        cameraUrl = null;
        cameraThumbnailUrl = null;
        camIntent = { kind: "none" };
      }
    }

    const merged = {
      beach_id: beachId,
      forecast_source_id: (data as any)?.forecast_source_id || null,
      camera_url: cameraUrl,
      embed_allowed: embedAllowed,
      diorama_url: isBlockedCameraUrl(dioramaUrl) ? null : dioramaUrl,
      cam_open_url: cameraUrl ? getViewableUrl(cameraUrl) : null,
      cam_thumbnail_url: cameraThumbnailUrl,
      cam_kind: camIntent.kind,
      cam_embed: toNativeCamEmbed(camIntent),
      ...(blockedCamera || (!cameraUrl && RETIRED_CAMERA_BEACH_IDS.has(beachId))
        ? { cam_unavailable: true } : {}),
    };

    const response = createSuccessResponse({ sources: merged });
    response.headers.set("Cache-Control", "no-store");

    return response;
  } catch (err) {
    return handleApiError(err, "Failed to fetch beach sources");
  }
}

export const GET = withErrorNoStore(handleGet, "/api/beaches/[id]/sources");
