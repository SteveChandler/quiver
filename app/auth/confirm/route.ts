import { after, NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { resolveConfirmNext } from "@/lib/auth/confirm-utils";
import { capturePostHogEvent } from "@/lib/posthog-server";

const OTP_TYPES = new Set<string>([
  "signup", "recovery", "magiclink", "invite", "email_change", "email",
]);

type FailureReason = "missing_credentials" | "provider_error" | "verification_failed" | "session_missing" | "unexpected_error";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const isRecovery = type === "recovery" || searchParams.get("next") === "/auth/reset";
  const flow = isRecovery ? "recovery" : "confirmation";
  const credential = code ? "pkce" : "token_hash";
  const cookiePairs: Array<{ name: string; value: string; options?: CookieOptions }> = [];
  const redirectWithCookies = (url: URL): NextResponse => {
    const response = NextResponse.redirect(url);
    for (const { name, value, options } of cookiePairs) {
      response.cookies.set({ name, value, ...options });
    }
    response.cookies.delete("auth_return_to");
    return response;
  };

  const fail = (reason: FailureReason): NextResponse => {
    const properties = { flow, credential, reason, pathname: "/auth/confirm" };
    Sentry.withScope((scope) => {
      // Callback URLs and request headers contain authentication credentials.
      scope.addEventProcessor((event) => ({
        ...event,
        request: { url: new URL("/auth/confirm", request.url).href },
        breadcrumbs: [],
        user: undefined,
      }));
      Sentry.captureMessage("auth.confirm: confirmation failed", {
        level: "warning",
        tags: { auth_event: "auth_confirm_failed", ...properties },
      });
    });
    after(() => capturePostHogEvent({
      distinctId: crypto.randomUUID(),
      event: "auth_failed",
      properties: { ...properties, source: "auth_confirm", $process_person_profile: false },
    }));
    const errorUrl = new URL("/error", request.url);
    errorUrl.searchParams.set("reason", "invalid_or_expired_link");
    errorUrl.searchParams.set("flow", flow);
    return redirectWithCookies(errorUrl);
  };

  if (searchParams.has("error")) return fail("provider_error");
  if (!code && (!token_hash || !type || !OTP_TYPES.has(type))) {
    return fail("missing_credentials");
  }

  let nextParam = searchParams.get("next");
  if (!nextParam && !isRecovery) {
    const cookieValue = (await cookies()).get("auth_return_to")?.value;
    if (cookieValue) {
      try {
        nextParam = decodeURIComponent(cookieValue);
      } catch {
        nextParam = null;
      }
    }
  }
  const next = resolveConfirmNext(isRecovery ? "recovery" : type, nextParam);
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiePairs.push(...cookiesToSet);
        },
      },
    }
  );

  try {
    // Supabase's ConfirmationURL redirects with a PKCE code. Custom email
    // templates can instead send a token hash for direct OTP verification.
    const { data, error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: token_hash! });

    if (error) return fail("verification_failed");
    if (!data.session) {
      if (isRecovery) return fail("session_missing");
      fail("session_missing");
      const signInUrl = new URL("/auth/sign-in", request.url);
      signInUrl.searchParams.set("just_confirmed", "1");
      if (data.user?.email) signInUrl.searchParams.set("email", data.user.email);
      if (next !== "/") signInUrl.searchParams.set("next", next);
      return redirectWithCookies(signInUrl);
    }

    const response = redirectWithCookies(new URL(next, request.url));
    // Match the callback route's Safari auth-state refresh signal.
    response.cookies.set("auth_callback_completed", "1", {
      maxAge: 30, path: "/", httpOnly: false, sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  } catch {
    return fail("unexpected_error");
  }
}
