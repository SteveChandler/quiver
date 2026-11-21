import { isBlockedCameraUrl } from "@/lib/media/camera-provider-policy";
import {
  buildCamEmbed,
  getCamPlaybackState,
  type CamEmbedIntent,
  type CamPlaybackState,
} from "@/lib/media/cam-embed";

const PREFLIGHT_TIMEOUT_MS = 3000;
const SURFLINE_HLS_HOST = "hls.cdn-surfline.com";
const SURFLINE_HEALTH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  Referer: "https://www.surfline.com/",
};

export function isSurflineHlsUrl(url: string | null): url is string {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return parsed.hostname === SURFLINE_HLS_HOST && parsed.pathname.endsWith(".m3u8");
  } catch {
    return false;
  }
}

/**
 * "unknown" = the check timed out. The sources route
 * treats that as down; the directory leaves the card as it is rather than
 * hide a cam on a slow answer.
 */
export async function checkSurflineHls(
  url: string,
  timeoutMs: number = PREFLIGHT_TIMEOUT_MS,
): Promise<"up" | "down" | "unknown"> {
  try {
    const response = await globalThis.fetch(url, {
      method: "HEAD",
      redirect: "error",
      headers: SURFLINE_HEALTH_HEADERS,
      signal: AbortSignal.timeout(timeoutMs),
    });

    return response.status === 200 ? "up" : "down";
  } catch (error) {
    // Only a slow answer is unknown; redirects, DNS and TLS failures are down, as in the route.
    return error instanceof Error && error.name === "TimeoutError" ? "unknown" : "down";
  }
}

export async function isSurflineHlsAvailable(url: string): Promise<boolean> {
  return (await checkSurflineHls(url)) === "up";
}

export interface CamEmbedPreflight {
  /** false = the beach page hides the player; null = headers unreadable, the client still tries. */
  embedAllowed: boolean | null;
  /** The camera page redirects to a retired provider; treat the camera as gone. */
  redirectsToBlockedProvider: boolean;
}

/**
 * Server-side check of whether the beach page can play `cameraUrl`.
 * Shared by GET /api/beaches/[id]/sources and the cam directory so a card
 * and the page it opens always agree.
 */
export async function preflightCamEmbed(
  cameraUrl: string,
  intent: CamEmbedIntent,
  timeoutMs: number = PREFLIGHT_TIMEOUT_MS,
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
      signal: AbortSignal.timeout(timeoutMs),
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

/** The directory renders ~100 cams at once, so it waits less than the beach page. */
export const DIRECTORY_PREFLIGHT_TIMEOUT_MS = 800;

/**
 * The playback the beach page will give for this camera, resolved with the
 * same checks as the sources route. A timeout or network error leaves the cam
 * live, as the beach page also still tries the player when headers are unreadable.
 */
export async function resolveCamPlayback(
  cameraUrl: string | null | undefined,
  timeoutMs: number = DIRECTORY_PREFLIGHT_TIMEOUT_MS,
): Promise<CamPlaybackState> {
  if (!cameraUrl || isBlockedCameraUrl(cameraUrl)) return { kind: "none" };
  if (isSurflineHlsUrl(cameraUrl) && (await checkSurflineHls(cameraUrl, timeoutMs)) === "down") {
    return { kind: "none" };
  }

  const intent = buildCamEmbed(cameraUrl);
  if (intent.kind === "none") return { kind: "none" };

  const preflight = await preflightCamEmbed(cameraUrl, intent, timeoutMs);
  if (preflight.redirectsToBlockedProvider) return { kind: "none" };
  return getCamPlaybackState(intent, preflight.embedAllowed);
}
