/**
 * API Route Wrappers - Higher-Order Functions for Next.js API Routes
 *
 * @deprecated Import from '@/lib/middleware/api-wrappers/' instead.
 * This file re-exports from the modular implementation for backwards compatibility.
 *
 * Purpose: Eliminate duplicated boilerplate across 73+ API route files
 * - Try-catch error handling (previously 131 blocks)
 * - Authentication checks (previously duplicated 40+ times)
 * - Rate limiting and bot blocking
 * - Parameter validation
 *
 * Design Pattern: Decorator/Wrapper Pattern
 * - Composable wrappers that can be chained
 * - Each wrapper handles a single concern
 * - Business logic remains clean and focused
 *
 * @see docs/API_MIDDLEWARE.md for patterns and usage
 * @see docs/API_MIDDLEWARE.md#technical-reference-appendix for technical details
 */

// Re-export everything from the modular implementation
export {
  // Types
  type RouteHandler,


  type AuthenticatedContext,
  type AuthenticatedHandler,
  type OptionalAuthContext,










  // Admin auth types
  type AdminAuthenticatedContext,





  // Core wrappers
  withErrorHandler,
  withAuth,
  createApiHandler,
  withAdminAuth,
  withBearerAuth,

  // Validation helpers
  validateUuidParam,
  validateRequiredParams,

  // Ownership helpers
  requireOwnership,

  // Rate limiting
  withRateLimit,
  withBotBlockingAndRateLimit,

  // Protection wrappers
  withProtection,

  // Cache wrappers
  withNoStore,
  NO_STORE_CACHE_CONTROL,

  // Response utilities (re-exports from api-utils)
  createSuccessResponse,
  createErrorResponse,
  createValidationError,
  createAuthError,
  createNotFoundError,
  handleApiError,
  methodNotAllowed,
  isValidUuid,
  validateOrError,
  createCachedResponse,
  createPaginatedResponse,
  checkNotModified,
  CacheDuration,
  createPaginationMeta,
  parsePaginationParams,
  DEFAULT_SECURITY_HEADERS,

  validateCronRequest,
} from "./api-wrappers/index";
