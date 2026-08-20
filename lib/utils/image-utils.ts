/**
 * Image Utilities
 *
 * Provides utility functions for handling image URLs in the Quiver application:
 * - Proxying external images through the image proxy endpoint
 * - Supabase Storage image transformations (Pro plan feature)
 *
 * @see https://supabase.com/docs/guides/storage/serving/image-transformations
 */

// ============================================================================
// Supabase Storage Image Transformations (Pro Plan)
// ============================================================================

/** Valid resize modes for Supabase image transformations */
const VALID_RESIZE_MODES = ['cover', 'contain', 'fill'] as const;

/** Valid format options for Supabase image transformations */
const VALID_FORMATS = ['origin'] as const;

/**
 * Transformation options for Supabase Storage images
 */
export interface ImageTransformOptions {
  /** Width in pixels (1-2500) */
  width?: number;
  /** Height in pixels (1-2500) */
  height?: number;
  /** Quality (1-100, default 80) */
  quality?: number;
  /** Resize mode */
  resize?: 'cover' | 'contain' | 'fill';
  /** Format - 'origin' to keep original, otherwise auto-detects WebP support */
  format?: 'origin';
}

/**
 * Preset transformation configurations for common use cases.
 *
 * Size Selection Rationale:
 * - Thumbnails: 80px matches typical list item sizes
 * - ThumbnailMedium: 150px balances quality with grid display
 * - Avatar: 96px matches h-12 w-12 (48px * 2 for retina)
 * - AvatarLarge: 200px for profile pages (retina @ 100px)
 * - SessionCard: 300px handles typical card widths (retina @ 150px)
 * - GalleryPreview: 600px for grid previews (retina @ 300px)
 * - FullWidth: 1200px handles most desktop viewports
 * - IntelPost: 800x600 (4:3 aspect) for feed posts
 *
 * Quality Selection:
 * - 70-80: Thumbnails/avatars (aggressive compression acceptable)
 * - 85: Detail views (balance quality/bandwidth)
 * - 90: Full-screen (prioritize quality)
 */
export const IMAGE_TRANSFORM_PRESETS = {
  /** Tiny thumbnails for lists/grids - 80x80 @ quality 70 */
  thumbnail: { width: 80, height: 80, quality: 70, resize: 'cover' as const },
  /** Small thumbnails for cards - 150x150 @ quality 75 */
  thumbnailMedium: { width: 150, height: 150, quality: 75, resize: 'cover' as const },
  /** Avatar images - 96x96 @ quality 80 (retina-ready for h-12 w-12) */
  avatar: { width: 96, height: 96, quality: 80, resize: 'cover' as const },
  /** Large avatar for profile - 200x200 @ quality 85 */
  avatarLarge: { width: 200, height: 200, quality: 85, resize: 'cover' as const },
  /** Session card photos - 300x300 @ quality 80 */
  sessionCard: { width: 300, height: 300, quality: 80, resize: 'cover' as const },
  /** Gallery preview - 600x600 @ quality 85 */
  galleryPreview: { width: 600, height: 600, quality: 85, resize: 'cover' as const },
  /** Full screen / detail view - 1200 wide @ quality 90, maintains aspect */
  fullWidth: { width: 1200, quality: 90 },
  /** Intel post photos - 800x600 (4:3) @ quality 85 */
  intelPost: { width: 800, height: 600, quality: 85, resize: 'cover' as const },
} as const;

/**
 * Type for preset names - provides autocomplete and compile-time validation
 */
export type ImageTransformPreset = keyof typeof IMAGE_TRANSFORM_PRESETS;

/**
 * Checks if a URL is a Supabase Storage URL.
 * Supports both .supabase.co and .supabase.in domains.
 *
 * @param url - The URL to check
 * @returns true if the URL is a Supabase Storage URL
 */
export function isSupabaseStorageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes('.supabase.co/storage/') || url.includes('.supabase.in/storage/');
}

/**
 * Transforms a Supabase Storage URL to use image transformations.
 *
 * This converts URLs from the standard object endpoint to the render/image endpoint
 * with transformation parameters. Only works with Supabase Storage URLs.
 *
 * @param url - The original Supabase Storage URL
 * @param options - Transformation options (width, height, quality, resize, format)
 * @returns The transformed URL, or original URL if not a Supabase Storage URL
 *
 * @example
 * // Transform to 300x300 thumbnail
 * getTransformedStorageUrl(
 *   'https://xyz.supabase.co/storage/v1/object/public/photos/beach.jpg',
 *   { width: 300, height: 300, quality: 80 }
 * )
 * // Returns: 'https://xyz.supabase.co/storage/v1/render/image/public/photos/beach.jpg?width=300&height=300&quality=80'
 *
 * @example
 * // Using a preset
 * getTransformedStorageUrl(url, IMAGE_TRANSFORM_PRESETS.thumbnail)
 */
