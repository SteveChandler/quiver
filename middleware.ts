import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { DEFAULT_SECURITY_HEADERS } from "@/lib/api-utils";

// Define paths that require authentication
const protectedPaths = [
  "/profile",
  "/sessions",
  "/dashboard",
  "/map",
  "/journal",
];

// Only enable verbose logging in development
const isDev = process.env.NODE_ENV === "development";
const isVerbose = process.env.MIDDLEWARE_VERBOSE === "true";

function log(message: string, data?: any) {
  if (isDev && isVerbose) {
    console.log(message, data || "");
  }
}

function logError(message: string, error?: any) {
  // Always log errors, but less verbosely in production
  if (isDev) {
    console.error(message, error);
  } else {
    console.error(message);
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for API routes, static files, auth routes, and other non-page requests
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/error") ||
    pathname.includes(".") // Skip any file with an extension
  ) {
    return NextResponse.next();
  }

  // Only process GET requests to pages - skip POST/PUT/DELETE to API routes
  if (request.method !== "GET") {
    return NextResponse.next();
  }

  // Create a response we can modify (needed for supabase cookie helpers)
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Add security headers to all responses
  Object.entries(DEFAULT_SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value as string);
  });

  log(`[Middleware] Processing request for: ${pathname}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          const cookie = request.cookies.get(name);
          // Remove individual cookie get logging - too noisy
          return cookie?.value;
        },
        set(name, value, options) {
          log(`[Middleware] Setting cookie: ${name}`);
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name, options) {
          log(`[Middleware] Removing cookie: ${name}`);
          response.cookies.delete({
            name,
            ...options,
          });
        },
      },
    }
  );

  // Check if the route is protected
  if (protectedPaths.some((path) => pathname.startsWith(path))) {
    log(`[Middleware] Checking auth for protected path: ${pathname}`);

    try {
      // Prefer local session cookie validation first to avoid unnecessary remote calls
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (session?.user && !sessionError) {
        log(`[Middleware] Session present for ${pathname}`);
      } else {
        // Fallback: validate with Supabase auth server if session not present
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (!user || userError) {
          log(`[Middleware] No valid user found, redirecting to sign-in`);
          const signInUrl = new URL("/auth/sign-in", request.url);
          signInUrl.searchParams.set("redirectTo", pathname);
          return NextResponse.redirect(signInUrl);
        }
        log(`[Middleware] Valid user found via fallback for ${pathname}`);
      }
    } catch (error) {
      logError(`[Middleware] Error checking auth:`, error);
      const signInUrl = new URL("/auth/sign-in", request.url);
      signInUrl.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(signInUrl);
    }
  }

  return response;
}

export const config = {
  runtime: "nodejs",
  matcher: [
    /*
     * Match all page routes but exclude:
     * - API routes (/api/*)
     * - Static files (/_next/static, /_next/image)
     * - Files with extensions (.svg, .png, etc.)
     * Only apply to actual page navigation
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
