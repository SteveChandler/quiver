"use client";

import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Client half of the sign-up page. Invite token cookie writes are handled by
 * /invite/start before this route renders.
 */
export default function SignUpClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo =
    searchParams.get("redirectTo") ||
    searchParams.get("redirectUrl") ||
    undefined;

  return (
    <div className="flex min-h-screen w-full items-center justify-center">
      <UnifiedAuthModal
        isOpen={true}
        onClose={() => router.push("/")}
        mode="signup"
        source="auth-page"
        showCloseButton={true}
        returnTo={redirectTo}
      />
    </div>
  );
}
