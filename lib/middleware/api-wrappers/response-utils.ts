/**
 * Response Utilities
 *
 * Re-exports commonly used response utilities from @/lib/api-utils
 * for convenience when importing from api-wrappers.
 */

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
  checkNotModified,
  CacheDuration,
} from "@/lib/api-utils";
