/**
 * Extract a static thumbnail URL from a camera URL.
 * Supports providers with stable public thumbnail patterns.
 */
export function getCamThumbnailUrl(
  cameraUrl: string | null | undefined,
): string | null {
  if (!cameraUrl) return null;

  const videoId = getYouTubeVideoId(cameraUrl);
  if (videoId) {
    if (KNOWN_STALE_YOUTUBE_VIDEO_IDS.has(videoId)) return null;

    return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
  }

  const surflineCamId = getSurflineCamId(cameraUrl);
  if (surflineCamId) {
    return `https://camstills.cdn-surfline.com/${surflineCamId}/latest_small.jpg`;
  }

  return null;
}

function getSurflineCamId(cameraUrl: string | null | undefined): string | null {
  if (!cameraUrl) return null;

  try {
    const url = new URL(cameraUrl);
    const hostname = url.hostname.replace(/^www\./, "");
    if (hostname !== "embed.cdn-surfline.com") return null;

    const [section, camId] = url.pathname.split("/").filter(Boolean);
    if (section !== "cams" || !camId) return null;

    return camId;
  } catch {
    return null;
  }
}

export function getYouTubeVideoId(
  cameraUrl: string | null | undefined,
): string | null {
  if (!cameraUrl) return null;

  try {
    const url = new URL(cameraUrl);
    const hostname = url.hostname.replace(/^www\./, "");
    let videoId: string | null = null;

    if (hostname === "youtube.com" || hostname.endsWith(".youtube.com")) {
      if (url.pathname === "/watch") {
        videoId = url.searchParams.get("v");
      } else if (url.pathname.startsWith("/live/")) {
        videoId = url.pathname.split("/live/")[1]?.split(/[?/]/)[0] || null;
      } else if (url.pathname.startsWith("/embed/")) {
        videoId = url.pathname.split("/embed/")[1]?.split(/[?/]/)[0] || null;
      }
    } else if (hostname === "youtu.be") {
      videoId = url.pathname.slice(1).split(/[?/]/)[0] || null;
    }

    if (videoId) {
      return videoId;
    }

    return null;
  } catch {
    return null;
  }
}

export function getYouTubeWatchUrl(
  cameraUrl: string | null | undefined,
): string | null {
  const videoId = getYouTubeVideoId(cameraUrl);
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
}

export function isYouTubeCameraUrl(
  cameraUrl: string | null | undefined,
): boolean {
  if (!cameraUrl) return false;

  try {
    const hostname = new URL(cameraUrl).hostname.replace(/^www\./, "");
    return (
      hostname === "youtube.com" ||
      hostname.endsWith(".youtube.com") ||
      hostname === "youtu.be"
    );
  } catch {
    return false;
  }
}

export const CAM_CARD_FALLBACK_IMAGE_URL = "/images/og-location-default.jpg";

const QUIVER_CAM_THUMBNAIL_BUCKET_PATH =
  "/storage/v1/object/public/cam-thumbnails/";
const HDONTAP_THUMBNAIL_BUCKET_PATH = "/wowza_stream_thumbnails/";
const STORED_PAGE_CAPTURE_HOSTS = new Set(["obhotel.com", "www.obhotel.com"]);
const KNOWN_STALE_YOUTUBE_VIDEO_IDS = new Set(["0bv7YxPWRdw"]);
const KNOWN_STALE_THUMBNAIL_PATHS = new Set([
  "/wowza_stream_thumbnails/snapshot_cardiffreef_hs-CUST.stream.jpg",
]);

function appendUniqueUrl(urls: string[], url: string | null | undefined): void {
  if (!url || urls.includes(url)) return;
  urls.push(url);
}

function isQuiverStoredCamThumbnail(thumbnailUrl: string): boolean {
  try {
    return new URL(thumbnailUrl).pathname.includes(
      QUIVER_CAM_THUMBNAIL_BUCKET_PATH,
    );
  } catch {
    return false;
  }
}

function isKnownStaleCamThumbnail(thumbnailUrl: string): boolean {
  try {
    const url = new URL(thumbnailUrl);
    if (url.hostname === "img.youtube.com") {
      const [, videoId] = url.pathname.split("/vi/");
      return KNOWN_STALE_YOUTUBE_VIDEO_IDS.has(videoId?.split("/")[0] ?? "");
    }

    if (url.hostname !== "storage.hdontap.com") return false;
    if (!url.pathname.startsWith(HDONTAP_THUMBNAIL_BUCKET_PATH)) return false;

    return (
      /\.stream_[^/]+\.jpg$/i.test(url.pathname) ||
      KNOWN_STALE_THUMBNAIL_PATHS.has(url.pathname)
    );
  } catch {
    return false;
  }
}

function isKnownPageCaptureCamera(
  cameraUrl: string | null | undefined,
): boolean {
  if (!cameraUrl) return false;

  try {
    return STORED_PAGE_CAPTURE_HOSTS.has(new URL(cameraUrl).hostname);
  } catch {
    return false;
  }
}

export function getDisplayCamThumbnailUrl({
  cameraUrl,
  thumbnailUrl,
}: {
  cameraUrl: string | null | undefined;
  thumbnailUrl: string | null | undefined;
}): string | null {
  if (thumbnailUrl && isKnownStaleCamThumbnail(thumbnailUrl)) {
    return getCamThumbnailUrl(cameraUrl);
  }

  if (
    thumbnailUrl &&
    isKnownPageCaptureCamera(cameraUrl) &&
    isQuiverStoredCamThumbnail(thumbnailUrl)
  ) {
    return getCamThumbnailUrl(cameraUrl);
  }

  return thumbnailUrl || getCamThumbnailUrl(cameraUrl);
}

export function getDisplayCamThumbnailUrls({
  cameraUrl,
  thumbnailUrl,
  fallbackImageUrl,
}: {
  cameraUrl: string | null | undefined;
  thumbnailUrl: string | null | undefined;
  fallbackImageUrl?: string | null | undefined;
}): string[] {
  const urls: string[] = [];

  appendUniqueUrl(
    urls,
    getDisplayCamThumbnailUrl({
      cameraUrl,
      thumbnailUrl,
    }),
  );
  appendUniqueUrl(urls, getCamThumbnailUrl(cameraUrl));
  appendUniqueUrl(urls, fallbackImageUrl);
  appendUniqueUrl(urls, CAM_CARD_FALLBACK_IMAGE_URL);

  return urls;
}
