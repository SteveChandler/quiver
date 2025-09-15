import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSuccessResponse, handleApiError } from "@/lib/api-utils";

// GET /api/beaches/[id]/sources - fetch external source mappings (e.g., camera_url)
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("beach_sources")
      .select("beach_id, ndbc_buoy_ids, forecast_source_id, camera_url")
      .eq("beach_id", params.id)
      .maybeSingle();

    if (error) {
      return handleApiError(error, "Failed to fetch beach sources");
    }

    // Fallback: if beach_sources missing or camera_url empty, check beaches table for live_cam_url variants
    let cameraUrl: string | null = (data as any)?.camera_url || null;
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

    // Server-side preflight for embed allow
    let embedAllowed: boolean | null = null;
    if (cameraUrl) {
      try {
        const head = await fetch(cameraUrl, { method: "HEAD" });
        const xfo = head.headers.get("x-frame-options");
        const csp = head.headers.get("content-security-policy");
        const deniesXfo = xfo && /deny|sameorigin/i.test(xfo);
        const deniesCsp = csp && /frame-ancestors\s+('none'|none|self)/i.test(csp);
        embedAllowed = !(deniesXfo || deniesCsp);
      } catch {
        // Network or CORS may block reading headers; be optimistic and let client attempt
        embedAllowed = null;
      }
    }

    const merged = {
      beach_id: params.id,
      ndbc_buoy_ids: (data as any)?.ndbc_buoy_ids || null,
      forecast_source_id: (data as any)?.forecast_source_id || null,
      camera_url: cameraUrl,
      embed_allowed: embedAllowed,
    };

    return createSuccessResponse({ sources: merged });
  } catch (err) {
    return handleApiError(err, "Failed to fetch beach sources");
  }
}


