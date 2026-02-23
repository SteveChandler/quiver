// Custom error classes for admin operations

/**
 * Error thrown when a user is not authenticated
 */
export class UnauthorizedError extends Error {
  readonly statusCode = 401;

  constructor(message: string = "Authentication required") {
    super(message);
    this.name = "UnauthorizedError";

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, UnauthorizedError);
    }
  }
}

/**
 * Error thrown when an authenticated user lacks admin privileges
 */
export class ForbiddenError extends Error {
  readonly statusCode = 403;

  constructor(message: string = "Admin access required") {
    super(message);
    this.name = "ForbiddenError";

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ForbiddenError);
    }
  }
}

/**
 * Get the appropriate error based on authentication status
 */
function createAuthError(isAuthenticated: boolean): UnauthorizedError | ForbiddenError {
  if (!isAuthenticated) {
    return new UnauthorizedError();
  }
  return new ForbiddenError();
}
