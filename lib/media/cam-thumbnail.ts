/**
 * Extract a static thumbnail URL from a camera URL.
 * Currently supports YouTube; returns null for other providers.
 */
export function getCamThumbnailUrl(
  cameraUrl: string | null | undefined
): string | null {
  if (!cameraUrl) return null;

  const videoId = getYouTubeVideoId(cameraUrl);
  if (videoId) {
    return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
  }

  return null;
}

export function getYouTubeVideoId(
  cameraUrl: string | null | undefined
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
  cameraUrl: string | null | undefined
): string | null {
  const videoId = getYouTubeVideoId(cameraUrl);
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
}

export function isYouTubeCameraUrl(
  cameraUrl: string | null | undefined
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

const QUIVER_CAM_THUMBNAIL_BUCKET_PATH = "/storage/v1/object/public/cam-thumbnails/";
const STORED_PAGE_CAPTURE_HOSTS = new Set(["obhotel.com", "www.obhotel.com"]);

function isQuiverStoredCamThumbnail(thumbnailUrl: string): boolean {
  try {
    return new URL(thumbnailUrl).pathname.includes(QUIVER_CAM_THUMBNAIL_BUCKET_PATH);
  } catch {
    return false;
  }
}

function isKnownPageCaptureCamera(cameraUrl: string | null | undefined): boolean {
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
  if (
    thumbnailUrl &&
    isKnownPageCaptureCamera(cameraUrl) &&
    isQuiverStoredCamThumbnail(thumbnailUrl)
  ) {
    return getCamThumbnailUrl(cameraUrl);
  }

  return thumbnailUrl || getCamThumbnailUrl(cameraUrl);
}
