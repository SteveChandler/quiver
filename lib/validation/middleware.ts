import { NextRequest, NextResponse } from 'next/server';
import { createValidationError } from '@/lib/middleware/api-wrappers';

/**
 * Validates that the request has the correct Content-Type header for JSON
 * @param request - The Next.js request object
 * @returns NextResponse with error or null if valid
 */
function validateContentType(request: NextRequest): NextResponse | null {
  const contentType = request.headers.get('content-type');

  if (!contentType?.includes('application/json')) {
    return createValidationError(
      'Invalid Content-Type. Expected application/json'
    );
  }

  return null;
}

/**
 * Parses and validates JSON from request body
 * Checks Content-Type and handles JSON parsing errors
 *
 * @param request - The Next.js request object
 * @returns Object with either data or error
 */
export async function parseAndValidateJson<T = unknown>(
  request: NextRequest
): Promise<{ data: T } | { error: NextResponse }> {
  // Check Content-Type
  const contentTypeError = validateContentType(request);
  if (contentTypeError) {
    return { error: contentTypeError };
  }

  // Parse JSON
  try {
    const data = await request.json() as T;
    return { data };
  } catch (error) {
    return {
      error: createValidationError('Invalid JSON in request body')
    };
  }
}
