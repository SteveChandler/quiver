import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { redirect } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { resolveConfirmNext } from "@/lib/auth/confirm-utils";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  // Try URL param first, then fall back to cookie set during signup
  let nextParam = searchParams.get("next");
  if (!nextParam) {
    const cookieStore = await cookies();
    const cookieValue = cookieStore.get("auth_return_to")?.value;
    if (cookieValue) {
      nextParam = decodeURIComponent(cookieValue);
    }
  }

  const next = resolveConfirmNext(type, nextParam);

  if (!token_hash || !type) {
    redirect("/error?reason=invalid_or_expired_link");
  }

  // We need a server client that can WRITE session cookies onto the response
  // (the default createSupabaseServerClient has a no-op setAll to avoid RSC
  // mutable-cookie errors, which silently drops the session here). Pattern
  // mirrors app/auth/callback/route.ts (memory: vast-dancing-whale).
  const cookiePairs: Array<{ name: string; value: string; options?: any }> = [];
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          cookiesToSet.forEach(({ name, value, options }) => {
            cookiePairs.push({ name, value, options });
          });
        },
      },
    }
  );

  try {
    const { data, error } = await supabase.auth.verifyOtp({
      type: type as any,
      token_hash,
    });

    if (error) {
      console.error("OTP verification failed:", error);
      redirect("/error?reason=invalid_or_expired_link");
    }

    // Verify a session actually came out of the exchange. When the link is
    // opened in a different browser/device/incognito tab from the original
    // signup, verifyOtp confirms the email at the DB level but no session
    // ends up in the response — the user becomes a ghost on the destination.
    // Detected via David Fisher's account: email_confirmed_at set,
    // last_sign_in_at NULL, never authenticated, bounced.
    if (!data.session) {
      const email = data.user?.email ?? "";
      // Observability: this branch is the entire reason this fix exists.
      // We need to know in prod when it fires, who's affected, and where
      // they were trying to go — both to confirm the fix works and to
      // measure the cohort. Structured warn lands in Vercel logs;
      // captureMessage lands in Sentry for alerting.
      const userId = data.user?.id ?? null;
      console.warn("[confirm_session_lost]", {
        userId,
        email,
        next,
        type,
      });
      Sentry.captureMessage("auth.confirm: session lost after verifyOtp", {
        level: "warning",
        tags: { auth_event: "confirm_session_lost", confirm_type: type },
        extra: { userId, email, next },
      });
      const signInUrl = new URL("/auth/sign-in", request.url);
      signInUrl.searchParams.set("just_confirmed", "1");
      if (email) signInUrl.searchParams.set("email", email);
      if (next && next !== "/") signInUrl.searchParams.set("next", next);
      const response = NextResponse.redirect(signInUrl);
      response.cookies.delete("auth_return_to");
      return response;
    }

    // Success — redirect to destination, replay session cookies, and clear
    // the fallback cookie.
    const redirectUrl = new URL(next, request.url);
    const response = NextResponse.redirect(redirectUrl);
    for (const { name, value, options } of cookiePairs) {
      response.cookies.set({ name, value, ...options });
    }
    response.cookies.delete("auth_return_to");
    return response;
  } catch (error) {
    console.error("Error verifying OTP:", error);
    redirect("/error?reason=invalid_or_expired_link");
  }
}
