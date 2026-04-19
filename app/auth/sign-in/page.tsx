"use client";

import { Suspense, useEffect, useRef } from "react";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "@/components/ui/use-toast";

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
