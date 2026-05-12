/**
 * Extract a static thumbnail URL from a camera URL.
 * Currently supports YouTube; returns null for other providers.
 */
export function getCamThumbnailUrl(
  cameraUrl: string | null | undefined
): string | null {
  if (!cameraUrl) return null;

  try {
    const url = new URL(cameraUrl);

    // YouTube - multiple URL formats
    let videoId: string | null = null;

    if (url.hostname.includes("youtube.com")) {
      if (url.pathname === "/watch") {
        videoId = url.searchParams.get("v");
      } else if (url.pathname.startsWith("/live/")) {
        videoId = url.pathname.split("/live/")[1]?.split(/[?/]/)[0] || null;
      } else if (url.pathname.startsWith("/embed/")) {
        videoId = url.pathname.split("/embed/")[1]?.split(/[?/]/)[0] || null;
      }
    } else if (url.hostname === "youtu.be") {
      videoId = url.pathname.slice(1).split(/[?/]/)[0] || null;
    }

    if (videoId) {
      return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
    }

    // Vimeo, HDOnTap, HLS, direct video — no static thumbnail available
    return null;
  } catch {
    return null;
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
