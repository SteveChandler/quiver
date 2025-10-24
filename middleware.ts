import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { DEFAULT_SECURITY_HEADERS } from "@/lib/api-utils";
import { ADMIN_USER_IDS } from "@/lib/auth/admin";

// Define paths that require authentication
// Note: /forecast, /beach, /map, /sessions are now public for SEO and user acquisition
const protectedPaths = [
  "/profile",
  "/dashboard",
  "/journal",
  "/discover",
];

// Admin-only paths require additional authorization
const adminPaths = ["/admin"];

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

  // Check if the route is an admin route
  const isAdminRoute = adminPaths.some((path) => pathname.startsWith(path));

  // Check if the route is protected (including admin routes)
  if (protectedPaths.some((path) => pathname.startsWith(path)) || isAdminRoute) {
    log(`[Middleware] Checking auth for protected path: ${pathname}`);

    try {
      // Prefer local session cookie validation first to avoid unnecessary remote calls
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      let user = session?.user;

      if (!user || sessionError) {
        // Fallback: validate with Supabase auth server if session not present
        const {
          data: { user: fetchedUser },
          error: userError,
        } = await supabase.auth.getUser();

        if (!fetchedUser || userError) {
          log(`[Middleware] No valid user found, redirecting to sign-in`);
          const signInUrl = new URL("/auth/sign-in", request.url);
          signInUrl.searchParams.set("redirectTo", pathname);
          return NextResponse.redirect(signInUrl);
        }
        user = fetchedUser;
        log(`[Middleware] Valid user found via fallback for ${pathname}`);
      } else {
        log(`[Middleware] Session present for ${pathname}`);
      }

      // Additional check for admin routes
      if (isAdminRoute) {
        log(`[Middleware] Checking admin privileges for: ${pathname}`);

        // Check if user is in canonical admin list
        const isAdmin = ADMIN_USER_IDS.includes(user.id as any);

        // TODO: Also check user metadata once admin flag is in database
        // For now, we rely on the canonical user IDs

        if (!isAdmin) {
          log(`[Middleware] User ${user.id} is not an admin, redirecting to home`);
          return NextResponse.redirect(new URL("/", request.url));
        }

        log(`[Middleware] Admin access granted for ${pathname}`);
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
