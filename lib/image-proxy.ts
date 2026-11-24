import { toWikimediaThumbUrl } from "@/lib/utils/image-utils";

/**
 * Image Proxy Utilities
 *
 * Provides functions to proxy external images through our API route,
 * enabling Next.js Image Optimization for external sources.
 */

const EXTERNAL_IMAGE_PATTERNS = [
  "openverse.org",
  "wikimedia.org",
  "flickr.com",
  "wordpress.com",
  "wp.com",
];

function isImageProxyUrl(url: string): boolean {
  if (url.startsWith("/api/image-proxy")) return true;

  try {
    return new URL(url).pathname === "/api/image-proxy";
  } catch {
    return false;
  }
}

/**
 * Checks if a URL should be proxied through our image proxy API
 */
function shouldProxyImage(url: string): boolean {
  if (!url) return false;
  if (isImageProxyUrl(url)) return false;
  return EXTERNAL_IMAGE_PATTERNS.some((pattern) => url.includes(pattern));
}

/**
 * Returns a proxied URL if needed, otherwise returns the original URL
 */
export function getOptimizedImageUrl(rawUrl: string): string {
  if (!shouldProxyImage(rawUrl)) {
    return rawUrl;
  }

  // Encode the URL and return the proxy URL
  const encodedUrl = encodeURIComponent(toWikimediaThumbUrl(rawUrl));
  return `/api/image-proxy?url=${encodedUrl}`;
}
