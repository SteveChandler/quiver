/**
 * Validation Helpers
 *
 * Utilities for validating API request parameters.
 */

import type { NextResponse } from "next/server";
import { createValidationError, isValidUuid } from "@/lib/api-utils";

/**
 * Validates a UUID parameter from route context.
 *
 * Returns a validation error response if invalid, or the validated UUID.
 *
 * @param paramValue - The parameter value to validate
 * @param paramName - Name of the parameter (for error message)
 * @returns Object with either valid UUID or error response
 *
 * @example
 * ```ts
 * export const GET = withAuth(async (request, { params, user, supabase }) => {
 *   const uuidResult = validateUuidParam(params.id, "session");
 *   if ("error" in uuidResult) return uuidResult.error;
 *
 *   const sessionId = uuidResult.value;
 *   // ... use sessionId
 * });
 * ```
 */
export function validateUuidParam(
  paramValue: string | undefined,
  paramName: string = "id"
): { value: string } | { error: NextResponse } {
  if (!paramValue || !isValidUuid(paramValue)) {
    return {
      error: createValidationError(`Invalid ${paramName} format`),
    };
  }
  return { value: paramValue };
}

/**
 * Validates multiple required parameters exist.
 *
 * @param params - Object containing parameters
 * @param required - Array of required parameter names
 * @returns Validation error or null if valid
 *
 * @example
 * ```ts
 * const searchParams = request.nextUrl.searchParams;
 * const params = {
 *   lat: searchParams.get("lat"),
 *   lon: searchParams.get("lon"),
 * };
 *
 * const error = validateRequiredParams(params, ["lat", "lon"]);
 * if (error) return error;
 * ```
 */
export function validateRequiredParams(
  params: Record<string, string | null | undefined>,
  required: string[]
): NextResponse | null {
  const missing = required.filter((key) => !params[key]);

  if (missing.length > 0) {
    return createValidationError(`Missing required parameters: ${missing.join(", ")}`, {
      required,
      missing,
    });
  }

  return null;
}
