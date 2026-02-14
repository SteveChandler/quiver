"use client";

/**
 * NativeAuthGuard Component
 *
 * Redirects native Capacitor app users to /auth/sign-in when their session expires.
 * Web users are completely unaffected - this only applies to native apps.
 */

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { isNativeApp } from "@/lib/mobile/platform";
import { safeGetItem } from "@/lib/utils/safe-storage";
import {
  isRedirectLoopDetected,
  incrementRedirectAttempt,
  clearRedirectAttempts,
} from "@/lib/auth/auth-utils";

export function NativeAuthGuard() {
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Wait for auth to finish initializing
    if (isLoading) return;

    // Only applies to native Capacitor apps
    if (!isNativeApp()) return;

    // Reset redirect flag when user authenticates or lands on an auth page,
    // so the guard can fire again if they later return unauthenticated.
    if (isAuthenticated || pathname.startsWith("/auth")) {
      hasRedirected.current = false;
    }

    // Already on an auth page — don't redirect
    if (pathname.startsWith("/auth")) return;

    // User IS authenticated — clear any redirect attempts and bail
    if (isAuthenticated) {
      clearRedirectAttempts();
      return;
    }

    // Only redirect returning users (new installs shouldn't be forced to login)
    const isReturning = safeGetItem("quiver_returning_user");
    if (!isReturning) return;

    // Prevent redirect loops
    if (isRedirectLoopDetected()) return;

    // Prevent double-redirect in rapid state transitions
    if (hasRedirected.current) return;
    hasRedirected.current = true;

    incrementRedirectAttempt();

    const redirectTo =
      pathname !== "/" ? `?redirectTo=${encodeURIComponent(pathname)}` : "";
    router.replace(`/auth/sign-in${redirectTo}`);
  }, [isAuthenticated, isLoading, pathname, router]);

  return null;
}
