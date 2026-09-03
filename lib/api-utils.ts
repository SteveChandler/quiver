import { redactSecrets } from "@/lib/monitoring/redact-secrets";
import { NextResponse } from "next/server";
import {
  generateETag,
  isETagMatch,
  createCacheHeaders,
  CacheDuration,
  type PaginationMeta,
} from "@/lib/utils/cache-headers";

// Standardized error response interface
interface ApiError {
  success: false;
  error: string;
  details?: any;
  timestamp: string;
}

interface ApiSuccess<T = any> {
  success: true;
  data: T;
  timestamp: string;
  meta?: PaginationMeta;
}

type ApiResponse<T = any> = ApiSuccess<T> | ApiError;

// Centralized error handler for API routes
export function handleApiError(
  error: unknown,
  customMessage?: string,
  includeDetails = false
): NextResponse<ApiError> {
  const errorMessage = redactSecrets(error instanceof Error ? error.message : "Unknown error");
  const finalMessage = redactSecrets(customMessage || errorMessage);

  console.error("API Error:", errorMessage);
  if (error instanceof Error && error.stack) {
    console.error("Stack trace:", redactSecrets(error.stack));
  }

  return NextResponse.json(
    {
      success: false,
      error: finalMessage,
      details: includeDetails ? { originalError: errorMessage } : undefined,
      timestamp: new Date().toISOString(),
    },
    {
      status: 500,
      headers: DEFAULT_SECURITY_HEADERS,
    }
  );
}

// Success response helper
export function createSuccessResponse<T>(
  data: T,
  status = 200
): NextResponse<ApiSuccess<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    },
    {
      status,
      headers: DEFAULT_SECURITY_HEADERS,
    }
  );
}

// Error response helper (enveloped)
export function createErrorResponse(
  error: string,
  details?: unknown,
  status = 500
): NextResponse<ApiError> {
  return NextResponse.json(
    {
      success: false,
      error,
      details,
      timestamp: new Date().toISOString(),
    },
    {
      status,
      headers: DEFAULT_SECURITY_HEADERS,
    }
  );
}

// Validation error helper
export function createValidationError(
  message: string,
  details?: any,
  status = 400
): NextResponse<ApiError> {
  return NextResponse.json(
    {
      success: false,
      error: message,
      details,
      timestamp: new Date().toISOString(),
    },
    {
      status,
      headers: DEFAULT_SECURITY_HEADERS,
    }
  );
}

// Auth error helper
export function createAuthError(
  message = "Authentication required"
): NextResponse<ApiError> {
  return NextResponse.json(
    {
      success: false,
      error: message,
      timestamp: new Date().toISOString(),
    },
    {
      status: 401,
      headers: DEFAULT_SECURITY_HEADERS,
    }
  );
}

// Not found error helper
export function createNotFoundError(
  resourceName = "Resource"
): NextResponse<ApiError> {
  return NextResponse.json(
    {
      success: false,
      error: `${resourceName} not found`,
      timestamp: new Date().toISOString(),
    },
    {
      status: 404,
      headers: DEFAULT_SECURITY_HEADERS,
    }
  );
}

// Common parameter validation
export function validateRequiredParams(
  params: Record<string, any>,
  required: string[]
): string | null {
  for (const param of required) {
    if (!params[param]) {
      return `Missing required parameter: ${param}`;
    }
  }
  return null;
}

// Environment variable checker
export function checkRequiredEnvVars(vars: string[]): string | null {
  for (const varName of vars) {
    if (!process.env[varName]) {
      return `Missing required environment variable: ${varName}`;
    }
  }
  return null;
}

/**
 * Validate that a request originated from an approved cron source.
 *
 * Accepted source:
 * - Authorization header with `Bearer <CRON_SECRET>`
 */
export function validateCronAuth(authHeader: string | null): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return authHeader === `Bearer ${cronSecret}`;
}

export function validateCronRequest(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  return validateCronAuth(authHeader);
}

// Security headers for API responses
export const DEFAULT_SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  // Allow geolocation for first-party context while keeping camera/microphone disabled.
  "Permissions-Policy": "geolocation=(self), camera=(), microphone=()",
};

