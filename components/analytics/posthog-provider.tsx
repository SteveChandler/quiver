"use client";

import { useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/context/auth-context";
import {
  applyClientPostHogTrackingStorageEvent,
  buildPostHogUserProperties,
  captureQueuedClientPostHogSignup,
  identifyPostHogUser,
  isClientPostHogTrackingRevisionCurrent,
  resetPostHog,
  setAnonymousClientPostHogTracking,
  setClientPostHogTrackingAllowed,
} from "@/lib/posthog-client";
import { getOwnAnalyticsTrackingAllowed } from "@/lib/analytics/consent";
import { createClient } from "@/lib/supabase/client";

export function PostHogProvider(): null {
  const { user, isLoading } = useAuth();
  const hasResolvedAuth = useRef(false);
  const identifiedUserId = useRef<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    window.addEventListener("storage", applyClientPostHogTrackingStorageEvent);
    return () => {
      window.removeEventListener(
        "storage",
        applyClientPostHogTrackingStorageEvent,
      );
    };
  }, []);

  useEffect(() => {
    let active = true;

    if (isLoading) {
      if (!hasResolvedAuth.current) {
        setClientPostHogTrackingAllowed(null);
      }
      return () => {
        active = false;
      };
    }

    hasResolvedAuth.current = true;

    if (!user) {
      setClientPostHogTrackingAllowed(null);
      resetPostHog();
      identifiedUserId.current = null;
      setAnonymousClientPostHogTracking();
      return () => {
        active = false;
      };
    }

    if (
      identifiedUserId.current &&
      identifiedUserId.current !== user.id
    ) {
      resetPostHog();
      identifiedUserId.current = null;
    }

    const revalidateTrackingConsent = (): void => {
      const trackingRevision = setClientPostHogTrackingAllowed(null);

      void getOwnAnalyticsTrackingAllowed(supabase, user.id)
        .then((allowed) => {
          if (
            !active ||
            !isClientPostHogTrackingRevisionCurrent(trackingRevision)
          ) {
            return;
          }
          setClientPostHogTrackingAllowed(allowed);
          if (!allowed) {
            resetPostHog();
            identifiedUserId.current = null;
            return;
          }

          identifyPostHogUser(user.id, buildPostHogUserProperties(user));
          identifiedUserId.current = user.id;
          captureQueuedClientPostHogSignup(user.id);
        })
        .catch(() => {
          if (
            !active ||
            !isClientPostHogTrackingRevisionCurrent(trackingRevision)
          ) {
            return;
          }
          resetPostHog();
          identifiedUserId.current = null;
        });
    };

    const handleForeground = (): void => {
      if (document.visibilityState !== "visible") return;
      revalidateTrackingConsent();
    };

    document.addEventListener("visibilitychange", handleForeground);
    window.addEventListener("focus", handleForeground);
    revalidateTrackingConsent();

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", handleForeground);
      window.removeEventListener("focus", handleForeground);
    };
  }, [isLoading, supabase, user]);

  return null;
}
