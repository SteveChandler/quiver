"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { usePathname } from "next/navigation";
import {
  trackPartialGateViewed,
  trackPartialGateSignupClick,
} from "@/lib/analytics/engagement-tracking";
import {
  trackSigninCtaClick,
  trackSignupCtaClick,
} from "@/lib/analytics/signup-conversion-tracking";

interface PartialContentGateProps {
  /** Content type label for CTA text and tracking */
  contentType: string;
  /** Total number of items available */
  totalCount: number;
  /** Number of items shown as preview */
  previewCount: number;
  /** Children are the gated content (shown behind the fade) */
  children?: React.ReactNode;
  className?: string;
}

export function PartialContentGate({
  contentType,
  totalCount,
  previewCount,
  children,
  className = "",
}: PartialContentGateProps) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const hasTrackedView = useRef(false);
  const gateRef = useRef<HTMLDivElement>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");

  // Track gate view via IntersectionObserver (once)
  useEffect(() => {
    if (user || isLoading || hasTrackedView.current) return;
    const el = gateRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasTrackedView.current) {
          trackPartialGateViewed(contentType, totalCount);
          hasTrackedView.current = true;
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [user, isLoading, contentType, totalCount]);

  // If user is authenticated or still loading, render nothing
  if (user || isLoading) return null;

  // If total content fits within preview, no gate needed
  if (totalCount <= previewCount) return null;

  const remaining = totalCount - previewCount;

  const handleSignUpClick = () => {
    trackPartialGateSignupClick(contentType);
    trackSignupCtaClick({
      source: `partial-gate-${contentType}`,
      surface: "partial-gate",
      content_type: contentType,
    });
    setAuthMode("signup");
    setAuthModalOpen(true);
  };

  const handleLoginClick = () => {
    trackSigninCtaClick({
      source: `partial-gate-${contentType}`,
      surface: "partial-gate",
      content_type: contentType,
    });
    setAuthMode("login");
    setAuthModalOpen(true);
  };

  return (
    <div ref={gateRef} className={className}>
      {/* Gradient fade overlay */}
      <div className="relative">
        <div className="absolute bottom-full left-0 right-0 h-24 pointer-events-none bg-gradient-to-t from-white via-white/80 to-transparent" />
      </div>

      {/* CTA section */}
      <div className="text-center py-6 space-y-3">
        <p className="text-sm text-muted-foreground">
          Sign up to see {remaining} more {contentType}
        </p>

        <Button onClick={handleSignUpClick} size="lg">
          <Sparkles className="h-4 w-4 mr-2" />
          Sign Up Free
        </Button>

        <p className="text-xs text-muted-foreground">
          Already have an account?{" "}
          <button
            onClick={handleLoginClick}
            className="text-primary hover:underline font-medium focus-ring"
          >
            Log in
          </button>
        </p>
      </div>

      <UnifiedAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        mode={authMode}
        source={`partial-gate-${contentType}`}
        returnTo={pathname}
      />
    </div>
  );
}
