/**
 * Utilities for downloading and preparing share images for native sharing
 */

import type { ShareVariant } from "@/lib/social-share-utils";

/**
 * Download a share image from the OG image API
 * Returns a Blob that can be used for native sharing
 */
export async function downloadShareImage(
  imageUrl: string
): Promise<Blob> {
  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new Error(`Failed to download share image: ${response.statusText}`);
  }

  const blob = await response.blob();
  return blob;
}

/**
 * Convert image blob to platform-specific format if needed
 * Currently just returns the blob as PNG works universally
 */
export async function prepareImageForPlatform(
  imageBlob: Blob,
  platform: string
): Promise<Blob> {
  // For most platforms, PNG works fine
  // Could add platform-specific conversions here if needed
  return imageBlob;
}

/**
 * Create a File object from a Blob for sharing
 */
export function createShareImageFile(
  blob: Blob,
  sessionId: string,
  variant: ShareVariant
): File {
  const filename = `quiver-session-${sessionId}-${variant}.png`;
  return new File([blob], filename, { type: "image/png" });
}

/**
 * Check if the browser supports the Web Share API
 */
export function canShare(): boolean {
  return typeof navigator !== "undefined" && !!navigator.share;
}

/**
 * Check if the browser can share files
 */
export function canShareFiles(): boolean {
  if (!canShare()) return false;

  try {
    return navigator.canShare?.({ files: [] }) ?? false;
  } catch {
    return false;
  }
}
