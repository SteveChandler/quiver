"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { useAuth } from "@/context/auth-context";
import { track } from "@/lib/analytics";
import { trackAuthModalOpened } from "@/lib/analytics/auth-events";
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
  /** Additional CSS classes */
  className?: string;
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
  primaryButtonText = "Get My Forecast",
  source,
  className,
}: InlineSignupCtaProps) {
  const { user, isLoading } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const handleSignupClick = useCallback(() => {
    track("signup_cta_click", {
      source,
      cta_type: "inline",
      cta_text: primaryButtonText,
    });
    trackAuthModalOpened({
      mode: "signup",
      source: `inline-cta-${source}`,
    });
    setAuthModalOpen(true);
  }, [source, primaryButtonText]);

  // Don't render for authenticated users or while loading
  if (user || isLoading) {
    return null;
  }

  return (
    <>
      <div
        className={cn(
          "rounded-2xl backdrop-blur-sm",
          "bg-gradient-to-br from-white/90 to-ocean-blue/5",
          "border border-ocean-blue/15 shadow-sm ring-1 ring-ocean-blue/5",
          "p-6",
          className
        )}
        role="region"
        aria-label={`Sign up prompt: ${title}`}
        data-testid="inline-signup-cta"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-2">
              {title}
            </h3>
            <p className="text-sm md:text-base text-gray-600">{description}</p>
          </div>

          <div className="flex-shrink-0">
            <Button
              onClick={handleSignupClick}
              className="rounded-full bg-ocean-blue text-white px-6 shadow-sm hover:shadow-md font-semibold"
              data-testid="inline-signup-primary-cta"
            >
              {primaryButtonText}
            </Button>
          </div>
        </div>

        <p className="mt-4 text-xs text-gray-500">
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
          description: "Personalized surf forecasts in 30 seconds",
        }}
      />
    </>
  );
}

