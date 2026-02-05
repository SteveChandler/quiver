"use client";

import { useState, useCallback } from "react";
import { ArrowRight } from "lucide-react";
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
  /** Secondary button text */
  secondaryButtonText?: string;
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
  primaryButtonText = "Sign Up Free",
  secondaryButtonText = "Learn More",
  source,
  className,
}: InlineSignupCtaProps) {
  const { user, isLoading } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");

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
    setAuthMode("signup");
    setAuthModalOpen(true);
  }, [source, primaryButtonText]);

  const handleLoginClick = useCallback(() => {
    track("signin_cta_click", {
      source,
      cta_type: "inline",
      cta_text: secondaryButtonText,
    });
    trackAuthModalOpened({
      mode: "login",
      source: `inline-cta-${source}`,
    });
    setAuthMode("login");
    setAuthModalOpen(true);
  }, [source, secondaryButtonText]);

  // Don't render for authenticated users or while loading
  if (user || isLoading) {
    return null;
  }

  return (
    <>
      <div
        className={cn(
          "rounded-xl border border-sky-200/60",
          "bg-gradient-to-br from-sky-50/80 via-blue-50/50 to-cyan-50/80",
          "p-6 md:p-8",
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

          <div className="flex flex-col sm:flex-row gap-3 md:flex-shrink-0">
            <Button
              onClick={handleSignupClick}
              className="bg-ocean-blue hover:bg-blue-700 text-white font-semibold shadow-md"
              data-testid="inline-signup-primary-cta"
            >
              {primaryButtonText}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>

            <Button
              onClick={handleLoginClick}
              variant="outline"
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
              data-testid="inline-signup-secondary-cta"
            >
              {secondaryButtonText}
            </Button>
          </div>
        </div>

        <p className="mt-4 text-xs text-gray-500">
          Join 1,200+ surfers tracking conditions and logging sessions
        </p>
      </div>

      <UnifiedAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        mode={authMode}
        source={`inline-cta-${source}`}
      />
    </>
  );
}

export default InlineSignupCta;
