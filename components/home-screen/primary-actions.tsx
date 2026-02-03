"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Calendar, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SurfDiscoveryRecommendation } from "@/types/personalization";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useTrackEvent } from "@/hooks/use-track-event";
import { HOME_HEADER_MOTION } from "@/lib/constants/animations";
import { ShareSheet } from "@/components/share/share-sheet";

/**
 * Share data for the Share button
 */
export interface ShareData {
  /** URL to the OG image */
  imageUrl: string;
  /** Beach name */
  beachName: string;
  /** Share title text */
  title: string;
  /** Share description text */
  text: string;
}

/**
 * Props for PrimaryActions component
 */
export interface PrimaryActionsProps {
  /** Top surf spot recommendation data (used for context) */
  topRecommendation: SurfDiscoveryRecommendation | null;
  /** Callback when user clicks "I'm at the beach" */
  onAtBeach: () => void;
  /** Callback when user clicks "Plan Weekend" */
  onPlanWeekend: () => void;
  /** Whether buttons should be disabled */
  disabled?: boolean;
  /** Share data for the share button */
  shareData?: ShareData | null;
}

/**
 * Loading skeleton for PrimaryActions
 */
export function PrimaryActionsSkeleton() {
  return (
    <div
      className="flex flex-col xs:flex-row gap-3 px-4 sm:px-1"
      data-testid="primary-actions-loading"
    >
      <div className="flex-1 h-12 sm:h-14 bg-white/20 rounded-full animate-pulse" />
      <div className="flex-1 h-12 sm:h-14 bg-white/20 rounded-full animate-pulse" />
      <div className="flex-1 h-12 sm:h-14 bg-white/20 rounded-full animate-pulse" />
    </div>
  );
}

/**
 * PrimaryActions displays the two main action buttons below the hero recommendation
 * on the home screen.
 *
 * Features:
 * - "I'm at the beach" - Primary orange button with gradient for logging current session
 * - "Plan Weekend" - Secondary button with gradient for trip planning
 * - Bouncy animations on tap (Duolingo-inspired)
 * - Icon hover animations (plus rotates, calendar bounces)
 * - Responsive layout with equal-width buttons
 * - Proper touch targets for mobile (min 44px)
 * - Disabled state support
 * - Respects reduced motion preferences
 *
 * @example
 * ```tsx
 * <PrimaryActions
 *   topRecommendation={recommendation}
 *   onAtBeach={() => openSessionLogger()}
 *   onPlanWeekend={() => openWeekendPlanner()}
 * />
 * ```
 */
