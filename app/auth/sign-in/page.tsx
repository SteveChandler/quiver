"use client";

import { Suspense } from "react";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { useRouter, useSearchParams } from "next/navigation";

function SignInPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || searchParams.get("redirectUrl") || undefined;

  // A redirectTo param means the user landed here via a protected-route redirect
  // (middleware.ts RouteGuard.buildSignInRedirect or admin/layout.tsx). Tag the
  // modal-open event with source='redirect' so the auth funnel can distinguish
  // redirect-driven opens from clicks on "Sign In" CTAs. Without this, the
  // modal's canonical fire would label everything as 'auth-page' and inflate
  // auth_modal_opened_login far above signin_cta_click. See plan
  // vast-dancing-whale for the 584% funnel mismatch this addresses.
  const source = redirectTo ? "redirect" : "auth-page";

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
