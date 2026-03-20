"use client";

import React, { useState } from "react";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";
import { useAuth } from "@/context/auth-context";

export interface MatchScoreTeaserProps {
  /** Beach identifier (used for future deferred actions if needed) */
  beachId: string;
  /** Beach name shown in the auth modal context message */
  beachName: string;
  /** Additional CSS classes */
  className?: string;
  /** "badge" (default) = small inline badge, "card" = prominent card CTA */
  variant?: "badge" | "card";
}

export function MatchScoreTeaser({
  beachId: _beachId,
  beachName,
  className,
  variant = "badge",
}: MatchScoreTeaserProps) {
  const { user } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const pathname = usePathname();

  // Don't show teaser for authenticated users
  if (user) return null;

  if (variant === "card") {
    return (
      <>
        <button
          data-testid="match-score-teaser-card"
          onClick={() => setShowAuth(true)}
          className={cn(
            "w-full rounded-xl border border-amber-200/30 bg-gradient-to-r from-amber-50/10 to-amber-100/10",
            "px-4 py-3 flex items-center gap-3 text-left",
            "hover:from-amber-50/20 hover:to-amber-100/20 transition-colors",
            className
          )}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-400/20">
            <Sparkles className="h-5 w-5 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white/90">
              What does today look like at {beachName}?
            </p>
            <p className="text-xs text-white/50">
              Sign up to see conditions explained clearly for your level
            </p>
          </div>
          <span className="text-lg font-bold text-amber-400">???</span>
        </button>

        {showAuth && (
          <UnifiedAuthModal
            isOpen={showAuth}
            onClose={() => setShowAuth(false)}
            mode="signup"
            contextMessage={{
              title: "See Your Forecast",
              description: `See conditions at ${beachName} explained clearly for your level`,
            }}
            source="match-score-teaser"
            returnTo={pathname}
          />
        )}
      </>
    );
  }

  return (
    <>
      <Badge
        data-testid="match-score-teaser"
        className={cn(
          "text-xs px-2 py-0.5 gap-1 cursor-pointer",
          "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
          className
        )}
        onClick={() => setShowAuth(true)}
        role="button"
        aria-label="Sign up to see your forecast"
      >
        <Sparkles className="h-3 w-3" aria-hidden="true" />
        <span>Match: ???</span>
      </Badge>

      {showAuth && (
        <UnifiedAuthModal
          isOpen={showAuth}
          onClose={() => setShowAuth(false)}
          mode="signup"
          contextMessage={{
            title: "See Your Forecast",
            description: `See conditions at ${beachName} explained clearly for your level`,
          }}
          source="match-score-teaser"
          returnTo={pathname}
        />
      )}
    </>
  );
}
