import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSuccessResponse,
  handleApiError,
} from "@/lib/middleware/api-wrappers";
import {
  buildCamEmbed,
  getViewableUrl,
  toProxiedHlsUrl,
} from "@/lib/media/cam-embed";
import { GET as resolveCamUrl } from "@/app/api/cam-resolve/route";

type StreamPayload =
  | {
      kind: "none";
      stream_url: null;
      page_url: null;
      provider: null;
    }
  | {
      kind: "image" | "video" | "hls" | "iframe" | "external";
      stream_url: string | null;
      page_url: string | null;
      provider: string | null;
    };

async function getCameraUrlForBeach(beachId: string): Promise<{
  cameraUrl: string | null;
  error: unknown | null;
}> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("beach_sources")
    .select("camera_url")
    .eq("beach_id", beachId)
    .maybeSingle();

  if (error) {
    return { cameraUrl: null, error };
  }

  let cameraUrl = (data as { camera_url?: string | null } | null)?.camera_url ?? null;

  if (!cameraUrl) {
    const { data: beachRow, error: beachErr } = await supabase
      .from("beaches")
      .select("id, live_cam_url, camera_url")
      .eq("id", beachId)
      .maybeSingle();

    if (beachErr) {
      return { cameraUrl: null, error: beachErr };
    }

    cameraUrl =
      ((beachRow as { liveCamUrl?: string | null } | null)?.liveCamUrl as
        | string
        | null
        | undefined) ??
      ((beachRow as { live_cam_url?: string | null } | null)?.live_cam_url ??
        null) ??
      ((beachRow as { camera_url?: string | null } | null)?.camera_url ??
        null);
  }

  return { cameraUrl, error: null };
}

function buildResponse(payload: StreamPayload, cacheControl: string): NextResponse {
  const response = createSuccessResponse(payload);
  response.headers.set("Cache-Control", cacheControl);
  return response;
}

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;

  try {
    const { cameraUrl, error } = await getCameraUrlForBeach(params.id);
    if (error) {
      return handleApiError(error, "Failed to fetch beach camera");
    }

    if (!cameraUrl) {
      return buildResponse(
        { kind: "none", stream_url: null, page_url: null, provider: null },
        "public, s-maxage=300, stale-while-revalidate=600"
      );
    }

    const intent = buildCamEmbed(cameraUrl);

    switch (intent.kind) {
      case "none":
        return buildResponse(
          { kind: "none", stream_url: null, page_url: null, provider: null },
          "public, s-maxage=300, stale-while-revalidate=600"
        );
      case "image":
        return buildResponse(
          {
            kind: "image",
            stream_url: intent.src,
            page_url: getViewableUrl(cameraUrl),
            provider: null,
          },
          "public, s-maxage=300, stale-while-revalidate=600"
        );
      case "video":
        return buildResponse(
          {
            kind: "video",
            stream_url: intent.src,
            page_url: getViewableUrl(cameraUrl),
            provider: null,
          },
          "public, s-maxage=300, stale-while-revalidate=600"
        );
      case "hls":
        return buildResponse(
          {
            kind: "hls",
            stream_url: toProxiedHlsUrl(intent.src),
            page_url: getViewableUrl(cameraUrl),
            provider: null,
          },
          "public, s-maxage=120, stale-while-revalidate=120"
        );
      case "iframe":
        return buildResponse(
          {
            kind: "iframe",
            stream_url: intent.src,
            page_url: getViewableUrl(cameraUrl),
            provider: null,
          },
          "public, s-maxage=300, stale-while-revalidate=600"
        );
      case "external":
        return buildResponse(
          {
            kind: "external",
            stream_url: null,
            page_url: intent.pageUrl,
            provider: intent.provider,
          },
          "public, s-maxage=300, stale-while-revalidate=600"
        );
      case "hdontap": {
        const resolveRequest = new NextRequest(
          new URL(
            `/api/cam-resolve?url=${encodeURIComponent(intent.pageUrl)}`,
            request.url
          )
        );
        const resolved = await resolveCamUrl(resolveRequest);

        if (!resolved.ok) {
          const body = await resolved.json().catch(() => ({}));
          return NextResponse.json(
            {
              error:
                typeof body?.error === "string"
                  ? body.error
                  : "Failed to resolve stream",
            },
            { status: resolved.status }
          );
        }

        const body = (await resolved.json()) as { hlsUrl?: string };
        if (!body.hlsUrl) {
          return NextResponse.json(
            { error: "No stream found" },
            { status: 404 }
          );
        }

        return buildResponse(
          {
            kind: "hls",
            stream_url: toProxiedHlsUrl(body.hlsUrl),
            page_url: null,
            provider: null,
          },
          "public, s-maxage=120, stale-while-revalidate=120"
        );
      }
      default:
        return buildResponse(
          { kind: "none", stream_url: null, page_url: null, provider: null },
          "public, s-maxage=300, stale-while-revalidate=600"
        );
    }
  } catch (err) {
    return handleApiError(err, "Failed to build beach stream");
  }
}
