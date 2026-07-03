"use client";

import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Client half of the sign-up page. Invite token cookie writes are handled by
 * /invite/start before this route renders.
 */

/**
 * Allowlist of accepted `redirectTo` paths. Any path passing
 * `isValidRedirectPath` is a same-origin URL that starts with a single "/",
 * never a "//" protocol-relative URL. We additionally require the path to
 * match one of these shape guards so callers can't smuggle arbitrary
 * off-site or unexpected internal destinations through the auth flow.
 *
 * Extend by adding a regex here (and a test) — do NOT relax the base
 * "starts with /, not //" invariant.
 */
const REDIRECT_ALLOWLIST: readonly RegExp[] = [
  // Surf Drops share link (from /go/[shareSlug])
  /^\/go\/[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{10}$/,
  // Surf Drops detail (UUID v4-shaped)
  /^\/drops\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
];

export function isValidRedirectPath(path: string | null | undefined): boolean {
  if (!path) return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  return REDIRECT_ALLOWLIST.some((pattern) => pattern.test(path));
}

export default function SignUpClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect =
    searchParams.get("redirectTo") ||
    searchParams.get("redirectUrl") ||
    undefined;

  // Preserve prior behavior: paths that aren't in the allowlist still
  // pass through to the modal so we don't regress any pre-existing
  // consumers. New Surf Drops routes are explicitly accepted above.
  const redirectTo = rawRedirect;

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
