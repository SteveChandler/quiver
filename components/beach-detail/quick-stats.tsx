"use client";

import { Waves, TrendingUp, Star, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickStatsProps {
  breakType?: string;
  skillLevel?: string;
  averageRating?: number;
  reviewCount?: number;
  className?: string;
}

function formatBreakType(breakType: string | undefined): string {
  if (!breakType) return "Beach";

  const typeMap: Record<string, string> = {
    beach: "Beach Break",
    reef: "Reef Break",
    point: "Point Break",
    jetty: "Jetty/Pier",
  };

  return typeMap[breakType.toLowerCase()] || breakType;
}

function formatSkillLevel(skillLevel: string | undefined): string {
  if (!skillLevel) return "All Levels";

  // Normalize underscores to spaces, lowercase, then title-case each word
  return skillLevel
    .trim()
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function QuickStats({
  breakType,
  skillLevel,
  averageRating,
  reviewCount,
  className,
}: QuickStatsProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-gradient-to-br from-white/80 to-zinc-50/60 dark:from-card dark:to-card rounded-2xl border border-zinc-200/50 dark:border-zinc-500/20 shadow-lg backdrop-blur-sm",
        className
      )}
    >
      {/* Break Type */}
      <div className="flex flex-col items-center text-center gap-1">
        <Waves className="h-5 w-5 text-zinc-500" />
        <div className="text-xs text-muted-foreground">Break</div>
        <div className="text-sm font-semibold">
          {formatBreakType(breakType)}
        </div>
      </div>

      {/* Skill Level */}
      <div className="flex flex-col items-center text-center gap-1">
        <TrendingUp className="h-5 w-5 text-zinc-500" />
        <div className="text-xs text-muted-foreground">Skill</div>
        <div className="text-sm font-semibold">
          {formatSkillLevel(skillLevel)}
        </div>
      </div>

      {/* Average Rating */}
      <div className="flex flex-col items-center text-center gap-1">
        <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
        <div className="text-xs text-muted-foreground">Rating</div>
        <div className="text-sm font-semibold">
          {averageRating ? averageRating.toFixed(1) : "—"}
        </div>
      </div>

      {/* Review Count */}
      <div className="flex flex-col items-center text-center gap-1">
        <MessageSquare className="h-5 w-5 text-zinc-500" />
        <div className="text-xs text-muted-foreground">Reviews</div>
        <div className="text-sm font-semibold">{reviewCount || 0}</div>
      </div>
    </div>
  );
}
