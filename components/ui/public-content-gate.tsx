"use client";

import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Waves } from "lucide-react";
import { usePathname } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
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
  /** Copy-variant label passed into signup_cta_view/_click metadata for
   *  per-variant conversion measurement in user_events. */
  ctaCopyVariant?: string;
}

export function PublicContentGate({
  children,
  ctaTitle,
  ctaDescription,
  ctaButtonText = "Sign Up Free",
  blurLevel = "md",
  className = "",
  source = "unknown",
  ctaCopyVariant,
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

  // Must be called unconditionally before any early returns (Rules of Hooks).
  const prefersReduced = useReducedMotion();

  // Track CTA view for non-authenticated users (only once)
  useEffect(() => {
    if (!user && !isLoading && !hasTrackedView.current) {
      trackSignupCtaView({
        source,
        cta_title: ctaTitle,
        cta_copy_variant: ctaCopyVariant,
      });
      hasTrackedView.current = true;
    }
  }, [user, isLoading, source, ctaTitle, ctaCopyVariant]);

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
      cta_copy_variant: ctaCopyVariant,
    });
    setAuthMode("signup");
    setAuthModalOpen(true);
  };

  const handleSignInClick = () => {
    trackSigninCtaClick({
      source,
      cta_title: ctaTitle,
      cta_copy_variant: ctaCopyVariant,
    });
    setAuthMode("login");
    setAuthModalOpen(true);
  };

  // Entrance choreography easing — exponential ease-out
  const easeOutQuart: [number, number, number, number] = [0.25, 1, 0.5, 1];

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
          {/* Waves icon — fade in + gentle rocking */}
          <motion.div
            className="flex justify-center"
            initial={prefersReduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, ease: easeOutQuart }}
          >
            <motion.div
              animate={
                prefersReduced
                  ? {}
                  : { rotate: [-5, 5, -5] }
              }
              transition={
                prefersReduced
                  ? {}
                  : {
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }
              }
            >
              <Waves className="h-6 w-6 text-[#F78E42]" />
            </motion.div>
          </motion.div>

          {/* Title + description — slide up with stagger */}
          <motion.div
            initial={prefersReduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.3,
              delay: prefersReduced ? 0 : 0.1,
              ease: easeOutQuart,
            }}
          >
            <h3 className="text-lg font-heading font-bold text-white mb-1">
              {ctaTitle}
            </h3>
            {ctaDescription && (
              <motion.p
                className="text-sm text-[#9AABC6]"
                initial={prefersReduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                  duration: 0.25,
                  delay: prefersReduced ? 0 : 0.2,
                  ease: easeOutQuart,
                }}
              >
                {ctaDescription}
              </motion.p>
            )}
          </motion.div>

          {/* CTA buttons — scale in with glow */}
          <motion.div
            className="space-y-2"
            initial={prefersReduced ? false : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: 0.35,
              delay: prefersReduced ? 0 : 0.3,
              ease: easeOutQuart,
            }}
          >
            <motion.div
              whileHover={prefersReduced ? {} : { scale: 1.03 }}
              whileTap={prefersReduced ? {} : { scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              <Button
                onClick={handleSignUpClick}
                size="lg"
                className="w-full bg-[#F78E42] hover:bg-[#D57835] hover:shadow-[0_0_20px_rgba(247,142,66,0.3)] text-[#11100D] font-heading font-semibold transition-shadow"
              >
                {ctaButtonText}
              </Button>
            </motion.div>
            <button
              type="button"
              onClick={handleSignInClick}
              className="w-full text-sm text-white/60 hover:text-white/80 transition-colors py-2 focus-ring"
            >
              Already have an account? Log in
            </button>
          </motion.div>
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
