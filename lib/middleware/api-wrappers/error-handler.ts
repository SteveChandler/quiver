/**
 * Error Handler Wrapper
 *
 * Provides try-catch error handling for API route handlers.
 */

import type { NextRequest } from "next/server";
import { handleApiError } from "@/lib/api-utils";
import type { RouteHandler, RouteContext, WithErrorHandlerOptions } from "./types";

/**
 * Wraps a route handler with try-catch error handling.
 *
 * Catches all exceptions and returns a standardized error response
 * using handleApiError from api-utils.
 *
 * @param handler - The route handler to wrap
 * @param options - Configuration options
 * @returns Wrapped handler with error handling
 *
 * @example
 * ```ts
 * export const GET = withErrorHandler(
 *   async (request) => {
 *     const data = await fetchData();
 *     return createSuccessResponse(data);
 *   },
 *   { errorMessage: "Failed to fetch data" }
 * );
 * ```
 */
export function withErrorHandler(
  handler: RouteHandler,
  options: WithErrorHandlerOptions = {}
): RouteHandler {
  const { errorMessage, includeDetails = false } = options;

  return async (request: NextRequest, context?: RouteContext) => {
    try {
      return await handler(request, context);
    } catch (error) {
      return handleApiError(error, errorMessage, includeDetails);
    }
  };
}
