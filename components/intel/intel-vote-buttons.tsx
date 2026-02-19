"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp, ThumbsDown, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getVoteConfidenceBadge } from "@/lib/constants/intel";
import type { IntelVoteType } from "@/actions/intel/intel-types";

interface IntelVoteButtonsProps {
  postId: string;
  userVoteType: IntelVoteType | null | undefined;
  helpfulCount: number;
  offCount: number;
  confirmedCount: number;
  onVote: (postId: string, voteType: IntelVoteType | null) => Promise<void>;
  disabled?: boolean;
  /** Optional reason shown as a tooltip when buttons are disabled (e.g. "Sign in to vote") */
  disabledReason?: string;
  size?: "sm" | "default";
  className?: string;
}

export function IntelVoteButtons({
  postId,
  userVoteType,
  helpfulCount,
  offCount,
  confirmedCount,
  onVote,
  disabled = false,
  disabledReason,
  size = "sm",
  className,
}: IntelVoteButtonsProps) {
  // Local isVoting guard is a UX optimization to prevent duplicate requests.
  // The database UNIQUE constraint on (post_id, user_id) is the true guard
  // against double-inserts, so independent isVoting state across multiple
  // IntelVoteButtons instances (e.g. feed + modal) is acceptable.
  const [isVoting, setIsVoting] = useState(false);
  const badge = getVoteConfidenceBadge({
    helpful_count: helpfulCount,
    off_count: offCount,
    confirmed_count: confirmedCount,
  });

  const handleVote = async (type: IntelVoteType) => {
    if (isVoting || disabled) return;
    setIsVoting(true);
    try {
      // Toggle off if same vote, otherwise cast new vote
      await onVote(postId, userVoteType === type ? null : type);
    } finally {
      setIsVoting(false);
    }
  };

  const buttonCn =
    size === "sm" ? "h-7 px-2 text-xs gap-1" : "h-8 px-3 text-sm gap-1.5";

  const helpfulLabel =
    userVoteType === "helpful" ? "Remove helpful vote" : "Mark as helpful";
  const offLabel =
    userVoteType === "off" ? "Remove off vote" : "Mark as off";
  const confirmedLabel =
    userVoteType === "confirmed" ? "Remove confirmation" : "Confirm this intel";

  return (
    <div
      className={cn("flex items-center gap-2", className)}
      title={disabled && disabledReason ? disabledReason : undefined}
    >
      <div className="flex items-center gap-1">
        {/* Helpful */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleVote("helpful")}
          disabled={isVoting || disabled}
          aria-label={helpfulLabel}
          className={cn(
            buttonCn,
            "transition-all",
            userVoteType === "helpful"
              ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
              : "text-gray-500 hover:bg-blue-50 hover:text-blue-600"
          )}
        >
          <ThumbsUp
            className={cn(
              "h-3.5 w-3.5",
              userVoteType === "helpful" && "fill-current"
            )}
          />
          {helpfulCount > 0 && <span>{helpfulCount}</span>}
        </Button>

        {/* Off */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleVote("off")}
          disabled={isVoting || disabled}
          aria-label={offLabel}
          className={cn(
            buttonCn,
            "transition-all",
            userVoteType === "off"
              ? "bg-red-100 text-red-700 hover:bg-red-200"
              : "text-gray-500 hover:bg-red-50 hover:text-red-600"
          )}
        >
          <ThumbsDown
            className={cn(
              "h-3.5 w-3.5",
              userVoteType === "off" && "fill-current"
            )}
          />
          {offCount > 0 && <span>{offCount}</span>}
        </Button>

        {/* Confirmed */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleVote("confirmed")}
          disabled={isVoting || disabled}
          aria-label={confirmedLabel}
          className={cn(
            buttonCn,
            "transition-all",
            userVoteType === "confirmed"
              ? "bg-green-100 text-green-700 hover:bg-green-200"
              : "text-gray-500 hover:bg-green-50 hover:text-green-600"
          )}
        >
          <CheckCircle2
            className={cn(
              "h-3.5 w-3.5",
              userVoteType === "confirmed" && "fill-current"
            )}
          />
          {confirmedCount > 0 && <span>{confirmedCount}</span>}
        </Button>
      </div>

      {/* Confidence badge */}
      <Badge variant="outline" className={cn("text-xs", badge.color)}>
        {badge.label}
      </Badge>
    </div>
  );
}
