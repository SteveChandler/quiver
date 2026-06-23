"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { useAuth } from "@/context/auth-context";
import {
  trackSignupCtaClick,
  trackSignupCtaView,
} from "@/lib/analytics/signup-conversion-tracking";
import { cn } from "@/lib/utils";

interface InlineSignupCtaProps {
  /** Headline text for the CTA */
  title: string;
  /** Supporting description text */
  description: string;
  /** Primary button text */
  primaryButtonText?: string;
  /** Analytics source tracking identifier */
  source: string;
  /** Copy-variant label — passed into signup_cta_view/_click metadata so we can
   *  measure per-variant conversion rate in user_events without a flag SDK. */
  ctaCopyVariant?: string;
  /** Additional CSS classes */
  className?: string;
  /** Visual treatment variant */
  variant?: "default" | "zine";
}

/**
 * InlineSignupCta - Contextual signup CTA for mid-content placement
 *
 * Features:
 * - Subtle card design with light gradient background
 * - Contextual title/description via props
 * - Primary + secondary action buttons
 * - Opens UnifiedAuthModal instead of navigating
 * - Hidden for authenticated users
 */
export function InlineSignupCta({
  title,
  description,
  primaryButtonText = "See your surf call",
  source,
  ctaCopyVariant,
  className,
  variant = "default",
}: InlineSignupCtaProps) {
  const { user, isLoading } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const hasTrackedView = useRef(false);

  useEffect(() => {
    if (!user && !isLoading && !hasTrackedView.current) {
      trackSignupCtaView({
        source,
        cta_type: "inline",
        cta_copy_variant: ctaCopyVariant,
      });
      hasTrackedView.current = true;
    }
  }, [user, isLoading, source, ctaCopyVariant]);

  const handleSignupClick = useCallback(() => {
    trackSignupCtaClick({
      source,
      cta_type: "inline",
      cta_text: primaryButtonText,
      cta_copy_variant: ctaCopyVariant,
    });
    setAuthModalOpen(true);
  }, [source, primaryButtonText, ctaCopyVariant]);

  // Don't render for authenticated users or while loading
  if (user || isLoading) {
    return null;
  }

  return (
    <>
      <div
        className={cn(
          variant === "zine"
            ? [
                "rounded-md border-2 border-[#11100D] bg-[#F4EBD8] p-6 shadow-[3px_4px_0_rgba(17,16,13,0.22)]",
                "relative overflow-hidden",
              ]
            : [
                "rounded-2xl backdrop-blur-sm",
                "bg-gradient-to-br from-white/90 to-ocean-blue/5",
                "border border-ocean-blue/15 shadow-sm ring-1 ring-ocean-blue/5",
                "p-6",
              ],
          className,
        )}
        role="region"
        aria-label={`Sign up prompt: ${title}`}
        data-testid="inline-signup-cta"
      >
        {variant === "zine" ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-25 mix-blend-multiply"
            style={{
              backgroundImage:
                "radial-gradient(circle at 12% 32%, rgba(0,0,0,0.18) 0.5px, transparent 1.2px), radial-gradient(circle at 78% 88%, rgba(0,0,0,0.14) 0.5px, transparent 1px), radial-gradient(circle at 45% 12%, rgba(0,0,0,0.12) 0.5px, transparent 1px)",
              backgroundSize: "7px 9px, 11px 7px, 9px 11px",
            }}
          />
        ) : null}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1">
            <h3
              className={cn(
                "mb-2 text-lg md:text-xl",
                variant === "zine"
                  ? "font-normal uppercase tracking-[0.02em] text-[#11100D]"
                  : "font-semibold text-gray-900",
              )}
              style={
                variant === "zine"
                  ? {
                      fontFamily:
                        "var(--font-zine-display), 'Bowlby One', sans-serif",
                    }
                  : undefined
              }
            >
              {title}
            </h3>
            <p
              className={cn(
                "text-sm md:text-base",
                variant === "zine" ? "text-[#11100D]/75" : "text-gray-600",
              )}
            >
              {description}
            </p>
          </div>

          <div className="flex-shrink-0">
            <Button
              onClick={handleSignupClick}
              className={cn(
                variant === "zine"
                  ? "rounded-full border-2 border-[#11100D] bg-[#B56A2B] px-6 text-[#F4EBD8] shadow-[2px_2px_0_rgba(17,16,13,0.35)] hover:bg-[#9A5820] hover:shadow-[3px_3px_0_rgba(17,16,13,0.35)] font-semibold"
                  : "rounded-full bg-ocean-blue text-white px-6 shadow-sm hover:shadow-md font-semibold",
              )}
              data-testid="inline-signup-primary-cta"
            >
              {primaryButtonText}
            </Button>
          </div>
        </div>

        <p
          className={cn(
            "mt-4 text-xs",
            variant === "zine" ? "text-[#11100D]/55" : "text-gray-500",
          )}
        >
          Built with feedback from local surfers.
        </p>
      </div>

      <UnifiedAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        mode="signup"
        source={`inline-cta-${source}`}
        contextMessage={{
          title: "Know Before You Go",
          description: "Conditions explained clearly in 30 seconds",
        }}
      />
    </>
  );
}
