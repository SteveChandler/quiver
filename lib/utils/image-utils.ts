/**
 * Image Utilities
 *
 * Provides utility functions for handling image URLs in the Quiver application,
 * particularly for proxying external images through the image proxy endpoint.
 */

/**
 * Determines if a URL should be proxied through the image proxy endpoint.
 *
 * URLs that should NOT be proxied:
 * - Relative URLs (e.g., '/images/logo.png')
 * - Supabase storage URLs
 * - URLs from the app's own domain
 * - null, undefined, or empty strings
 *
 * URLs that SHOULD be proxied:
 * - External HTTP(S) URLs (e.g., from Openverse, Wikimedia, etc.)
 *
 * @param url - The image URL to check
 * @returns true if the URL should be proxied, false otherwise
 */
function shouldProxyUrl(url: string | null | undefined): boolean {
  // Handle null, undefined, or empty strings
  if (!url || url.trim() === '') {
    return false;
  }

  // Relative URLs don't need proxying
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return false;
  }

  // Don't proxy Supabase storage URLs
  if (url.includes('.supabase.co/storage/')) {
    return false;
  }

  // Don't proxy URLs from our own domain
  if (typeof window !== 'undefined') {
    try {
      const urlObj = new URL(url);
      const currentHost = window.location.host;
      if (urlObj.host === currentHost) {
        return false;
      }
    } catch {
      // If URL parsing fails, don't proxy
      return false;
    }
  }

  // All other HTTP(S) URLs should be proxied
  return true;
}

/**
 * Gets the appropriate URL for an image, proxying external URLs through
 * the image proxy endpoint when necessary.
 *
 * This function ensures that:
 * 1. External images (from Openverse, Wikimedia, etc.) are proxied for security
 * 2. Internal images (Supabase storage, relative paths) are used directly
 * 3. Edge cases (null, undefined, empty) are handled safely
 *
 * @param url - The original image URL
 * @returns The proxied URL if external, or the original URL if internal/relative, or empty string if invalid
 *
 * @example
 * // External URL - needs proxying
 * getProxiedImageUrl('https://api.openverse.org/v1/images/abc123')
 * // Returns: '/api/image-proxy?url=https%3A%2F%2Fapi.openverse.org%2Fv1%2Fimages%2Fabc123'
 *
 * @example
 * // Supabase storage - no proxying
 * getProxiedImageUrl('https://xyz.supabase.co/storage/v1/object/public/photos/beach.jpg')
 * // Returns: 'https://xyz.supabase.co/storage/v1/object/public/photos/beach.jpg'
 *
 * @example
 * // Relative URL - no proxying
 * getProxiedImageUrl('/images/logo.png')
 * // Returns: '/images/logo.png'
 *
 * @example
 * // Null/undefined - safe handling
 * getProxiedImageUrl(null)
 * // Returns: ''
 */
export function getProxiedImageUrl(url: string | null | undefined): string {
  // Handle null, undefined, or empty strings
  if (!url || url.trim() === '') {
    return '';
  }

  // If URL doesn't need proxying, return as-is
  if (!shouldProxyUrl(url)) {
    return url;
  }

  // Proxy external URLs through the image proxy endpoint
  try {
    const encodedUrl = encodeURIComponent(url);
    return `/api/image-proxy?url=${encodedUrl}`;
  } catch (error) {
    // If encoding fails for any reason, return empty string for safety
    console.error('Failed to encode URL for image proxy:', error);
    return '';
  }
}

/**
 * Batch processes multiple image URLs, proxying external ones.
 * Useful for processing lists of images from API responses.
 *
 * @param urls - Array of image URLs to process
 * @returns Array of processed URLs (proxied if external, original if internal)
 *
 * @example
 * const urls = [
 *   'https://api.openverse.org/v1/images/1',
 *   '/images/local.png',
 *   'https://xyz.supabase.co/storage/v1/object/public/photo.jpg'
 * ];
 * getProxiedImageUrls(urls)
 * // Returns: [
 * //   '/api/image-proxy?url=https%3A%2F%2Fapi.openverse.org%2Fv1%2Fimages%2F1',
 * //   '/images/local.png',
 * //   'https://xyz.supabase.co/storage/v1/object/public/photo.jpg'
 * // ]
 */
export function getProxiedImageUrls(urls: (string | null | undefined)[]): string[] {
  return urls.map(getProxiedImageUrl).filter(url => url !== '');
}

/**
 * Checks if a URL is an external HTTP(S) URL that would need proxying.
 * Useful for conditional rendering or logging.
 *
 * @param url - The URL to check
 * @returns true if the URL is external and needs proxying
 *
 * @example
 * isExternalImageUrl('https://api.openverse.org/v1/images/1')
 * // Returns: true
 *
 * @example
 * isExternalImageUrl('/images/local.png')
 * // Returns: false
 */
export function isExternalImageUrl(url: string | null | undefined): boolean {
  return shouldProxyUrl(url);
}
