/**
 * Cross-Platform Image Share Utility
 *
 * Shares images across Web and Capacitor (iOS/Android).
 * Uses native share sheets on mobile, Web Share API on desktop,
 * with download fallback when share APIs are unavailable.
 */

import { isNativeApp, getNativePlatform } from "@/lib/mobile/platform";

export interface ShareImageOptions {
  /** Optional title for the share dialog */
  title?: string;
  /** Optional text/description for the share */
  text?: string;
  /** Callback for loading state changes */
  onLoadingChange?: (isLoading: boolean) => void;
}

export interface ShareImageResult {
  success: boolean;
  method: "native-share" | "web-share" | "download";
  error?: string;
}

/**
 * Custom error for share operations
 */
export class ShareImageError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "FETCH_FAILED"
      | "BLOB_CONVERSION_FAILED"
      | "FILESYSTEM_ERROR"
      | "SHARE_CANCELLED"
      | "SHARE_FAILED"
      | "UNSUPPORTED"
  ) {
    super(message);
    this.name = "ShareImageError";
  }
}

/**
 * Fetches an image and converts it to a Blob
 */
export async function fetchImageAsBlob(imageUrl: string): Promise<Blob> {
  // Block dangerous URL protocols; allow relative URLs and http/https
  if (typeof imageUrl === "string" && imageUrl.length > 0) {
    const protocol = imageUrl.split(":")[0]?.toLowerCase();
    if (protocol && protocol !== "https" && protocol !== "http" && !imageUrl.startsWith("/")) {
      throw new ShareImageError("Invalid image URL protocol", "FETCH_FAILED");
    }
  }

  try {
    const response = await fetch(imageUrl, {
      mode: "cors",
      credentials: "omit",
    });

    if (!response.ok) {
      throw new ShareImageError(
        `Failed to fetch image: ${response.status} ${response.statusText}`,
        "FETCH_FAILED"
      );
    }

    const blob = await response.blob();

    if (!blob.type.startsWith("image/")) {
      throw new ShareImageError(
        `Invalid content type: ${blob.type}. Expected an image.`,
        "BLOB_CONVERSION_FAILED"
      );
    }

    return blob;
  } catch (error) {
    if (error instanceof ShareImageError) throw error;
    throw new ShareImageError(
      `Failed to fetch image: ${error instanceof Error ? error.message : "Unknown error"}`,
      "FETCH_FAILED"
    );
  }
}

/**
 * Converts a Blob to base64 string (without data URL prefix)
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/png;base64,")
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Failed to convert blob to base64"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Gets file extension from MIME type
 */
function getExtensionFromMime(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
  };
  return mimeToExt[mimeType] || "png";
}

/**
 * Shares image using Capacitor native plugins
 */
async function shareNative(
  blob: Blob,
  filename: string,
  options: ShareImageOptions
): Promise<ShareImageResult> {
  try {
    // Dynamic imports for Capacitor plugins
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import("@capacitor/filesystem"),
      import("@capacitor/share"),
    ]);

    // Ensure filename has extension
    const ext = getExtensionFromMime(blob.type);
    const fullFilename = filename.includes(".") ? filename : `${filename}.${ext}`;

    // Convert blob to base64
    const base64Data = await blobToBase64(blob);

    // Write to cache directory
    const writeResult = await Filesystem.writeFile({
      path: fullFilename,
      data: base64Data,
      directory: Directory.Cache,
    });

    // Share the file
    const platform = getNativePlatform();
    const fileUri = writeResult.uri;

    await Share.share({
      title: options.title,
      text: options.text,
      files: [fileUri],
      dialogTitle: options.title || "Share Image",
    });

    // Clean up cached file after a delay (non-blocking)
    setTimeout(async () => {
      try {
        await Filesystem.deleteFile({
          path: fullFilename,
          directory: Directory.Cache,
        });
      } catch {
        // Ignore cleanup errors
      }
    }, 30000);

    return { success: true, method: "native-share" };
  } catch (error) {
    // Check if user cancelled the share
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes("cancel") ||
      errorMessage.includes("Cancel") ||
      errorMessage.includes("dismissed")
    ) {
      throw new ShareImageError("Share cancelled by user", "SHARE_CANCELLED");
    }

    // Check for filesystem errors
    if (errorMessage.includes("Filesystem") || errorMessage.includes("file")) {
      throw new ShareImageError(
        `Filesystem error: ${errorMessage}`,
        "FILESYSTEM_ERROR"
      );
    }

    throw new ShareImageError(
      `Native share failed: ${errorMessage}`,
      "SHARE_FAILED"
    );
  }
}

