import { createServerClient } from "@supabase/ssr";
import { cookies, type UnsafeUnwrappedCookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

/**
 * Create a Supabase client specifically for Next.js API routes
 * This eliminates the repetitive cookie handling code across 15+ API routes
 *
 * Usage in API routes:
 * import { createAPIServerClient } from "@/lib/supabase/api-server-client";
 *
 * export async function POST(request: NextRequest) {
 *   const supabase = createAPIServerClient();
 *   // ... rest of your API logic
 * }
 */
export function createAPIServerClient() {
  const cookieStore = (cookies() as unknown as UnsafeUnwrappedCookies);

  return createServerClient(
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
        remove(name, _options) {
          cookieStore.delete(name);
        },
      },
    }
  );
}

/**
 * Create a Supabase client for API routes that modify response cookies
 * Use this when you need to set cookies in the response (like auth operations)
 *
 * Usage:
 * export async function POST(request: NextRequest) {
 *   const response = NextResponse.json({ success: true });
 *   const supabase = createAPIServerClientWithResponse(request, response);
 *   // ... auth operations that set cookies
 *   return response;
 * }
 */
export function createAPIServerClientWithResponse(
  request: NextRequest,
  response: NextResponse
) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value;
        },
        set(name, value, options) {
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name, options) {
          response.cookies.delete({
            name,
            ...options,
          });
        },
      },
    }
  );
}

/**
 * Wrapper for authenticated API operations
 * Automatically handles user authentication and returns user data
 *
 * Usage:
 * export async function POST(request: NextRequest) {
 *   const { supabase, user, error } = await getAuthenticatedAPIClient();
 *   if (error) return NextResponse.json({ error }, { status: 401 });
 *
 *   // user is guaranteed to be authenticated here
 *   // ... your authenticated API logic
 * }
 */
export async function getAuthenticatedAPIClient() {
  try {
    const supabase = createAPIServerClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return {
        supabase: null,
        user: null,
        error: "Authentication required",
      };
    }

    return {
      supabase,
      user,
      error: null,
    };
  } catch (error) {
    return {
      supabase: null,
      user: null,
      error: "Authentication failed",
    };
  }
}

/**
 * Validate environment variables for API routes
 * Call this at the top of API routes to ensure proper configuration
 */
export function validateSupabaseConfig(): { valid: boolean; error?: string } {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { valid: false, error: "NEXT_PUBLIC_SUPABASE_URL is required" };
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { valid: false, error: "NEXT_PUBLIC_SUPABASE_ANON_KEY is required" };
  }

  return { valid: true };
}
