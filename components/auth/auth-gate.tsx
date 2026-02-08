"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { AuthChangeEvent, Session } from "@supabase/auth-js";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { AuthBlockingOverlay } from "@/components/auth/auth-blocking-overlay";
import {
  trackAuthWallShown,
  trackAuthWallDismissed,
  trackAuthModalReappeared,
} from "@/lib/analytics/auth-events";

type Props = {
  /** If true, prevent any background interaction entirely */
  block?: boolean;
  /** Delay in milliseconds before showing the auth wall (default: 5000ms) */
  delayMs?: number;
  /** Allow closing the dialog (default: true for preview mode) */
  closable?: boolean;
};

export default function AuthGate({
  block = true,
  delayMs = 5000,
  closable = true,
}: Props) {
  const sb = React.useMemo(() => createClient(), []);
  const [checking, setChecking] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [wasDismissed, setWasDismissed] = React.useState(false);

  const pathname = usePathname();
  const search = useSearchParams();

  const returnTo = React.useMemo(() => {
    const q = search?.toString();
    return q ? `${pathname}?${q}` : pathname || "/";
  }, [pathname, search]);

  // Handle interaction with blocking overlay - immediately reopen modal
  const handleOverlayInteraction = React.useCallback(() => {
    setOpen(true);
    setWasDismissed(false);
    if (block) {
      document.body.style.overflow = "hidden";
    }
    trackAuthModalReappeared({ source: "auth-gate" });
  }, [block]);

  React.useEffect(() => {
    const { data: sub } = sb.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      // If auth succeeds while the gate is open (or previously dismissed),
      // ensure we tear down any guest-blocking UI immediately.
      if (event === "SIGNED_IN" && session) {
        document.body.style.overflow = "";
        try {
          localStorage.removeItem("auth_gate_dismissed");
        } catch {}
        setOpen(false);
        setWasDismissed(false);
      }
    });
    return () => {
      sub?.subscription?.unsubscribe?.();
    };
  }, [sb]);

  React.useEffect(() => {
    let alive = true;
    let timer: NodeJS.Timeout;

    (async () => {
      const { data } = await sb.auth.getSession();
      if (!alive) return;

      // If user is already authenticated, don't show the modal
      if (data.session) {
        setChecking(false);
        return;
      }

      // Check if modal was recently dismissed (within last 30 seconds)
      const dismissedAt = localStorage.getItem("auth_gate_dismissed");
      if (dismissedAt) {
        const timeSinceDismissal = Date.now() - parseInt(dismissedAt, 10);
        const thirtySeconds = 30 * 1000;

        if (timeSinceDismissal < thirtySeconds) {
          // Don't show modal yet, still within dismissal window
          setChecking(false);
          return;
        }
      }

      // Show modal after initial delay
      timer = setTimeout(() => {
        if (alive) {
          setOpen(true);
          setChecking(false);
          if (block) {
            document.body.style.overflow = "hidden";
          }
          // Track analytics
          trackAuthWallShown(delayMs);
        }
      }, delayMs);

      setChecking(false);
    })();

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      document.body.style.overflow = "";
    };
  }, [sb, block, delayMs, pathname]);

  const handleClose = async () => {
    if (!closable) return;

    // If the user just authenticated, closing the modal is NOT a "dismiss".
    // We must verify session state before setting wasDismissed=true.
    let hasSession = false;
    try {
      const { data } = await sb.auth.getSession();
      hasSession = !!data.session;
    } catch {
      hasSession = false;
    }

    if (hasSession) {
      // Auth succeeded; close modal and ensure overlay never appears.
      document.body.style.overflow = "";
      try {
        localStorage.removeItem("auth_gate_dismissed");
      } catch {}
      setOpen(false);
      setWasDismissed(false);
      return;
    }

    // User dismissed the modal - show blocking overlay
    document.body.style.overflow = "";

    // Save dismissal time to localStorage
    localStorage.setItem("auth_gate_dismissed", Date.now().toString());

    trackAuthWallDismissed();
    setOpen(false);
    setWasDismissed(true);
  };

  if (checking) {
    return null;
  }

  return (
    <>
      <UnifiedAuthModal
        isOpen={open}
        onClose={handleClose}
        mode="login"
        source="auth-gate"
        returnTo={returnTo}
        dismissible={closable}
        showCloseButton={closable}
        isAuthGate={true}
      />

      {/* Show blocking overlay when modal is dismissed */}
      {wasDismissed && !open && (
        <AuthBlockingOverlay
          onInteraction={handleOverlayInteraction}
          message="Please sign up to continue"
          showHint={true}
        />
      )}
    </>
  );
}
