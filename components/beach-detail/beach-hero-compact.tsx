"use client";

import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Beach } from "@/types/database";

interface BeachHeroCompactProps {
  beach: Beach & {
    average_rating?: number;
    review_count?: number;
  };
  className?: string;
}

export function BeachHeroCompact({ beach, className }: BeachHeroCompactProps) {
  const rating = beach.average_rating || beach.wave_quality_rating || 0;
  const reviewCount = beach.review_count || 0;
  const breakType = beach.break_type || "Beach Break";
  const location = beach.location || beach.region || "California";

  // Determine difficulty/skill level badge color
  const getDifficultyVariant = (level?: string | null) => {
    if (!level) return "secondary";
    const lower = level.toLowerCase();
    if (lower.includes("beginner") || lower.includes("easy")) return "success" as const;
    if (lower.includes("intermediate")) return "warning" as const;
    if (lower.includes("advanced") || lower.includes("expert")) return "destructive" as const;
    return "secondary" as const;
  };

  return (
    <div className={`space-y-3 ${className || ""}`}>
      {/* Beach Name */}
      <h1 className="text-3xl sm:text-4xl font-roboto font-extrabold text-dark-grey">
        {beach.name}
      </h1>

      {/* Metadata Row: Rating, Difficulty, Break Type, Location */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {/* Rating */}
        {rating > 0 && (
          <>
            <div className="inline-flex items-center gap-1">
              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
              <span className="font-semibold">{rating.toFixed(1)}</span>
            </div>
            {reviewCount > 0 && (
              <span className="text-muted-foreground">
                ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
              </span>
            )}
            <span className="text-muted-foreground">·</span>
          </>
        )}

        {/* Difficulty/Skill Level */}
        {beach.skill_level && (
          <>
            <Badge variant={getDifficultyVariant(beach.skill_level)}>
              {beach.skill_level}
            </Badge>
            <span className="text-muted-foreground">·</span>
          </>
        )}

        {/* Break Type */}
        <span className="text-foreground font-medium">{breakType}</span>

        <span className="text-muted-foreground">·</span>

        {/* Location */}
        <span className="text-muted-foreground">{location}</span>
      </div>
    </div>
  );
}
