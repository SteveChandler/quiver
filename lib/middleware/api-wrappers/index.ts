/**
 * API Route Wrappers - Higher-Order Functions for Next.js API Routes
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
 * @example Basic usage
 * ```ts
 * // Before (30+ lines boilerplate):
 * export async function GET(request: NextRequest) {
 *   try {
 *     const supabase = await createSupabaseServerClient();
 *     const { data: { user }, error } = await supabase.auth.getUser();
 *     if (error || !user) return createAuthError();
 *     // ... business logic
 *   } catch (error) {
 *     return handleApiError(error, "Failed to load data");
 *   }
 * }
 *
 * // After (5 lines):
 * export const GET = withAuth(async (request, { user, supabase }) => {
 *   // ... business logic only
 *   return createSuccessResponse(data);
 * }, { errorMessage: "Failed to load data" });
 * ```
 *
 * @see docs/API_MIDDLEWARE.md for patterns and usage
 * @see docs/API_MIDDLEWARE.md#technical-reference-appendix for technical details
 */

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type {
  RouteHandler,
  RouteContext,
  ResolvedParams,
  AuthenticatedContext,
  AuthenticatedHandler,
  OptionalAuthContext,
  OptionalAuthHandler,
  WithAuthOptions,
  WithErrorHandlerOptions,
  CreateApiHandlerOptions,
  WithRateLimitOptions,
  WithBotBlockingOptions,
  ProtectionOptions,
  AdminAuthenticatedContext,
  AdminAuthenticatedHandler,
  BearerAuthContext,
  BearerAuthHandler,
  WithAdminAuthOptions,
} from "./types";

// =============================================================================
// CORE WRAPPERS
// =============================================================================

export { withErrorHandler } from "./error-handler";
export { withAuth, createApiHandler } from "./auth-wrapper";
export { withAdminAuth, withBearerAuth } from "./admin-auth-wrapper";

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

export { validateUuidParam, validateRequiredParams } from "./validation-helpers";

// =============================================================================
// OWNERSHIP HELPERS
// =============================================================================

export { requireOwnership } from "./ownership-helpers";
export type { OwnershipResult } from "./ownership-helpers";

// =============================================================================
// RATE LIMITING
// =============================================================================

export {
  getClientIdentifier,
  withRateLimit,
  withBotBlockingAndRateLimit,
} from "./rate-limit-wrapper";

// =============================================================================
// PROTECTION WRAPPERS
// =============================================================================

export { withProtection } from "./protection-wrappers";

// =============================================================================
// CACHE WRAPPERS
// =============================================================================

export { withNoStore, NO_STORE_CACHE_CONTROL } from "./cache-wrappers";

// =============================================================================
// RESPONSE UTILITIES (RE-EXPORTS FROM API-UTILS)
// =============================================================================

export {
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
  validateCronAuth,
  validateCronRequest,
} from "./response-utils";

// =============================================================================
// BOT BLOCKING & RATE LIMIT TYPE RE-EXPORTS
// =============================================================================

// Re-export bot blocking for convenience
export { withBotBlocking } from "@/lib/middleware/bot-blocker";

// Re-export rate limit types for convenience
export type { RateLimitKey } from "@/lib/api/rate-limit-config";
