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
 * @see docs/API_MIDDLEWARE_REFERENCE.md for technical details
 */

// Re-export everything from the modular implementation
export {
  // Types
  type RouteHandler,
  type RouteContext,
  type AuthenticatedContext,
  type AuthenticatedHandler,
  type OptionalAuthHandler,
  type WithAuthOptions,
  type WithErrorHandlerOptions,
  type CreateApiHandlerOptions,
  type WithRateLimitOptions,
  type WithBotBlockingOptions,
  type ProtectionOptions,
  type OwnershipResult,
  type RateLimitKey,

  // Core wrappers
  withErrorHandler,
  withAuth,
  createApiHandler,

  // Validation helpers
  validateUuidParam,
  validateRequiredParams,

  // Ownership helpers
  requireOwnership,

  // Rate limiting
  getClientIdentifier,
  withRateLimit,
  withBotBlockingAndRateLimit,

  // Protection wrappers
  withAuthAndRateLimit,
  withFullProtection,
  withProtection,

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
  checkNotModified,
  CacheDuration,

  // Bot blocking re-export
  withBotBlocking,
} from "./api-wrappers/index";
