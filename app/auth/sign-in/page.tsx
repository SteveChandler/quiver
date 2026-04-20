"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

// Human-friendly copy for common error param values from /auth/callback.
// Raw error strings from Supabase (e.g. "Sign in failed. Please try again.")
// are replaced with context-aware copy that explains what went wrong and what
// to do next. Unknown values fall back to the raw string so we don't silently
// swallow errors that aren't covered here yet.
function humaniseAuthError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("sign in failed") || lower.includes("expired") || lower.includes("invalid")) {
    return "That sign-in link has expired. Try signing in again or use your password.";
  }
  if (lower.includes("authentication failed")) {
    return "Authentication failed. Please try again.";
  }
  return raw;
}

function SignInPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // `next` is set by /auth/confirm when the email-confirmation token exchange
  // didn't produce a session (link opened in a different browser/device).
  // Treat it as the post-sign-in redirect so the user lands on the page
  // they originally signed up from.
  const redirectTo =
    searchParams.get("redirectTo") ||
    searchParams.get("redirectUrl") ||
    searchParams.get("next") ||
    undefined;
  const justConfirmed = searchParams.get("just_confirmed") === "1";

  // Capture the error param on first render, then strip it from the URL so a
  // refresh doesn't replay the message. The useState initialiser runs once, so
  // we capture the raw value before router.replace removes it.
  const [urlError] = useState<string | null>(() => searchParams.get("error"));

  useEffect(() => {
    if (!urlError) return;
    // Strip after one render — the captured state above ensures the message
    // stays visible even after the URL is cleaned up.
    const next = new URLSearchParams(searchParams.toString());
    next.delete("error");
    const qs = next.toString();
    router.replace(qs ? `/auth/sign-in?${qs}` : "/auth/sign-in", { scroll: false });
  // Only run once on mount — searchParams is intentionally excluded so this
  // doesn't re-fire when router.replace resolves.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A redirectTo param means the user landed here via a protected-route redirect
  // (middleware.ts RouteGuard.buildSignInRedirect or admin/layout.tsx). Tag the
  // modal-open event with source='redirect' so the auth funnel can distinguish
  // redirect-driven opens from clicks on "Sign In" CTAs. Without this, the
  // modal's canonical fire would label everything as 'auth-page' and inflate
  // auth_modal_opened_login far above signin_cta_click. See plan
  // vast-dancing-whale for the 584% funnel mismatch this addresses.
  const source = justConfirmed
    ? "email-confirmed"
    : redirectTo
      ? "redirect"
      : "auth-page";

  // Fire the "email confirmed" toast once on mount when we arrived from
  // /auth/confirm without an active session. Ref-guard so React strict-mode
  // double-invoke in dev doesn't queue two toasts.
  const confirmedToastShown = useRef(false);
  useEffect(() => {
    if (!justConfirmed || confirmedToastShown.current) return;
    confirmedToastShown.current = true;
    toast({
      title: "Email confirmed",
      description: "Sign in to continue.",
    });
  }, [justConfirmed]);

  // Handle modal close - redirect to intended destination or home
  const handleClose = () => {
    if (!redirectTo || redirectTo === "/") {
      router.push("/");
    } else {
      router.push(redirectTo);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center">
      {/* Auth callback errors (e.g. expired magic link) rendered above the
          modal so they're visible when the modal opens. Shown only once —
          urlError is captured from the initial URL param before it's stripped. */}
      {urlError && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-[60]">
          <Alert variant="destructive" data-testid="auth-error-alert">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{humaniseAuthError(urlError)}</AlertDescription>
          </Alert>
        </div>
      )}
      <UnifiedAuthModal
        isOpen={true}
        onClose={handleClose}
        mode="login"
        source={source}
        modalContext={redirectTo}
        showCloseButton={true}
        returnTo={redirectTo}
      />
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen w-full items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <SignInPageContent />
    </Suspense>
  );
}
