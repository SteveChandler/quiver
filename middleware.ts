import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Define paths that require authentication
const protectedPaths = [
  "/profile",
  "/log-session",
  "/plan-session",
  "/sessions",
  "/dashboard",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Create a response we can modify (needed for supabase cookie helpers)
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  console.log(`[Middleware] Processing request for: ${pathname}`);
  console.log(`[Middleware] Cookies present:`, {
    cookieNames: Array.from(request.cookies.getAll().map((c) => c.name)),
    cookieCount: request.cookies.getAll().length,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          const cookie = request.cookies.get(name);
          console.log(
            `[Middleware] Getting cookie ${name}:`,
            cookie ? "found" : "not found"
          );
          return cookie?.value;
        },
        set(name, value, options) {
          console.log(`[Middleware] Setting cookie ${name}`);
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name, options) {
          console.log(`[Middleware] Removing cookie ${name}`);
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
    console.log(`[Middleware] Checking auth for protected path: ${pathname}`);

    try {
      // Use getUser() instead of getSession() - this validates with Supabase's auth server
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      console.log(`[Middleware] User check result:`, {
        hasUser: !!user,
        userError: userError?.message,
        userId: user?.id,
      });

      // If there's no user or there's an error, redirect to sign-in
      if (!user || userError) {
        console.log(`[Middleware] No valid user found, redirecting to sign-in`);
        const signInUrl = new URL("/auth/sign-in", request.url);
        signInUrl.searchParams.set("redirectTo", pathname);
        return NextResponse.redirect(signInUrl);
      } else {
        console.log(
          `[Middleware] Valid user found, allowing access to ${pathname}`
        );
      }
    } catch (error) {
      console.error(`[Middleware] Error checking user:`, error);
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
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