export function getTransformedStorageUrl(
  url: string | null | undefined,
  options: ImageTransformOptions = {}
): string {
  if (!url || url.trim() === '') {
    return '';
  }

  // Only transform Supabase Storage URLs (use centralized check)
  if (!isSupabaseStorageUrl(url)) {
    return url;
  }

  // Check if it's an object URL (not already transformed)
  if (!url.includes('/storage/v1/object/')) {
    return url; // Already transformed or different format
  }

  try {
    const urlObj = new URL(url);

    // Convert /storage/v1/object/ to /storage/v1/render/image/
    urlObj.pathname = urlObj.pathname.replace(
      '/storage/v1/object/',
      '/storage/v1/render/image/'
    );

    // Add transformation parameters with validation
    if (options.width) {
      urlObj.searchParams.set('width', String(Math.min(options.width, 2500)));
    }
    if (options.height) {
      urlObj.searchParams.set('height', String(Math.min(options.height, 2500)));
    }
    if (options.quality !== undefined) {
      // Clamp quality to 1-100 range
      urlObj.searchParams.set('quality', String(Math.min(Math.max(options.quality, 1), 100)));
    }
    if (options.resize) {
      // Validate resize mode
      if ((VALID_RESIZE_MODES as readonly string[]).includes(options.resize)) {
        urlObj.searchParams.set('resize', options.resize);
      }
    }
    if (options.format) {
      // Validate format
      if ((VALID_FORMATS as readonly string[]).includes(options.format)) {
        urlObj.searchParams.set('format', options.format);
      }
    }

    return urlObj.toString();
  } catch {
    // If URL parsing fails, return original
    return url;
  }
}

/**
 * Convenience function to get a transformed URL using a preset.
 *
 * @param url - The Supabase Storage URL
 * @param preset - Name of the preset from IMAGE_TRANSFORM_PRESETS
 * @returns The transformed URL
 *
 * @example
 * getTransformedUrl(avatarUrl, 'avatar')
 * getTransformedUrl(photoUrl, 'sessionCard')
 */
export function getTransformedUrl(
  url: string | null | undefined,
  preset: ImageTransformPreset
): string {
  return getTransformedStorageUrl(url, IMAGE_TRANSFORM_PRESETS[preset]);
}

/**
 * Checks if a URL is a Supabase Storage URL that can be transformed.
 * Returns true only if it's a Supabase URL with the /object/ path (not already transformed).
 *
 * @param url - The URL to check
 * @returns true if the URL can be transformed
 */
export function isTransformableStorageUrl(url: string | null | undefined): boolean {
  return isSupabaseStorageUrl(url) && (url?.includes('/storage/v1/object/') ?? false);
}

// ============================================================================
// External Image Proxying
// ============================================================================

/**
 * Openverse compatibility:
 * The Openverse API has historically returned thumbnail URLs like:
 *   https://api.openverse.org/v1/images/{id}/thumb/?format=json
 * That endpoint returns JSON metadata, not image bytes, which breaks <img>/<Image>.
 * We defensively strip `format=json` for Openverse thumb URLs at render time.
 */
function cleanOpenverseThumbUrl(url: string): string {
  try {
    const urlObj = new URL(url);

    const isOpenverseApi = urlObj.hostname === "api.openverse.org";
    const isThumbPath = urlObj.pathname.includes("/thumb/");
    const format = urlObj.searchParams.get("format");

    if (isOpenverseApi && isThumbPath && format?.toLowerCase() === "json") {
      urlObj.searchParams.delete("format");
      return urlObj.toString();
    }

    return url;
  } catch {
    // Best-effort fallback for malformed URLs
    return url.replace(/\?format=json$/i, "");
  }
}

/**
 * Determines if a URL should be proxied through the image proxy endpoint.
 *
 * URLs that should NOT be proxied:
 * - Relative URLs (e.g., '/images/logo.png')
 * - Supabase storage URLs
 * - Cam-thumbnail hosts already served directly by next/image remotePatterns
 * - URLs from the app's own domain
 * - null, undefined, or empty strings
 *
 * URLs that SHOULD be proxied:
 * - External HTTP(S) URLs (e.g., from Openverse, Wikimedia, etc.)
 *
 * @param url - The image URL to check
 * @returns true if the URL should be proxied, false otherwise
 */
/**
 * External hosts whitelisted in next.config.mjs images.remotePatterns whose
 * URLs must stay un-proxied — /api/image-proxy's allowlist rejects them.
 */
const DIRECT_REMOTE_IMAGE_HOSTS = new Set([
  "storage.hdontap.com",
  "img.youtube.com",
  "camstills.cdn-surfline.com",
  "ccn-media.coastalcameranetwork.com",
  "cdn.target-video.com",
]);

function shouldProxyUrl(url: string | null | undefined): boolean {
  // Handle null, undefined, or empty strings
  if (!url || url.trim() === '') {
    return false;
  }

  try {
    const parsed = new URL(url, "https://www.quiversurf.app");
    if (parsed.pathname === "/api/image-proxy") {
      return false;
    }
  } catch {
    return false;
  }

  // Relative URLs don't need proxying
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return false;
  }

  // Don't proxy Supabase storage URLs (use centralized check)
  if (isSupabaseStorageUrl(url)) {
    return false;
  }

  // Don't proxy cam-thumbnail hosts: next/image remotePatterns serves them
  // directly, and the proxy's photo-source allowlist rejects them with 403.
  try {
    if (DIRECT_REMOTE_IMAGE_HOSTS.has(new URL(url).hostname)) {
      return false;
    }
  } catch {
    return false;
  }

  // Don't proxy URLs from our own domain
  if (typeof globalThis !== "undefined" && globalThis.location) {
    try {
      const urlObj = new URL(url);
      const currentHost = globalThis.location.host;
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

  // Normalize known bad thumbnail URLs (Openverse)
  const normalizedUrl = cleanOpenverseThumbUrl(url.trim());

  // If URL doesn't need proxying, return as-is
  if (!shouldProxyUrl(normalizedUrl)) {
    return normalizedUrl;
  }

  // Proxy external URLs through the image proxy endpoint
  try {
    const encodedUrl = encodeURIComponent(normalizedUrl);
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
function getProxiedImageUrls(urls: (string | null | undefined)[]): string[] {
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
