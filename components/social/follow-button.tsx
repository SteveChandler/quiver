"use client";

import { Button } from "@/components/ui/button";
import { UserPlus, UserMinus } from "lucide-react";
import { useUserFollow } from "@/hooks/use-user-follow";
import { useAuth } from "@/context/auth-context";

interface FollowButtonProps {
  userId: string;
  initialFollowersCount?: number;
  initialFollowingCount?: number;
  variant?: "default" | "outline" | "secondary";
  size?: "sm" | "md" | "lg";
  showCounts?: boolean;
  className?: string;
  onFollowersCountChange?: (newCount: number) => void;
  followingLabel?: string;
  notFollowingLabel?: string;
  onFollowAttempt?: () => void;
}

export function FollowButton({
  userId,
  initialFollowersCount = 0,
  initialFollowingCount = 0,
  variant = "default",
  size = "md",
  showCounts = false,
  className = "",
  onFollowersCountChange,
  followingLabel = "Unfollow",
  notFollowingLabel = "Follow",
  onFollowAttempt,
}: FollowButtonProps) {
  const { user } = useAuth();
  const {
    following,
    followersCount,
    followingCount,
    isLoading,
    toggleFollow,
    isToggling,
  } = useUserFollow(
    userId,
    initialFollowersCount,
    initialFollowingCount,
    onFollowersCountChange
  );

  // Don't show button for self or unauthenticated users
  if (!user || user.id === userId) {
    return null;
  }

  const buttonSize = size === "sm" ? "sm" : size === "lg" ? "lg" : "default";
  const buttonText = following ? followingLabel : notFollowingLabel;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button
        variant={following ? "outline" : variant}
        size={buttonSize}
        onClick={() => {
          onFollowAttempt?.();
          toggleFollow();
        }}
        disabled={isLoading || isToggling}
        className={`flex items-center gap-2 motion-optimized like-button-spring ripple-effect transition-[color,background-color,transform] ${
          following
            ? "hover:bg-destructive hover:text-destructive-foreground"
            : "hover:scale-105"
        }`}
        data-testid="follow-button"
        aria-pressed={following}
        aria-label={`${buttonText} this user. Currently has ${followersCount} ${
          followersCount === 1 ? "follower" : "followers"
        }`}
        style={{
          transform: isToggling ? "scale(0.95)" : "scale(1)",
        }}
      >
        {isToggling ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : following ? (
          <UserMinus className="h-4 w-4" />
        ) : (
          <UserPlus className="h-4 w-4" />
        )}
        <span className="hidden sm:inline">
          {buttonText}
        </span>
      </Button>

      {showCounts && (
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="text-center">
            <div className="font-medium">{followersCount}</div>
            <div className="text-xs">Followers</div>
          </div>
          <div className="text-center">
            <div className="font-medium">{followingCount}</div>
            <div className="text-xs">Following</div>
          </div>
        </div>
      )}
    </div>
  );
}
