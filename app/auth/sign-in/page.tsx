"use client";

import { Suspense } from "react";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { useRouter, useSearchParams } from "next/navigation";

function SignInPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || searchParams.get("redirectUrl") || undefined;

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
        source="auth-page"
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
