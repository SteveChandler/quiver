"use client";

import { useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StickySignupBar } from "@/components/ui/sticky-signup-bar";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { useAuth } from "@/context/auth-context";
import { track } from "@/lib/analytics";
import { trackAuthModalOpened } from "@/lib/analytics/auth-events";

/**
 * Scroll depth tracking wrapper for the features page.
 * Wraps server-rendered content and adds client-only interactivity.
 */
export function FeaturesScrollTracker({ children }: { children: ReactNode }) {
  const scrollMilestones = useRef(new Set<number>());
  const scrollRafPending = useRef(false);

  useEffect(() => {
    const handleScroll = () => {
      if (scrollRafPending.current) return;
      scrollRafPending.current = true;
      requestAnimationFrame(() => {
        scrollRafPending.current = false;
        const docHeight =
          document.documentElement.scrollHeight - window.innerHeight;
        if (docHeight <= 0) return;
        const scrollPercent = Math.round((window.scrollY / docHeight) * 100);
        for (const milestone of [25, 50, 75, 100]) {
          if (
            scrollPercent >= milestone &&
            !scrollMilestones.current.has(milestone)
          ) {
            scrollMilestones.current.add(milestone);
            track("scroll_depth", {
              page: "/features",
              depth_percent: milestone,
            });
          }
        }
      });
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return <>{children}</>;
}

/**
 * Signup CTA button that opens the auth modal (client-only due to auth state).
 */
export function FeaturesSignupButton({
  ctaLocation,
  className,
  children,
}: {
  ctaLocation: string;
  className?: string;
  children?: ReactNode;
}) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authSource, setAuthSource] = useState("features-hero");

  const handleSignupClick = useCallback(() => {
    track("signup_cta_click", { source: "features", cta_type: ctaLocation });
    trackAuthModalOpened({
      mode: "signup",
      source: `features-${ctaLocation}`,
    });
    setAuthSource(`features-${ctaLocation}`);
    setAuthModalOpen(true);
  }, [ctaLocation]);

  if (user) return null;

  return (
    <>
      <Button
        size="lg"
        onClick={handleSignupClick}
        className={className}
      >
        {children || (
          <>
            Get My Forecast
            <ArrowRight className="ml-2 h-5 w-5" />
          </>
        )}
      </Button>
      {authModalOpen && (
        <UnifiedAuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          mode="signup"
          source={authSource}
          returnTo={pathname}
          contextMessage={{
            title: "Your Personalized Forecast Awaits",
            description:
              "Create an account to unlock match scores for every beach.",
          }}
        />
      )}
    </>
  );
}

/**
 * Sticky signup bar wrapper (client component).
 */
export function FeaturesStickyBar() {
  return (
    <StickySignupBar
      source="features"
      ctaText="Get My Forecast"
      supportingText="Personalized surf forecasts"
      scrollThreshold={400}
    />
  );
}
