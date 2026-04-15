"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Bell, Heart } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import {
  safeGetItem,
  safeSetItem,
} from "@/lib/utils/safe-storage";
import { track } from "@/lib/analytics";
import {
  trackSignupCtaClick,
  trackSignupCtaView,
} from "@/lib/analytics/signup-conversion-tracking";

const DISMISSED_KEY = "qvr_map_signup_dismissed";

interface MapSignupPromptProps {
  /** Name of the currently selected beach, if any */
  beachName?: string | null;
  /** Analytics source identifier */
  source: "map-sidebar" | "map-bottom-sheet";
}

/**
 * MapSignupPrompt — Contextual signup banner for the map page.
 *
 * Shows a non-intrusive inline banner in the sidebar/bottom sheet
 * encouraging anonymous visitors to sign up. Dismisses for the session.
 * Only renders for unauthenticated users.
 */
export function MapSignupPrompt({ beachName, source }: MapSignupPromptProps) {
  const { user, isLoading } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const viewTrackedRef = useRef(false);

  // Check if already dismissed this session
  useEffect(() => {
    const val = safeGetItem(DISMISSED_KEY);
    if (val === "1") setDismissed(true);
  }, []);

  // Track view once
  useEffect(() => {
    if (!user && !isLoading && !dismissed && !viewTrackedRef.current) {
      viewTrackedRef.current = true;
      trackSignupCtaView({
        source,
        surface: "map",
      });
    }
  }, [user, isLoading, dismissed, source]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    safeSetItem(DISMISSED_KEY, "1");
    // GA4-only: signup_cta_dismiss is not in the Supabase user_events funnel.
    track("signup_cta_dismiss", {
      source,
      surface: "map",
    });
  }, [source]);

  const handleCtaClick = useCallback(() => {
    trackSignupCtaClick({
      source,
      surface: "map",
      beach_name: beachName ?? undefined,
    });
    setAuthModalOpen(true);
  }, [source, beachName]);

  // Don't render for authenticated users or while loading
  if (isLoading || user || dismissed) return null;

  // Contextual copy based on whether a beach is selected
  const headline = beachName
    ? `Get alerts for ${beachName}`
    : "Get alerts";
  const description = beachName
    ? "Sign up to get notified when conditions are firing."
    : "Know when conditions fire at your spots";

  return (
    <>
      <div className="relative mx-2 my-3 p-3 rounded-xl bg-white/[0.04] border-l-2 border-[#F78E42] shadow-sm">
        {/* Dismiss button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 rounded-full text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/* Content */}
        <div className="flex items-start gap-3 pr-6">
          <div className="mt-0.5 flex items-center justify-center w-8 h-8 rounded-full bg-[#F78E42]/15 shrink-0">
            {beachName ? (
              <Bell className="h-4 w-4 text-[#F78E42]" />
            ) : (
              <Heart className="h-4 w-4 text-[#F78E42]" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-heading font-semibold text-white leading-tight">
              {headline}
            </p>
            <p className="text-xs text-[#9AABC6] mt-0.5 leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        {/* CTA Button */}
        <Button
          onClick={handleCtaClick}
          size="sm"
          className="w-full mt-3 bg-[#F78E42] hover:bg-[#F78E42]/90 text-white font-heading font-semibold text-xs rounded-lg h-8"
        >
          Get alerts
        </Button>
      </div>

      {/* Auth Modal */}
      <UnifiedAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        mode="signup"
        source={source}
        returnTo="/map"
        contextMessage={{
          title: beachName
            ? `Get alerts for ${beachName}`
            : "Get Alerts",
          description: beachName
            ? "Create a free account to save this spot and get condition alerts."
            : "We'll let you know when conditions are right at your spots.",
        }}
      />
    </>
  );
}
