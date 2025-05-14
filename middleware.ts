import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: any) {
          response.cookies.set({
            name,
            value: "",
            ...options,
          });
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Check auth condition
  const isAuthRoute = request.nextUrl.pathname.startsWith("/auth");
  const isProtectedRoute =
    request.nextUrl.pathname.startsWith("/plan-session") ||
    request.nextUrl.pathname.startsWith("/log-session");

  // If user is not signed in and the route is protected, redirect to sign in
  // Note: Profile page is handled by the component itself, so we don't redirect
  if (!session?.user && isProtectedRoute) {
    return NextResponse.redirect(new URL("/auth/sign-in", request.url));
  }

  // If user is signed in and the route is auth, redirect to home
  if (session?.user && isAuthRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg).*)"],
};
