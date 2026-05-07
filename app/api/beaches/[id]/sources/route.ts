import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSuccessResponse, handleApiError } from "@/lib/api-utils";
import { buildCamEmbed, getViewableUrl } from "@/lib/media/cam-embed";

// GET /api/beaches/[id]/sources - fetch external source mappings (e.g., camera_url)
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("beach_sources")
      .select("beach_id, ndbc_buoy_ids, forecast_source_id, camera_url, thumbnail_url")
      .eq("beach_id", params.id)
      .maybeSingle();

    if (error) {
      return handleApiError(error, "Failed to fetch beach sources");
    }

    // Fallback: if beach_sources missing or camera_url empty, check beaches table for live_cam_url variants
    let cameraUrl: string | null = (data as any)?.camera_url || null;
    let cameraThumbnailUrl: string | null = (data as any)?.thumbnail_url || null;
    if (!cameraUrl) {
      const { data: beachRow, error: beachErr } = await supabase
        .from("beaches")
        .select("id, live_cam_url, camera_url")
        .eq("id", params.id)
        .maybeSingle();
      if (!beachErr && beachRow) {
        cameraUrl =
          ((beachRow as any).liveCamUrl as string | null) ||
          ((beachRow as any).live_cam_url as string | null) ||
          ((beachRow as any).camera_url as string | null) ||
          null;
      }
    }

    // Diorama: match to condition_key if provided, fallback chain: exact -> medium_day -> any
    let dioramaUrl: string | null = null;
    const conditionKey = request.nextUrl.searchParams.get("condition") ?? "medium_day";
    const { data: diorama } = await supabase
      .from("beach_dioramas" as any)
      .select("video_url")
      .eq("beach_id", params.id)
      .eq("condition_key", conditionKey)
      .maybeSingle();
    if ((diorama as any)?.video_url) {
      dioramaUrl = (diorama as any).video_url;
    } else if (conditionKey !== "medium_day") {
      const { data: mid } = await supabase
        .from("beach_dioramas" as any)
        .select("video_url")
        .eq("beach_id", params.id)
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
        .eq("beach_id", params.id)
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
      if (camIntent.kind !== "none" && camIntent.kind !== "iframe") {
        // HLS, video — always embeddable via native players
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
            signal: AbortSignal.timeout(3000),
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
      beach_id: params.id,
      ndbc_buoy_ids: (data as any)?.ndbc_buoy_ids || null,
      forecast_source_id: (data as any)?.forecast_source_id || null,
      camera_url: cameraUrl,
      embed_allowed: embedAllowed,
      diorama_url: dioramaUrl,
      cam_open_url: cameraUrl ? getViewableUrl(cameraUrl) : null,
      cam_thumbnail_url: cameraThumbnailUrl,
      cam_kind: camIntent.kind,
    };

    // PERFORMANCE OPTIMIZATION: Cache sources for 30 minutes (1800s)
    // Camera URLs and buoy IDs don't change frequently
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
