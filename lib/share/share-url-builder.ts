/**
 * Share URL Builder
 * Generates platform-specific share URLs and download links
 */

import type { SessionWithDetails } from "@/types/database";
import type { SharePlatform, ShareURL, AspectRatio, ShareVariant } from "@/types/session-share";
import { buildShareText, buildShortShareText, buildInstagramLinkStickerTooltip } from "./share-text-builder";

/**
 * Get base URL for the application
 */
function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";
}

/**
 * Map numeric ShareVariant (1-6) and AspectRatio to string variant for HMAC-signed endpoint
 * This provides compatibility between the old authenticated endpoint and new signed endpoint
 */
export function mapVariantToSignedParams(
  variant: ShareVariant,
  aspectRatio: AspectRatio
): { variant: "story" | "square"; ratio: AspectRatio } {
  // Map based on aspect ratio primarily, as that determines the actual dimensions
  // variant parameter becomes the string variant for the signed endpoint
  const stringVariant = aspectRatio === "9:16" ? "story" : "square";

  return {
    variant: stringVariant,
    ratio: aspectRatio,
  };
}

/**
 * Build share page URL for a session
 */
export function buildSharePageUrl(sessionId: string): string {
  const baseUrl = getBaseUrl();
  return `${baseUrl}/s/${sessionId}`;
}

/**
 * Build image download URL
 */
export function buildImageUrl(
  sessionId: string,
  variant: ShareVariant,
  aspectRatio: AspectRatio
): string {
  const baseUrl = getBaseUrl();
  return `${baseUrl}/api/sessions/${sessionId}/share-image?variant=${variant}&ratio=${encodeURIComponent(aspectRatio)}`;
}

/**
 * Build preview page URL
 */
export function buildPreviewPageUrl(
  sessionId: string,
  variant: ShareVariant,
  aspectRatio: AspectRatio
): string {
  const baseUrl = getBaseUrl();
  return `${baseUrl}/share/${sessionId}/${variant}/${encodeURIComponent(aspectRatio)}`;
}

/**
 * Build Twitter/X share intent URL
 */
export function buildTwitterShareUrl(
  session: SessionWithDetails,
  sessionId: string
): ShareURL {
  const sharePageUrl = buildSharePageUrl(sessionId);
  const text = buildShortShareText(session);
  const encodedText = encodeURIComponent(text);
  const encodedUrl = encodeURIComponent(sharePageUrl);

  return {
    url: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
    text: text,
  };
}

/**
 * Build Facebook share URL
 */
export function buildFacebookShareUrl(sessionId: string): ShareURL {
  const sharePageUrl = buildSharePageUrl(sessionId);
  const encodedUrl = encodeURIComponent(sharePageUrl);

  return {
    url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
  };
}

/**
 * Build Instagram share instructions
 * Instagram doesn't have a web share URL, so we return download URL and instructions
 */
export function buildInstagramShareUrl(
  sessionId: string,
  variant: ShareVariant,
  aspectRatio: AspectRatio = "9:16"
): ShareURL {
  const downloadUrl = buildImageUrl(sessionId, variant, aspectRatio);
  const tooltip = buildInstagramLinkStickerTooltip(sessionId);

  return {
    url: downloadUrl,
    tooltip: tooltip,
    text: "Download image and share to Instagram Stories",
  };
}

/**
 * Build generic share URL (for navigator.share or copy link)
 */
export function buildGenericShareUrl(sessionId: string): ShareURL {
  const sharePageUrl = buildSharePageUrl(sessionId);

  return {
    url: sharePageUrl,
    text: "Share this session",
  };
}

/**
 * Build platform-specific share URL
 */
export function buildPlatformShareUrl(
  platform: SharePlatform,
  session: SessionWithDetails,
  sessionId: string,
  variant: ShareVariant,
  aspectRatio: AspectRatio
): ShareURL {
  switch (platform) {
    case "instagram":
      return buildInstagramShareUrl(sessionId, variant, aspectRatio);

    case "x":
      return buildTwitterShareUrl(session, sessionId);

    case "facebook":
      return buildFacebookShareUrl(sessionId);

    case "download":
      return {
        url: buildImageUrl(sessionId, variant, aspectRatio),
        text: "Download image",
      };

    case "generic":
    default:
      return buildGenericShareUrl(sessionId);
  }
}

/**
 * Check if Web Share API is available
 */
export function isWebShareAvailable(): boolean {
  if (typeof window === "undefined") return false;
  return !!navigator.share;
}

/**
 * Build Web Share API data
 */
export function buildWebShareData(
  session: SessionWithDetails,
  sessionId: string
): ShareData {
  const sharePageUrl = buildSharePageUrl(sessionId);
  const text = buildShareText(session);
  const beachName = session.beaches?.name || "Unknown Beach";

  return {
    title: `Surf Session at ${beachName}`,
    text: text,
    url: sharePageUrl,
  };
}

/**
 * Trigger native share (mobile)
 */
export async function triggerNativeShare(
  session: SessionWithDetails,
  sessionId: string
): Promise<boolean> {
  if (!isWebShareAvailable()) {
    return false;
  }

  try {
    const shareData = buildWebShareData(session, sessionId);
    await navigator.share(shareData);
    return true;
  } catch (error) {
    // User cancelled or share failed
    console.error("Native share failed:", error);
    return false;
  }
}

/**
 * Copy URL to clipboard
 */
export async function copyShareUrl(sessionId: string): Promise<boolean> {
  if (typeof window === "undefined" || !navigator.clipboard) {
    return false;
  }

  try {
    const sharePageUrl = buildSharePageUrl(sessionId);
    await navigator.clipboard.writeText(sharePageUrl);
    return true;
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    return false;
  }
}

/**
 * Open share URL in new window
 */
export function openShareUrl(url: string): void {
  if (typeof window === "undefined") return;

  const width = 550;
  const height = 420;
  const left = (window.screen.width - width) / 2;
  const top = (window.screen.height - height) / 2;

  window.open(
    url,
    "share",
    `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`
  );
}

/**
 * Download image from URL
 */
export async function downloadImage(
  url: string,
  filename: string
): Promise<boolean> {
  if (typeof window === "undefined") return false;

  try {
    const response = await fetch(url);

    // Check response status before processing
    if (!response.ok) {
      // Try to get error message from JSON response
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.error ||
        `HTTP ${response.status}: ${response.statusText}`;
      console.error("Failed to download image:", errorMessage);
      return false;
    }

    // Validate content type (optional but recommended)
    const contentType = response.headers.get("content-type");
    if (contentType && !contentType.startsWith("image/")) {
      console.error("Invalid content type:", contentType);
      return false;
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up blob URL
    setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

    return true;
  } catch (error) {
    console.error("Failed to download image:", error);
    return false;
  }
}

/**
 * Build filename for downloaded image
 */
export function buildImageFilename(
  session: SessionWithDetails,
  variant: ShareVariant,
  aspectRatio: AspectRatio
): string {
  const beachName = session.beaches?.name || "session";
  const date = new Date(session.arrival_time).toISOString().split("T")[0];
  const sanitizedBeachName = beachName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return `quiversurf-${sanitizedBeachName}-${date}-v${variant}-${aspectRatio.replace(":", "x")}.png`;
}
