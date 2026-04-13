"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { useAuth } from "@/context/auth-context";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { usePersistedDismissal } from "@/hooks/use-persisted-dismissal";
import { useSearchReferrer } from "@/hooks/use-search-referrer";
import { trackSignupCtaClick, trackSignupCtaView } from "@/lib/analytics/signup-conversion-tracking";
import { cn } from "@/lib/utils";

interface SearchReferralCta {
  ctaText: string;
  supportingText: string;
  contextMessage?: { title: string; description: string };
}

interface StickySignupBarProps {
  /** Analytics source tracking identifier */
  source: string;
  /** Primary CTA button text */
  ctaText?: string;
  /** Supporting text below the CTA */
  supportingText?: string;
  /** Scroll threshold in pixels before showing the bar */
  scrollThreshold?: number;
  /** Custom context message for the auth modal */
  contextMessage?: { title: string; description: string };
  /** Override copy for visitors arriving from search engines */
  searchReferralCta?: SearchReferralCta;
}

/**
 * StickySignupBar - Mobile-only sticky signup CTA bar
 *
 * Features:
 * - Fixed bottom position, mobile only (hidden on md+)
 * - Appears after scrolling past threshold
 * - Dismissable with session-based persistence (auto-clears on tab close)
 * - Opens UnifiedAuthModal instead of navigating
 * - Safe area padding for iOS devices
 * - Respects prefers-reduced-motion for animations
 * - Hidden for authenticated users
 */
export function StickySignupBar({
  source,
  ctaText = "Join Free",
  supportingText = "Log sessions, save your spots",
  scrollThreshold = 300,
  contextMessage,
  searchReferralCta,
}: StickySignupBarProps) {
  const { user, isLoading } = useAuth();
  const reducedMotion = useReducedMotion();
  const { isSearchReferral } = useSearchReferrer();

  // Override copy for search-referred visitors
  const resolvedCtaText =
    isSearchReferral && searchReferralCta ? searchReferralCta.ctaText : ctaText;
  const resolvedSupportingText =
    isSearchReferral && searchReferralCta ? searchReferralCta.supportingText : supportingText;
  const resolvedContextMessage =
    isSearchReferral && searchReferralCta?.contextMessage
      ? searchReferralCta.contextMessage
      : contextMessage;
  const [isVisible, setIsVisible] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Use the persisted dismissal hook with sanitized key and timestamp validation
  const { isDismissed, handleDismiss } = usePersistedDismissal(
    `sticky_signup_${source}`,
    {
      durationDays: 1, // Session ends before this, but provides a safety expiry
      trackingEvent: "signup_cta_dismiss",
      trackingProps: { source },
      storage: "session",
    }
  );

  // Handle scroll visibility with throttle to avoid excessive re-renders
  const wasVisible = useRef(false);
  const hasTrackedView = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleScroll = () => {
      const visible = window.scrollY > scrollThreshold;
      if (visible !== wasVisible.current) {
        wasVisible.current = visible;
        setIsVisible(visible);
        if (visible && !hasTrackedView.current) {
          trackSignupCtaView({ source, cta_type: "sticky_bar", is_search_referral: isSearchReferral });
          hasTrackedView.current = true;
        }
      }
    };

    // Check initial scroll position
    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [scrollThreshold, source, isSearchReferral]);

  const handleCtaClick = useCallback(() => {
    trackSignupCtaClick({
      source,
      cta_type: "sticky_bar",
      cta_text: resolvedCtaText,
      is_search_referral: isSearchReferral,
    });
    setAuthModalOpen(true);
  }, [source, resolvedCtaText, isSearchReferral]);

  // Don't render for authenticated users or while loading
  if (user || isLoading) {
    return null;
  }

  // Don't render if dismissed
  if (isDismissed) {
    return null;
  }


  return (
    <>
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50",
          "bg-[#252D6B]/95 backdrop-blur-lg",
          "border-t border-white/10 shadow-[0_-4px_20px_rgba(0,0,0,0.3)]",
          "pb-[env(safe-area-inset-bottom)]",
          "md:hidden", // Only show on mobile
          reducedMotion
            ? isVisible
              ? "opacity-100"
              : "opacity-0 pointer-events-none"
            : cn(
                "transition-all duration-300 ease-out",
                isVisible
                  ? "translate-y-0 opacity-100"
                  : "translate-y-full opacity-0 pointer-events-none"
              )
        )}
        role="complementary"
        aria-label="Sign up prompt"
        aria-live="polite"
        data-testid="sticky-signup-bar"
      >
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex-1 min-w-0 mr-3">
            <p className="text-sm text-white/80 truncate">{resolvedSupportingText}</p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              onClick={handleCtaClick}
              size="sm"
              className="bg-[#F78E42] text-white hover:bg-[#F78E42]/90 font-semibold px-4 rounded-full shadow-sm"
              data-testid="sticky-signup-cta"
            >
              {resolvedCtaText}
            </Button>

            <button
              onClick={handleDismiss}
              className="p-2.5 text-white/50 hover:text-white/80 transition-colors rounded-full hover:bg-white/10 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Dismiss signup prompt"
              data-testid="sticky-signup-dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <UnifiedAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        mode="signup"
        source={`sticky-bar-${source}`}
        contextMessage={resolvedContextMessage ?? {
          title: "See Your Forecast",
          description: "Conditions explained clearly in 30 seconds",
        }}
      />
    </>
  );
}

