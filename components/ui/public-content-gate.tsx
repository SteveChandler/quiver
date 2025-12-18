"use client";

import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Lock } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { track } from "@/lib/analytics";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { AuthBlockingOverlay } from "@/components/auth/auth-blocking-overlay";
import {
  trackAuthModalOpened,
  trackAuthModalReappeared,
} from "@/lib/analytics/auth-events";

interface PublicContentGateProps {
  children?: React.ReactNode;
  ctaTitle: string;
  ctaDescription?: string;
  blurLevel?: "sm" | "md" | "lg";
  className?: string;
  source?: string; // For tracking where the CTA was clicked
}

export function PublicContentGate({
  children,
  ctaTitle,
  ctaDescription,
  blurLevel = "md",
  className = "",
  source = "unknown",
}: PublicContentGateProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const hasTrackedView = useRef(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const [wasDismissed, setWasDismissed] = useState(false);

  // Handle interaction with blocking overlay - immediately reopen modal
  const handleOverlayInteraction = React.useCallback(() => {
    setAuthModalOpen(true);
    setWasDismissed(false);
    trackAuthModalReappeared({ source: `public-content-gate-${source}` });
  }, [source]);

  // Track CTA view for non-authenticated users (only once)
  useEffect(() => {
    if (!user && !isLoading && !hasTrackedView.current) {
      track("signup_cta_view", {
        source,
        cta_title: ctaTitle,
      });
      hasTrackedView.current = true;
    }
  }, [user, isLoading, source, ctaTitle]);

  // If user is authenticated OR still loading auth, show full content without blur
  // This prevents the auth gate from flashing during session restoration
  if (user || isLoading) {
    return <>{children ?? null}</>;
  }

  // Map blur levels to Tailwind classes
  const blurClass = {
    sm: "blur-sm",
    md: "blur-md",
    lg: "blur-lg",
  }[blurLevel];

  const handleSignUpClick = () => {
    track("signup_cta_click", {
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
    track("signin_cta_click", {
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
      {/* Blurred content */}
      {children ? (
        <div className={`${blurClass} pointer-events-none select-none`}>
          {children}
        </div>
      ) : null}

      {/* CTA Overlay */}
      <div className="absolute inset-0 flex items-center justify-center p-4 bg-gradient-to-t from-background/95 via-background/80 to-background/40">
        <Card className="max-w-md w-full shadow-xl border-2 border-primary/20">
          <CardContent className="p-6 text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-3 bg-primary/10 rounded-full">
                <Lock className="h-8 w-8 text-primary" />
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold mb-2">{ctaTitle}</h3>
              {ctaDescription && (
                <p className="text-sm text-muted-foreground">
                  {ctaDescription}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Button onClick={handleSignUpClick} size="lg" className="w-full">
                <Sparkles className="h-4 w-4 mr-2" />
                Sign Up Free
              </Button>
              <Button
                onClick={handleSignInClick}
                variant="outline"
                size="lg"
                className="w-full"
              >
                Log in
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Join thousands of surfers tracking conditions and logging sessions
            </p>
          </CardContent>
        </Card>
      </div>

      <UnifiedAuthModal
        isOpen={authModalOpen}
        onClose={() => {
          setAuthModalOpen(false);
          setWasDismissed(true);
        }}
        mode={authMode}
        source={`public-content-gate-${source}`}
        returnTo={pathname}
      />

      {/* Show blocking overlay when modal is dismissed */}
      {wasDismissed && !authModalOpen && (
        <AuthBlockingOverlay
          onInteraction={handleOverlayInteraction}
          message="Please sign up to continue"
          showHint={true}
        />
      )}
    </div>
  );
}
