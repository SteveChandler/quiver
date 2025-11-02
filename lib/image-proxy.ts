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

/**
 * Checks if a URL should be proxied through our image proxy API
 */
export function shouldProxyImage(url: string): boolean {
  if (!url) return false;
  return EXTERNAL_IMAGE_PATTERNS.some((pattern) => url.includes(pattern));
}

/**
 * Returns a proxied URL if needed, otherwise returns the original URL
 */
export function getOptimizedImageUrl(url: string): string {
  if (!shouldProxyImage(url)) {
    return url;
  }

  // Encode the URL and return the proxy URL
  const encodedUrl = encodeURIComponent(url);
  return `/api/image-proxy?url=${encodedUrl}`;
}
