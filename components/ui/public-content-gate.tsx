"use client";

import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Waves } from "lucide-react";
import { usePathname } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { trackAuthModalOpened } from "@/lib/analytics/auth-events";
import {
  trackSignupCtaView,
  trackSignupCtaClick,
  trackSigninCtaClick,
} from "@/lib/analytics/signup-conversion-tracking";

interface PublicContentGateProps {
  children?: React.ReactNode;
  ctaTitle: string;
  ctaDescription?: string;
  ctaButtonText?: string;
  blurLevel?: "sm" | "md" | "lg";
  className?: string;
  source?: string; // For tracking where the CTA was clicked
}

export function PublicContentGate({
  children,
  ctaTitle,
  ctaDescription,
  ctaButtonText = "Sign Up Free",
  blurLevel = "md",
  className = "",
  source = "unknown",
}: PublicContentGateProps) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const hasTrackedView = useRef(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");

  // Prevent hydration mismatch: during SSR isLoading=true so children render unblurred,
  // but auth resolves before this component hydrates, causing server/client DOM mismatch.
  // Always render children on first render to match server HTML.
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => setHasMounted(true), []);

  // Track CTA view for non-authenticated users (only once)
  useEffect(() => {
    if (!user && !isLoading && !hasTrackedView.current) {
      trackSignupCtaView({
        source,
        cta_title: ctaTitle,
      });
      hasTrackedView.current = true;
    }
  }, [user, isLoading, source, ctaTitle]);

  // If user is authenticated, still loading auth, or not yet mounted (hydration safety),
  // show full content without blur
  if (!hasMounted || user || isLoading) {
    return <>{children ?? null}</>;
  }

  // Map blur levels to Tailwind classes
  const blurClass = {
    sm: "blur-sm",
    md: "blur-md",
    lg: "blur-lg",
  }[blurLevel];

  const handleSignUpClick = () => {
    trackSignupCtaClick({
      source,
      cta_title: ctaTitle,
    });
    setAuthMode("signup");
    setAuthModalOpen(true);
    trackAuthModalOpened({
      mode: "signup",
      source: `public-content-gate-${source}`,
    });
  };

  const handleSignInClick = () => {
    trackSigninCtaClick({
      source,
      cta_title: ctaTitle,
    });
    setAuthMode("login");
    setAuthModalOpen(true);
    trackAuthModalOpened({
      mode: "login",
      source: `public-content-gate-${source}`,
    });
  };

  // Public user: show blurred content with CTA overlay
  return (
    <div className={`relative ${className}`}>
      {/* Blurred content — smooth unblur transition on auth */}
      {children ? (
        <div
          className={`${blurClass} pointer-events-none select-none transition-[filter] duration-300 ease-out`}
        >
          {children}
        </div>
      ) : null}

      {/* CTA Overlay — natural content break, not a paywall card */}
      <div className="absolute inset-0 flex items-end justify-center p-4 pb-8 bg-gradient-to-t from-[#252D6B] via-[#252D6B]/80 to-transparent">
        <div className="max-w-sm w-full space-y-4 text-center">
          <div className="flex justify-center">
            <Waves className="h-6 w-6 text-[#F78E42]" />
          </div>

          <div>
            <h3 className="text-lg font-heading font-bold text-white mb-1">
              {ctaTitle}
            </h3>
            {ctaDescription && (
              <p className="text-sm text-[#9AABC6]">{ctaDescription}</p>
            )}
          </div>

          <div className="space-y-2">
            <Button
              onClick={handleSignUpClick}
              size="lg"
              className="w-full bg-[#F78E42] hover:bg-[#D57835] text-white font-heading font-semibold"
            >
              {ctaButtonText}
            </Button>
            <button
              type="button"
              onClick={handleSignInClick}
              className="w-full text-sm text-white/60 hover:text-white/80 transition-colors py-2"
            >
              Already have an account? Log in
            </button>
          </div>
        </div>
      </div>

      <UnifiedAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        mode={authMode}
        source={`public-content-gate-${source}`}
        returnTo={pathname}
      />
    </div>
  );
}