// Apply security headers to any NextResponse
export function withSecurityHeaders(response: NextResponse) {
  Object.entries(DEFAULT_SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

// Return 405 Method Not Allowed
export function methodNotAllowed(allowedMethods: string[] = ["GET"]): NextResponse<ApiError> {
  const body: ApiError = {
    success: false,
    error: "Method Not Allowed",
    timestamp: new Date().toISOString(),
  };
  const response = NextResponse.json(body, {
    status: 405,
    headers: DEFAULT_SECURITY_HEADERS,
  });
  response.headers.set("Allow", allowedMethods.join(", "));
  return response;
}

// UUID validation utility (simple RFC4122 v1-5 pattern)
const UUID_REGEX =
  /^(?:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$/;

export function isValidUuid(value: string | undefined | null): boolean {
  if (!value || typeof value !== "string") return false;
  return UUID_REGEX.test(value);
}

// ============================================================================
// ZOD VALIDATION UTILITIES
// ============================================================================

import { z } from 'zod';

/**
 * Validate and return NextResponse for validation errors
 * Combines Zod validation with proper error response creation
 *
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Validated data or NextResponse with validation error
 *
 * @example
 * ```ts
 * const validationResult = validateOrError(CommentSchema, requestBody);
 * if ('error' in validationResult) {
 *   return validationResult.error;
 * }
 * const validated = validationResult.data;
 * ```
 */
export function validateOrError<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { data: T } | { error: NextResponse<ApiError> } {
  const result = schema.safeParse(data);

  if (!result.success) {
    return {
      error: createValidationError(
        result.error.issues[0].message,
        result.error.issues
      )
    };
  }

  return { data: result.data };
}

// ============================================================================
// CACHING UTILITIES
// ============================================================================

/**
 * Create a cached success response with ETag and Cache-Control headers
 *
 * @param data - Response data
 * @param duration - Cache duration preset (SHORT, MEDIUM, LONG, VERY_LONG)
 * @param meta - Optional pagination metadata
 * @param status - HTTP status code (default: 200)
 * @returns NextResponse with cache headers and ETag
 *
 * @example
 * ```ts
 * return await createCachedResponse(beaches, CacheDuration.MEDIUM);
 * ```
 */
export async function createCachedResponse<T>(
  data: T,
  duration: typeof CacheDuration[keyof typeof CacheDuration] = CacheDuration.MEDIUM,
  meta?: PaginationMeta,
  status = 200
): Promise<NextResponse<ApiSuccess<T>>> {
  const eTag = await generateETag(data);
  const cacheHeaders = createCacheHeaders(duration, eTag);

  return NextResponse.json(
    {
      success: true,
      data,
      timestamp: new Date().toISOString(),
      ...(meta && { meta }),
    },
    {
      status,
      headers: {
        ...DEFAULT_SECURITY_HEADERS,
        ...cacheHeaders,
      },
    }
  );
}

/**
 * Check if request has matching ETag and return 304 Not Modified if so
 *
 * @param requestETag - ETag from request's If-None-Match header
 * @param currentData - Current response data to compare
 * @returns NextResponse with 304 status if ETag matches, null otherwise
 *
 * @example
 * ```ts
 * const clientETag = request.headers.get('If-None-Match');
 * const notModified = await checkNotModified(clientETag, data);
 * if (notModified) return notModified;
 * ```
 */
export async function checkNotModified(
  requestETag: string | null,
  currentData: any
): Promise<NextResponse | null> {
  if (await isETagMatch(requestETag, currentData)) {
    return new NextResponse(null, {
      status: 304,
      headers: DEFAULT_SECURITY_HEADERS,
    });
  }
  return null;
}

/**
 * Create a paginated response with cache headers
 *
 * @param data - Array of items for current page
 * @param pagination - Pagination metadata
 * @param duration - Cache duration preset
 * @returns NextResponse with pagination metadata and cache headers
 *
 * @example
 * ```ts
 * const meta = createPaginationMeta(page, limit, totalCount);
 * return await createPaginatedResponse(results, meta, CacheDuration.MEDIUM);
 * ```
 */
export async function createPaginatedResponse<T>(
  data: T[],
  pagination: PaginationMeta,
  duration: typeof CacheDuration[keyof typeof CacheDuration] = CacheDuration.MEDIUM
): Promise<NextResponse<ApiSuccess<T[]>>> {
  return await createCachedResponse(data, duration, pagination);
}

// Re-export cache utilities for convenience
export { CacheDuration } from "@/lib/utils/cache-headers";
export {
  createPaginationMeta,
  parsePaginationParams,
} from "@/lib/utils/cache-headers";
