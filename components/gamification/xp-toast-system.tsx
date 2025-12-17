"use client";

import { useToast } from "@/components/ui/use-toast";
import { BadgeIcon } from "@/components/gamification/badge-icon";
import type { XPTrackingResult, BadgeUnlock } from "@/lib/gamification-actions";
import { cn } from "@/lib/utils";
// Removed static import to fix SSR hydration errors
// import confetti from "canvas-confetti";
import { Trophy, Zap, Star, Crown } from "lucide-react";

interface XPToastProps {
  result: XPTrackingResult;
}

// SSR-safe confetti utility function
const triggerConfetti = async (options: any) => {
  // Only run on client-side to avoid SSR hydration errors
  if (typeof window === "undefined") return;

  try {
    // Dynamic import to avoid SSR issues
    const confetti = (await import("canvas-confetti")).default;
    confetti(options);
  } catch (error) {
    // Silently fail if confetti can't load - non-critical feature
    console.warn("Failed to load confetti:", error);
  }
};

export function useXPToastSystem() {
  const { toast } = useToast();

  const showXPGainedToast = (result: XPTrackingResult) => {
    // Show XP gained toast
    toast({
      title: `+${result.xp_gained} XP`,
      description: `Total: ${result.total_xp} XP`,
      duration: 3000,
      className: "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200",
    });

    // Show level up celebration if applicable
    if (result.level_up) {
      showLevelUpCelebration(result);
    }

    // Show badge unlocks if any
    if (result.new_badges.length > 0) {
      showBadgeUnlockCelebrations(result.new_badges);
    }
  };

  const showLevelUpCelebration = (result: XPTrackingResult) => {
    // Trigger confetti animation with SSR-safe loader
    triggerConfetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#3B82F6", "#8B5CF6", "#06B6D4", "#F59E0B"],
    });

    // Show level up toast
    toast({
      title: "Level Up!",
      description: `You're now a ${result.level_title} (Level ${result.new_level})`,
      duration: 6000,
      className:
        "bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-300",
    });
  };

  const showBadgeUnlockCelebrations = (badges: BadgeUnlock[]) => {
    // Trigger confetti for badges with SSR-safe loader
    triggerConfetti({
      particleCount: 150,
      spread: 60,
      origin: { y: 0.7 },
      colors: ["#10B981", "#F59E0B", "#8B5CF6", "#EF4444"],
    });

    badges.forEach((badge, index) => {
      // Stagger badge notifications
      setTimeout(() => {
        toast({
          title: "Badge Unlocked!",
          description:
            badge.xp_reward > 0
              ? `${badge.name} (+${badge.xp_reward} bonus XP)`
              : badge.name,
          duration: 5000,
          className:
            "bg-gradient-to-r from-green-50 to-emerald-50 border-green-200",
        });
      }, index * 1000);
    });
  };

  const showGenericXPToast = (xpGained: number, action: string) => {
    toast({
      title: `+${xpGained} XP`,
      description: action,
      duration: 2000,
      className: "bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200",
    });
  };

  return {
    showXPGainedToast,
    showLevelUpCelebration,
    showBadgeUnlockCelebrations,
    showGenericXPToast,
  };
}

// XP Booster Cards for encouraging actions
interface XPBoosterCardProps {
  action: string;
  xpValue: number;
  icon: React.ReactNode;
  description: string;
  onClick?: () => void;
  completed?: boolean;
  className?: string;
}

export function XPBoosterCard({
  action,
  xpValue,
  icon,
  description,
  onClick,
  completed = false,
  className,
}: XPBoosterCardProps) {
  if (completed) {
    return null; // Hide completed boosters
  }

  const content = (
    <>
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 rounded-full bg-blue-100 p-2">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-900 truncate">
              {description}
            </p>
            <div className="flex items-center gap-1 text-blue-600 font-medium">
              <Zap className="h-3 w-3" />
              <span className="text-sm">+{xpValue}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Subtle animation effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 -translate-x-full animate-[shimmer_2s_infinite]" />
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        data-testid="xp-booster-card"
        className={cn(
          "relative w-full overflow-hidden rounded-lg border bg-gradient-to-r from-blue-50 to-indigo-50 p-4 text-left transition-all duration-200",
          "border-blue-200 hover:border-blue-300 hover:scale-[1.02] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2",
          className
        )}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      data-testid="xp-booster-card"
      className={cn(
        "relative overflow-hidden rounded-lg border bg-gradient-to-r from-blue-50 to-indigo-50 p-4",
        "border-blue-200",
        className
      )}
    >
      {content}
    </div>
  );
}

// Hook for managing XP booster visibility
export function useXPBoosters() {
  const { showGenericXPToast } = useXPToastSystem();

  const handleBoosterClick = (action: string, xpValue: number) => {
    showGenericXPToast(xpValue, `Complete: ${action}`);
  };

  return { handleBoosterClick };
}
