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
      title: (
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-yellow-500" />
          <span>+{result.xp_gained} XP</span>
        </div>
      ),
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
      title: (
        <div className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-yellow-500" />
          <span className="font-bold">Level Up!</span>
        </div>
      ),
      description: (
        <div className="space-y-1">
          <p>
            You're now a{" "}
            <span className="font-semibold text-blue-600">
              {result.level_title}
            </span>
          </p>
          <p className="text-sm text-muted-foreground">
            Level {result.new_level}
          </p>
        </div>
      ),
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
          title: (
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              <span className="font-bold">Badge Unlocked!</span>
            </div>
          ),
          description: (
            <div className="flex items-center gap-3">
              <BadgeIcon icon={badge.icon} size="lg" />
              <div>
                <p className="font-medium">{badge.name}</p>
                {badge.xp_reward > 0 && (
                  <p className="text-sm text-green-600">
                    +{badge.xp_reward} bonus XP
                  </p>
                )}
              </div>
            </div>
          ),
          duration: 5000,
          className:
            "bg-gradient-to-r from-green-50 to-emerald-50 border-green-200",
        });
      }, index * 1000);
    });
  };

  const showGenericXPToast = (xpGained: number, action: string) => {
    toast({
      title: (
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-blue-500" />
          <span>+{xpGained} XP</span>
        </div>
      ),
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

  return (
    <div
      data-testid="xp-booster-card"
      className={cn(
        "relative overflow-hidden rounded-lg border bg-gradient-to-r from-blue-50 to-indigo-50 p-4 cursor-pointer hover:shadow-md transition-all duration-200",
        "border-blue-200 hover:border-blue-300",
        onClick && "hover:scale-[1.02]",
        className
      )}
      onClick={onClick}
    >
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
