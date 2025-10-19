"use client";

import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics";
import { useEffect, useRef } from "react";

interface PublicContentGateProps {
  children: React.ReactNode;
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
  const { user } = useAuth();
  const router = useRouter();
  const hasTrackedView = useRef(false);

  // Track CTA view for non-authenticated users (only once)
  useEffect(() => {
    if (!user && !hasTrackedView.current) {
      track("signup_cta_view", {
        source,
        cta_title: ctaTitle,
      });
      hasTrackedView.current = true;
    }
  }, [user, source, ctaTitle]);

  // If user is authenticated, show full content without blur
  if (user) {
    return <>{children}</>;
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
    router.push(
      `/auth/sign-up?redirectTo=${encodeURIComponent(window.location.pathname)}`
    );
  };

  const handleSignInClick = () => {
    track("signin_cta_click", {
      source,
      cta_title: ctaTitle,
    });
    router.push(
      `/auth/sign-in?redirectTo=${encodeURIComponent(window.location.pathname)}`
    );
  };

  // Public user: show blurred content with CTA overlay
  return (
    <div className={`relative ${className}`}>
      {/* Blurred content */}
      <div className={`${blurClass} pointer-events-none select-none`}>
        {children}
      </div>

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
                Sign In
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Join thousands of surfers tracking conditions and logging sessions
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
