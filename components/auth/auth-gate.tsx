"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { AuthBlockingOverlay } from "@/components/auth/auth-blocking-overlay";
import { trackAuthWallShown, trackAuthWallDismissed, trackAuthModalReappeared } from "@/lib/analytics/auth-events";

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
  const sb = React.useMemo(() => createSupabaseBrowser(), []);
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

  const handleClose = () => {
    if (!closable) return;

    // User dismissed the modal - show blocking overlay
    document.body.style.overflow = "";
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
        mode="auto"
        source="auth-gate"
        returnTo={returnTo}
        dismissible={closable}
        showCloseButton={closable}
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
