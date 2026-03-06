"use client";

import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
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
                <Sparkles className="h-8 w-8 text-primary" />
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
                {ctaButtonText}
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
              Trusted by hundreds of surfers along the coast
            </p>
          </CardContent>
        </Card>
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
