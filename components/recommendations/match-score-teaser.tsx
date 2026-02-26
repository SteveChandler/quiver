"use client";

import React, { useState } from "react";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";

export interface MatchScoreTeaserProps {
  /** Beach identifier (used for future deferred actions if needed) */
  beachId: string;
  /** Beach name shown in the auth modal context message */
  beachName: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * MatchScoreTeaser Component
 *
 * A teaser badge shown to non-authenticated users in place of PersonalizedBadge.
 * Displays "Match: ???" in the same amber/yellow style, enticing users to sign
 * up to see their actual personalization match scores.
 *
 * On click, opens the UnifiedAuthModal in signup mode with a contextual message
 * about the match score feature. After auth, the parent beach-card swaps this
 * component for the real PersonalizedBadge automatically (no deferred action needed).
 *
 * @example
 * ```tsx
 * {!user && <MatchScoreTeaser beachId={beach.id} beachName={beach.name} />}
 * {user && <PersonalizedBadge ... />}
 * ```
 */
export function MatchScoreTeaser({
  beachId: _beachId,
  beachName,
  className,
}: MatchScoreTeaserProps) {
  const [showAuth, setShowAuth] = useState(false);
  const pathname = usePathname();

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
        aria-label="Sign up to see your personalized match score"
      >
        <Sparkles className="h-3 w-3" aria-hidden="true" />
        <span>Match: ???</span>
      </Badge>

      <UnifiedAuthModal
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
        mode="signup"
        contextMessage={{
          title: "See Your Match Score",
          description: `See your personalized match score for ${beachName}`,
        }}
        source="match-score-teaser"
        returnTo={pathname}
      />
    </>
  );
}