/**
 * Shares image using Web Share API
 */
async function shareWeb(
  blob: Blob,
  filename: string,
  options: ShareImageOptions
): Promise<ShareImageResult> {
  // Check if Web Share API supports files
  if (!navigator.canShare) {
    throw new ShareImageError("Web Share API not supported", "UNSUPPORTED");
  }

  const ext = getExtensionFromMime(blob.type);
  const fullFilename = filename.includes(".") ? filename : `${filename}.${ext}`;

  const file = new File([blob], fullFilename, { type: blob.type });

  if (!navigator.canShare({ files: [file] })) {
    throw new ShareImageError(
      "Web Share API does not support sharing files",
      "UNSUPPORTED"
    );
  }

  try {
    await navigator.share({
      title: options.title,
      text: options.text,
      files: [file],
    });

    return { success: true, method: "web-share" };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ShareImageError("Share cancelled by user", "SHARE_CANCELLED");
    }
    throw new ShareImageError(`Web share failed: ${errorMessage}`, "SHARE_FAILED");
  }
}

/**
 * Downloads image as fallback
 */
export function downloadImage(blob: Blob, filename: string): ShareImageResult {
  const ext = getExtensionFromMime(blob.type);
  const fullFilename = filename.includes(".") ? filename : `${filename}.${ext}`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fullFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Revoke object URL after a short delay
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return { success: true, method: "download" };
}

/**
 * Copies text to the clipboard
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    throw new Error("Clipboard API not available");
  }
  await navigator.clipboard.writeText(text);
}

/**
 * Shares an image from a URL across platforms
 *
 * - iOS: Opens native share sheet with image attached
 * - Android: Opens native share sheet with image attached
 * - Web: Uses Web Share API when available, falls back to download
 *
 * @param imageUrl - URL of the image to share
 * @param filename - Filename for the shared image (extension added automatically if missing)
 * @param options - Optional configuration for sharing
 * @returns Result indicating success and method used
 * @throws ShareImageError for meaningful error handling
 *
 * @example
 * ```typescript
 * try {
 *   const result = await shareImage(
 *     "https://example.com/image.png",
 *     "my-surf-session",
 *     {
 *       title: "Check out my session!",
 *       text: "Had an epic day at Pipeline",
 *       onLoadingChange: (loading) => setIsLoading(loading)
 *     }
 *   );
 *   console.log(`Shared via ${result.method}`);
 * } catch (error) {
 *   if (error instanceof ShareImageError) {
 *     if (error.code === "SHARE_CANCELLED") {
 *       // User cancelled, no action needed
 *     } else {
 *       console.error("Share failed:", error.message);
 *     }
 *   }
 * }
 * ```
 */
export async function shareImage(
  imageUrl: string,
  filename: string,
  options: ShareImageOptions = {}
): Promise<ShareImageResult> {
  const { onLoadingChange } = options;

  try {
    onLoadingChange?.(true);

    // Fetch and convert image to blob
    const blob = await fetchImageAsBlob(imageUrl);

    // Try native share first (Capacitor)
    if (isNativeApp()) {
      return await shareNative(blob, filename, options);
    }

    // Try Web Share API
    try {
      return await shareWeb(blob, filename, options);
    } catch (error) {
      // If Web Share fails due to being unsupported, fall back to download
      if (error instanceof ShareImageError && error.code === "UNSUPPORTED") {
        return downloadImage(blob, filename);
      }
      throw error;
    }
  } finally {
    onLoadingChange?.(false);
  }
}

/**
 * Checks if sharing is supported on the current platform
 * (Always returns true since we have download fallback)
 */
function isShareSupported(): boolean {
  return true;
}

/**
 * Checks if native share sheet is available
 */
function isNativeShareAvailable(): boolean {
  if (isNativeApp()) return true;
  if (typeof navigator === "undefined") return false;
  return typeof navigator.share === "function" && typeof navigator.canShare === "function";
}