export const PrimaryActions = React.memo(function PrimaryActions({
  topRecommendation,
  onAtBeach,
  onPlanWeekend,
  disabled = false,
  shareData,
}: PrimaryActionsProps) {
  const reducedMotion = useReducedMotion();
  const { track: trackEvent } = useTrackEvent();
  const [isPrimaryHovered, setIsPrimaryHovered] = useState(false);
  const [isSecondaryHovered, setIsSecondaryHovered] = useState(false);
  const [isShareHovered, setIsShareHovered] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const handleShareClick = () => {
    trackEvent("cta_click", {
      beachId: topRecommendation?.beach?.id,
      metadata: {
        cta: "share" as const,
        location: "home_primary_actions",
      },
    });
    setShareOpen(true);
  };

  return (
    <div
      className="flex flex-col xs:flex-row gap-3 px-4 sm:px-1"
      data-testid="primary-actions"
    >
      {/* Primary action: I'm at the beach */}
      <motion.button
        onClick={onAtBeach}
        disabled={disabled}
        onMouseEnter={() => setIsPrimaryHovered(true)}
        onMouseLeave={() => setIsPrimaryHovered(false)}
        whileTap={reducedMotion ? undefined : HOME_HEADER_MOTION.button.tap}
        whileHover={reducedMotion ? undefined : HOME_HEADER_MOTION.button.hover}
        transition={reducedMotion ? { duration: 0 } : HOME_HEADER_MOTION.button.spring}
        className={cn(
          "flex-1 h-12 sm:h-14 min-h-[44px] rounded-full",
          "bg-gradient-to-b from-orange-400 to-orange-600",
          "hover:from-orange-500 hover:to-orange-700",
          "active:from-orange-600 active:to-orange-800",
          "text-white font-semibold text-sm sm:text-base",
          "shadow-sm hover:shadow-md",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-orange-400 disabled:hover:to-orange-600 disabled:hover:shadow-sm",
          "flex items-center justify-center gap-1 sm:gap-1.5"
        )}
        aria-label="Log that you are at the beach"
        data-testid="at-beach-button"
      >
        <motion.span
          animate={
            !reducedMotion && isPrimaryHovered
              ? HOME_HEADER_MOTION.button.iconHover.plus
              : {}
          }
          className="shrink-0"
        >
          <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
        </motion.span>
        <span className="truncate">I&apos;m at the beach</span>
      </motion.button>

      {/* Secondary action: Plan Weekend */}
      <motion.button
        onClick={onPlanWeekend}
        disabled={disabled}
        onMouseEnter={() => setIsSecondaryHovered(true)}
        onMouseLeave={() => setIsSecondaryHovered(false)}
        whileTap={reducedMotion ? undefined : HOME_HEADER_MOTION.button.tap}
        whileHover={reducedMotion ? undefined : HOME_HEADER_MOTION.button.hover}
        transition={reducedMotion ? { duration: 0 } : HOME_HEADER_MOTION.button.spring}
        className={cn(
          "flex-1 h-12 sm:h-14 min-h-[44px] rounded-full",
          "bg-transparent hover:bg-white/10 active:bg-white/15",
          "text-white/80 hover:text-white font-medium text-sm sm:text-base",
          "border border-white/30 hover:border-white/40",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-header-end",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent",
          "flex items-center justify-center gap-1 sm:gap-1.5",
          "transition-colors duration-200"
        )}
        aria-label="Plan your weekend surf trip"
        data-testid="plan-weekend-button"
      >
        <motion.span
          animate={
            !reducedMotion && isSecondaryHovered
              ? HOME_HEADER_MOTION.button.iconHover.calendar
              : {}
          }
          className="shrink-0"
        >
          <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
        </motion.span>
        <span className="truncate">Plan Weekend</span>
      </motion.button>

      {/* Share action button */}
      {shareData && (
        <motion.button
          onClick={handleShareClick}
          disabled={disabled}
          onMouseEnter={() => setIsShareHovered(true)}
          onMouseLeave={() => setIsShareHovered(false)}
          whileTap={reducedMotion ? undefined : HOME_HEADER_MOTION.button.tap}
          whileHover={reducedMotion ? undefined : HOME_HEADER_MOTION.button.hover}
          transition={reducedMotion ? { duration: 0 } : HOME_HEADER_MOTION.button.spring}
          className={cn(
            "flex-1 h-12 sm:h-14 min-h-[44px] rounded-full",
            "bg-transparent hover:bg-white/10 active:bg-white/15",
            "text-white/80 hover:text-white font-medium text-sm sm:text-base",
            "border border-white/30 hover:border-white/40",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-header-end",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent",
            "flex items-center justify-center gap-1 sm:gap-1.5",
            "transition-colors duration-200"
          )}
          aria-label="Share forecast"
          data-testid="share-button"
        >
          <motion.span
            animate={
              !reducedMotion && isShareHovered
                ? { scale: 1.1 }
                : {}
            }
            className="shrink-0"
          >
            <Share2 className="h-4 w-4 sm:h-5 sm:w-5" />
          </motion.span>
          <span className="truncate">Share</span>
        </motion.button>
      )}

      {shareData && (
        <ShareSheet
          open={shareOpen}
          onOpenChange={setShareOpen}
          imageUrl={shareData.imageUrl}
          type="wave"
          title={shareData.title}
          text={shareData.text}
        />
      )}
    </div>
  );
});

export default PrimaryActions;
