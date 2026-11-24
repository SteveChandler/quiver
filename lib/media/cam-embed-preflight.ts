import { unstable_cache } from "next/cache";

import { isBlockedCameraUrl } from "@/lib/media/camera-provider-policy";
import {
  buildCamEmbed,
  getCamPlaybackState,
  type CamEmbedIntent,
  type CamPlaybackState,
} from "@/lib/media/cam-embed";

/**
 * One timeout for the beach page and the directory. Measured camera-page HEAD
 * times were mostly under 0.9 s; one host never answers within 3 s.
 */
const PREFLIGHT_TIMEOUT_MS = 1500;
const PREFLIGHT_REVALIDATE_SECONDS = 3600;
const SURFLINE_HLS_HOST = "hls.cdn-surfline.com";
const SURFLINE_HEALTH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  Referer: "https://www.surfline.com/",
};

function isSurflineHlsUrl(url: string | null): url is string {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return parsed.hostname === SURFLINE_HLS_HOST && parsed.pathname.endsWith(".m3u8");
  } catch {
    return false;
  }
}

type SurflineHlsHealth = "up" | "down" | "unknown";

/** "unknown" = the check timed out; the camera stays, and the player falls back to a still if the stream fails. */
async function checkSurflineHls(url: string): Promise<SurflineHlsHealth> {
  try {
    const response = await globalThis.fetch(url, {
      method: "HEAD",
      redirect: "error",
      headers: SURFLINE_HEALTH_HEADERS,
      signal: AbortSignal.timeout(PREFLIGHT_TIMEOUT_MS),
    });

    return response.status === 200 ? "up" : "down";
  } catch (error) {
    // Only a slow answer is unknown; redirects, DNS and TLS failures are down, as in the route.
    return error instanceof Error && error.name === "TimeoutError" ? "unknown" : "down";
  }
}

interface CamEmbedPreflight {
  /** false = the beach page hides the player; null = headers unreadable, the client still tries. */
  embedAllowed: boolean | null;
  /** The camera page redirects to a retired provider; treat the camera as gone. */
  redirectsToBlockedProvider: boolean;
}

/**
 * Server-side check of whether the beach page can play `cameraUrl`.
 */
async function preflightCamEmbed(
  cameraUrl: string,
  intent: CamEmbedIntent,
): Promise<CamEmbedPreflight> {
  if (intent.kind === "external") {
    return { embedAllowed: false, redirectsToBlockedProvider: false };
  }
  if (intent.kind === "hls" || intent.kind === "video" || intent.kind === "hdontap") {
    return { embedAllowed: true, redirectsToBlockedProvider: false };
  }
  if (
    cameraUrl.includes("youtube.com/") ||
    cameraUrl.includes("youtu.be/") ||
    cameraUrl.includes("vimeo.com/")
  ) {
    return { embedAllowed: true, redirectsToBlockedProvider: false };
  }
  if (intent.kind !== "iframe") {
    return { embedAllowed: null, redirectsToBlockedProvider: false };
  }

  try {
    const head = await globalThis.fetch(cameraUrl, {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(PREFLIGHT_TIMEOUT_MS),
    });
    const xfo = head.headers.get("x-frame-options");
    const csp = head.headers.get("content-security-policy");
    const deniesXfo = xfo && /deny|sameorigin/i.test(xfo);
    const deniesCsp = csp && /frame-ancestors\s+('none'|none|self)/i.test(csp);
    return {
      embedAllowed: head.ok && !(deniesXfo || deniesCsp),
      redirectsToBlockedProvider:
        head.status >= 300 &&
        head.status < 400 &&
        isBlockedCameraUrl(head.headers.get("location")),
    };
  } catch {
    // Network or CORS may block reading headers; be optimistic and let client attempt
    return { embedAllowed: null, redirectsToBlockedProvider: false };
  }
}

interface CamPreflightResult extends CamEmbedPreflight {
  /** null when the camera is not a Surfline HLS stream. */
  surflineHls: SurflineHlsHealth | null;
}

async function runCamPreflight(cameraUrl: string): Promise<CamPreflightResult> {
  const surflineHls = isSurflineHlsUrl(cameraUrl) ? await checkSurflineHls(cameraUrl) : null;
  const preflight = await preflightCamEmbed(cameraUrl, buildCamEmbed(cameraUrl));
  return { surflineHls, ...preflight };
}

/**
 * One stored answer per camera URL, read by GET /api/beaches/[id]/sources and
 * by the cam directory, so a card and the page it opens always agree.
 */
export const getCamPreflight = unstable_cache(runCamPreflight, ["cam-embed-preflight-v1"], {
  revalidate: PREFLIGHT_REVALIDATE_SECONDS,
});

export function playbackFromPreflight(
  cameraUrl: string,
  preflight: CamPreflightResult,
): CamPlaybackState {
  if (preflight.surflineHls === "down" || preflight.redirectsToBlockedProvider) {
    return { kind: "none" };
  }
  return getCamPlaybackState(buildCamEmbed(cameraUrl), preflight.embedAllowed);
}

/** The playback the beach page will give for this camera. */
export async function resolveCamPlayback(
  cameraUrl: string | null | undefined,
): Promise<CamPlaybackState> {
  if (!cameraUrl || isBlockedCameraUrl(cameraUrl)) return { kind: "none" };
  if (buildCamEmbed(cameraUrl).kind === "none") return { kind: "none" };
  return playbackFromPreflight(cameraUrl, await getCamPreflight(cameraUrl));
}
