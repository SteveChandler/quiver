import { NextRequest, NextResponse } from 'next/server';
import { createValidationError } from '@/lib/api-utils';

/**
 * Validates that the request has the correct Content-Type header for JSON
 * @param request - The Next.js request object
 * @returns NextResponse with error or null if valid
 */
export function validateContentType(request: NextRequest): NextResponse | null {
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

/**
 * Validates query parameters from URL
 * Converts string params to appropriate types
 *
 * @param searchParams - URL search params
 * @param schema - Object mapping param names to type converters
 * @returns Validated and typed parameters
 */
export function validateQueryParams<T extends Record<string, any>>(
  searchParams: URLSearchParams,
  schema: {
    [K in keyof T]: {
      required?: boolean;
      type: 'string' | 'number' | 'boolean';
      default?: T[K];
      min?: number;
      max?: number;
    }
  }
): { data: T } | { error: NextResponse } {
  const result: any = {};
  const errors: string[] = [];

  for (const [key, config] of Object.entries(schema)) {
    const value = searchParams.get(key);

    // Handle required fields
    if (config.required && !value) {
      errors.push(`${key} is required`);
      continue;
    }

    // Use default if not provided
    if (!value && config.default !== undefined) {
      result[key] = config.default;
      continue;
    }

    // Skip optional fields
    if (!value) {
      continue;
    }

    // Type conversion and validation
    try {
      switch (config.type) {
        case 'number': {
          const num = Number(value);
          if (isNaN(num)) {
            errors.push(`${key} must be a number`);
            break;
          }
          if (config.min !== undefined && num < config.min) {
            errors.push(`${key} must be at least ${config.min}`);
            break;
          }
          if (config.max !== undefined && num > config.max) {
            errors.push(`${key} must be at most ${config.max}`);
            break;
          }
          result[key] = num;
          break;
        }
        case 'boolean': {
          result[key] = value === 'true';
          break;
        }
        case 'string':
        default: {
          if (config.max && value.length > config.max) {
            errors.push(`${key} exceeds maximum length of ${config.max}`);
            break;
          }
          result[key] = value;
          break;
        }
      }
    } catch (error) {
      errors.push(`${key} validation failed`);
    }
  }

  if (errors.length > 0) {
    return { error: createValidationError(errors.join(', ')) };
  }

  return { data: result as T };
}
