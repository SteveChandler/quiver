"use client";

import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { useRouter, useSearchParams } from "next/navigation";

export default function SignInPage() {
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
