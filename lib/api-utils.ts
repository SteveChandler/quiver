import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Standardized error response interface
export interface ApiError {
  success: false;
  error: string;
  details?: any;
  timestamp: string;
}

export interface ApiSuccess<T = any> {
  success: true;
  data: T;
  timestamp: string;
}

export type ApiResponse<T = any> = ApiSuccess<T> | ApiError;

// Centralized error handler for API routes
export function handleApiError(
  error: unknown,
  customMessage?: string,
  includeDetails = false
): NextResponse<ApiError> {
  const errorMessage = error instanceof Error ? error.message : "Unknown error";
  const finalMessage = customMessage || errorMessage;

  console.error("API Error:", errorMessage);
  if (error instanceof Error && error.stack) {
    console.error("Stack trace:", error.stack);
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

// Validation error helper
export function createValidationError(
  message: string,
  details?: any
): NextResponse<ApiError> {
  return NextResponse.json(
    {
      success: false,
      error: message,
      details,
      timestamp: new Date().toISOString(),
    },
    {
      status: 400,
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

// Common Supabase client creation with error handling
export async function createAuthenticatedSupabaseClient() {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name) {
            return cookieStore.get(name)?.value;
          },
          set(name, value, options) {
            cookieStore.set(name, value, options);
          },
          remove(name, options) {
            cookieStore.delete(name);
          },
        },
      }
    );

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      throw new Error(`Auth error: ${error.message}`);
    }

    if (!user) {
      throw new Error("User not authenticated");
    }

    return { supabase, user };
  } catch (error) {
    throw error;
  }
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

// Security headers for API responses
export const DEFAULT_SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

// Apply security headers to any NextResponse
export function withSecurityHeaders(response: NextResponse) {
  Object.entries(DEFAULT_SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}
