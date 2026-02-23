/**
 * Cache header utilities for API response optimization
 *
 * Implements cache-control headers with stale-while-revalidate (SWR) strategy
 * and ETag-based conditional requests for reduced data transfer.
 *
 * @see https://vercel.com/docs/manage-cdn-usage#optimizing-fast-data-transfer
 */

/**
 * Cache duration presets aligned with Vercel CDN optimization best practices
 */
export const CacheDuration = {
  /** 2 minutes - For frequently changing data (recent posts, live conditions) */
  SHORT: {
    maxAge: 120,
    sMaxAge: 120,
    staleWhileRevalidate: 300, // 5 min SWR
  },
  /** 5 minutes - For moderate refresh needs (search results, beach lists) */
  MEDIUM: {
    maxAge: 300,
    sMaxAge: 600,
    staleWhileRevalidate: 3600, // 1 hour SWR
  },
  /** 10 minutes - For relatively stable data (beach details, forecasts) */
  LONG: {
    maxAge: 600,
    sMaxAge: 1200,
    staleWhileRevalidate: 7200, // 2 hours SWR
  },
  /** 30 minutes - For very stable data (static content, metadata) */
  VERY_LONG: {
    maxAge: 1800,
    sMaxAge: 3600,
    staleWhileRevalidate: 86400, // 24 hours SWR
  },
} as const;

/**
 * Generate Cache-Control header string from duration preset or custom values
 */
function generateCacheControl(
  duration: typeof CacheDuration[keyof typeof CacheDuration] | {
    maxAge: number;
    sMaxAge?: number;
    staleWhileRevalidate?: number;
  }
): string {
  const parts = [
    'public',
    `max-age=${duration.maxAge}`,
  ];

  if (duration.sMaxAge) {
    parts.push(`s-maxage=${duration.sMaxAge}`);
  }

  if (duration.staleWhileRevalidate) {
    parts.push(`stale-while-revalidate=${duration.staleWhileRevalidate}`);
  }

  return parts.join(', ');
}

/**
 * Generate ETag from response data
 *
 * Creates a hash of the response data to enable 304 Not Modified responses
 * when the content hasn't changed.
 *
 * Uses Web Crypto API (available in Node.js 18+, Edge Runtime, and browsers).
 *
 * @param data - Response data to hash (will be JSON stringified)
 * @returns ETag string (SHA-256 hash)
 */
export async function generateETag(data: any): Promise<string> {
  const jsonString = JSON.stringify(data);
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(jsonString);

  // Use Web Crypto API - available in Node.js 18+, Edge Runtime, and browsers
  // globalThis.crypto is available in all modern JavaScript runtimes
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Check if request ETag matches current data
 *
 * @param requestETag - ETag from If-None-Match header
 * @param currentData - Current response data
 * @returns true if ETags match (data unchanged)
 */
export async function isETagMatch(requestETag: string | null, currentData: any): Promise<boolean> {
  if (!requestETag) return false;

  const currentETag = await generateETag(currentData);
  // Handle weak ETags (W/"...") and strong ETags
  const normalizedRequestETag = requestETag.replace(/^W\//, '').replace(/"/g, '');

  return normalizedRequestETag === currentETag;
}

/**
 * Create standard cache headers for API responses
 *
 * @param duration - Cache duration preset or custom configuration
 * @param eTag - Optional ETag for the response
 * @returns Headers object ready to be spread into NextResponse
 */
export function createCacheHeaders(
  duration: typeof CacheDuration[keyof typeof CacheDuration] | {
    maxAge: number;
    sMaxAge?: number;
    staleWhileRevalidate?: number;
  },
  eTag?: string
): Record<string, string> {
  const headers: Record<string, string> = {
    'Cache-Control': generateCacheControl(duration),
    'Vary': 'Accept-Encoding',
  };

  if (eTag) {
    headers['ETag'] = `"${eTag}"`;
  }

  return headers;
}

/**
 * Pagination metadata interface
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Create pagination metadata from query parameters and total count
 *
 * @param page - Current page number (1-indexed)
 * @param limit - Items per page
 * @param total - Total number of items
 * @returns Pagination metadata object
 */
export function createPaginationMeta(
  page: number,
  limit: number,
  total: number
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

/**
 * Parse and validate pagination parameters from query string
 *
 * @param searchParams - URLSearchParams from request
 * @param defaultLimit - Default limit if not specified
 * @param maxLimit - Maximum allowed limit
 * @returns Validated page and limit values
 */
export function parsePaginationParams(
  searchParams: URLSearchParams,
  defaultLimit: number = 20,
  maxLimit: number = 100
): { page: number; limit: number } {
  const pageParam = searchParams.get('page');
  const limitParam = searchParams.get('limit');

  let page = pageParam ? parseInt(pageParam, 10) : 1;
  let limit = limitParam ? parseInt(limitParam, 10) : defaultLimit;

  // Validate and constrain values
  page = Math.max(1, isNaN(page) ? 1 : page);
  limit = Math.max(1, Math.min(maxLimit, isNaN(limit) ? defaultLimit : limit));

  return { page, limit };
}
